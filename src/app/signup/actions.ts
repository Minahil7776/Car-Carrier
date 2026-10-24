"use server";

import bcrypt from "bcryptjs";
import { headers } from "next/headers";
import { z } from "zod";
import { getDb } from "@/lib/mongodb";
import { writeAudit } from "@/lib/audit";
import type { UserDoc } from "@/lib/types";

export interface SignupState {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  values?: Record<string, string>;
  submittedEmail?: string;
}

const schema = z
  .object({
    companyName: z.string().trim().min(2, "Enter your company name.").max(120),
    legalName: z.string().trim().max(160).optional(),
    ntn: z.string().trim().max(20).optional(),
    city: z.string().trim().min(2, "Enter the city of your head office.").max(80),
    contactName: z.string().trim().min(2, "Enter the contact person's name.").max(80),
    email: z.string().trim().toLowerCase().email("Enter a valid email address."),
    phone: z.string().trim().regex(/^[+0-9\s-]{10,16}$/, "Enter a valid mobile number."),
    password: z
      .string()
      .min(8, "Use at least 8 characters.")
      .regex(/[A-Za-z]/, "Include at least one letter.")
      .regex(/\d/, "Include at least one number."),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, { path: ["confirm"], message: "Passwords don't match." });

export async function signup(_prev: SignupState, form: FormData): Promise<SignupState> {
  const raw = Object.fromEntries(
    ["companyName", "legalName", "ntn", "city", "contactName", "email", "phone", "password", "confirm"].map((k) => [k, String(form.get(k) ?? "")]),
  );
  const values = { ...raw, password: "", confirm: "" };

  // Honeypot: real people never fill this hidden field.
  if (String(form.get("website") ?? "")) return { ok: true, submittedEmail: raw.email };

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[String(i.path[0])] ??= i.message;
    return { fieldErrors, values };
  }
  const d = parsed.data;

  let db;
  try {
    db = await getDb();
  } catch {
    return { error: "Can't reach the database. Try again in a moment.", values };
  }

  const taken =
    (await db.collection<UserDoc>("users").findOne({ email: d.email })) ||
    (await db.collection("registrations").findOne({ applicantEmail: d.email, status: { $in: ["pending", "under_review", "info_required"] } }));
  if (taken) {
    return { fieldErrors: { email: "This email already has an account or a pending request. Sign in instead." }, values };
  }

  const now = new Date();
  const reg = await db.collection("registrations").insertOne({
    kind: "head",
    officeName: d.companyName,
    legalName: d.legalName || null,
    ntn: d.ntn || null,
    applicantName: d.contactName,
    applicantEmail: d.email,
    applicantPhone: d.phone,
    // Stored hashed. Becomes the Head Office Administrator's password when the request is approved.
    passwordHash: await bcrypt.hash(d.password, 12),
    city: d.city,
    parentId: null,
    documentsCount: 0,
    status: "pending",
    submittedAt: now,
  });

  const h = await headers();
  await writeAudit({
    userId: null,
    userName: d.contactName,
    headOfficeId: null,
    officeId: null,
    action: "registration.submit",
    summary: `Registration submitted for ${d.companyName}`,
    entity: "registration",
    entityId: reg.insertedId.toString(),
    ip: h.get("x-forwarded-for")?.split(",")[0]?.trim(),
  });

  // Tell every Super Administrator (FR-ORG-004 / section 36).
  const admins = await db.collection<UserDoc>("users").find({ roleKeys: "super_admin", status: "active" }).toArray();
  if (admins.length) {
    await db.collection("notifications").insertMany(
      admins.map((a) => ({ userId: a._id, title: "New registration", body: `${d.companyName} submitted a registration request.`, read: false, createdAt: now })),
    );
  }

  return { ok: true, submittedEmail: d.email };
}
