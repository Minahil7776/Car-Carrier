"use server";

import bcrypt from "bcryptjs";
import { headers } from "next/headers";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { writeAudit } from "@/lib/audit";
import type { UserDoc } from "@/lib/types";
import { DOCUMENT_TYPES, MIN_DOCUMENTS } from "@/lib/signup-config";
import { fieldErrors, normalizeNtn, normalizeWebsite, signupSchema } from "@/lib/signup-schema";
import { filesCollection, verifyDraftToken } from "@/lib/signup-draft";

export interface SignupState {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  submittedEmail?: string;
}

const OPEN = ["pending", "under_review", "info_required"];
const FIELDS = ["officeName", "legalName", "officeType", "ntn", "salesTaxNumber", "companyRegNumber", "registeredAddress", "operationalAddress", "country", "province", "city", "officePhone", "officeEmail", "officeWebsite", "contactName", "designation", "email", "phone", "password", "confirm"];

export async function signup(_prev: SignupState, form: FormData): Promise<SignupState> {
  const raw = Object.fromEntries(FIELDS.map((k) => [k, String(form.get(k) ?? "")]));

  // Honeypot: real people never fill this hidden field.
  if (String(form.get("website") ?? "")) return { ok: true, submittedEmail: raw.email };

  const parsed = signupSchema.safeParse(raw);
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error.issues) };
  const d = parsed.data;
  const ntn = normalizeNtn(d.ntn);

  // Documents the browser says it uploaded: [{ docType, id }]
  let claimed: { docType: string; id: string }[] = [];
  try { claimed = JSON.parse(String(form.get("fileIds") ?? "[]")); } catch { /* handled below */ }
  const draftId = await verifyDraftToken(String(form.get("token") ?? ""));
  if (!draftId) return { fieldErrors: { documents: "Your upload session expired. Refresh the page and start again." } };

  const required = DOCUMENT_TYPES.filter((t) => t.required);
  const missing = required.filter((t) => !claimed.some((c) => c.docType === t.key));
  if (missing.length) return { fieldErrors: { documents: `Please upload: ${missing.map((t) => t.label).join(", ")}.` } };
  if (claimed.length < MIN_DOCUMENTS) return { fieldErrors: { documents: `Upload at least ${MIN_DOCUMENTS} document to continue.` } };
  if (claimed.some((c) => !ObjectId.isValid(c.id) || !DOCUMENT_TYPES.some((t) => t.key === c.docType)) || new Set(claimed.map((c) => c.docType)).size !== claimed.length) {
    return { fieldErrors: { documents: "Something is wrong with the uploaded documents. Remove them and upload again." } };
  }

  let db;
  try { db = await getDb(); } catch { return { error: "Can't reach the database. Try again in a moment." }; }

  // Duplicate checks: email (existing rule) plus company identifiers.
  const errors: Record<string, string> = {};
  const [userHit, regHit] = await Promise.all([
    db.collection<UserDoc>("users").findOne({ email: d.email }),
    db.collection("registrations").findOne({ applicantEmail: d.email, status: { $in: OPEN } }),
  ]);
  if (userHit || regHit) errors.email = "This email already has an account or a pending request. Sign in instead.";

  const dupe = async (field: string, value: string) =>
    (await db.collection("offices").findOne({ [field]: value })) || (await db.collection("registrations").findOne({ [field]: value, status: { $in: [...OPEN, "approved"] } }));
  if (await dupe("ntn", ntn)) errors.ntn = "A company with this NTN is already registered or awaiting review.";
  if (d.companyRegNumber && (await dupe("companyRegNumber", d.companyRegNumber))) errors.companyRegNumber = "A company with this registration number is already registered or awaiting review.";
  if (Object.keys(errors).length) return { fieldErrors: errors };

  // Confirm every claimed file exists, is still a draft, and belongs to this session.
  const files = await filesCollection();
  const ids = claimed.map((c) => new ObjectId(c.id));
  const found = await files.find({ _id: { $in: ids }, draftId, registrationId: null }, { projection: { data: 0 } }).toArray();
  const ok = found.length === claimed.length && found.every((f) => claimed.some((c) => c.id === f._id.toString() && c.docType === f.docType));
  if (!ok) return { fieldErrors: { documents: "A document is missing on our side. Please upload it again." } };

  const registrationId = new ObjectId();
  const now = new Date();
  try {
    // Attach the files first. A second submit of the same form then fails here instead of duplicating anything.
    const attach = await files.updateMany({ _id: { $in: ids }, draftId, registrationId: null }, { $set: { registrationId }, $unset: { expiresAt: "" } });
    if (attach.modifiedCount !== ids.length) return { error: "This registration was already submitted." };

    await db.collection("registrations").insertOne({
      _id: registrationId,
      kind: "head",
      officeType: d.officeType,
      officeName: d.officeName,
      legalName: d.legalName || null,
      ntn,
      salesTaxNumber: d.salesTaxNumber || null,
      companyRegNumber: d.companyRegNumber || null,
      registeredAddress: d.registeredAddress,
      operationalAddress: d.operationalAddress,
      country: "Pakistan",
      province: d.province,
      city: d.city,
      officePhone: d.officePhone,
      officeEmail: d.officeEmail,
      officeWebsite: normalizeWebsite(d.officeWebsite) || null,
      applicantName: d.contactName,
      designation: d.designation,
      applicantEmail: d.email,
      applicantPhone: d.phone,
      // Stored hashed. Becomes the Head Office Administrator's password when the request is approved.
      passwordHash: await bcrypt.hash(d.password, 12),
      parentId: null,
      documents: found.map((f) => ({ fileId: f._id, docType: f.docType, name: f.name, size: f.size, mime: f.mime })),
      documentsCount: found.length,
      status: "pending",
      submittedAt: now,
    });
  } catch (err) {
    // Put the files back so the applicant can retry without re-uploading.
    console.error("registration failed", err);
    await files.updateMany({ _id: { $in: ids }, registrationId }, { $set: { registrationId: null, expiresAt: new Date(Date.now() + 3_600_000 * 24) } }).catch(() => {});
    return { error: "We couldn't submit your registration. Your details are kept, please try again." };
  }

  const h = await headers();
  await writeAudit({
    userId: null, userName: d.contactName, headOfficeId: null, officeId: null,
    action: "registration.submit", summary: `Registration submitted for ${d.officeName}`,
    entity: "registration", entityId: registrationId.toString(), ip: h.get("x-forwarded-for")?.split(",")[0]?.trim(),
  });

  const admins = await db.collection<UserDoc>("users").find({ roleKeys: "super_admin", status: "active" }).toArray();
  if (admins.length) {
    await db.collection("notifications").insertMany(
      admins.map((a) => ({ userId: a._id, title: "New registration", body: `${d.officeName} submitted a registration request.`, read: false, createdAt: now })),
    );
  }

  return { ok: true, submittedEmail: d.email };
}
