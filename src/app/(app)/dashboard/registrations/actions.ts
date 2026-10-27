"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { decideRegistration as decide } from "@/lib/registration-review";

export interface ReviewState { ok?: boolean; message?: string; error?: string }

const schema = z.object({
  id: z.string().min(1),
  decision: z.enum(["approve", "reject", "info"]),
  remarks: z.string().trim().max(500, "Keep remarks under 500 characters.").optional(),
  trialDays: z.coerce.number().int().min(0).max(365).default(30),
});

export async function reviewRegistration(_prev: ReviewState, form: FormData): Promise<ReviewState> {
  // Server-side check: only the Super Administrator can decide, whatever the UI shows.
  const user = await getCurrentUser();
  if (!user || user.scope !== "system" || user.access.level !== "allowed") {
    return { error: "Only the system administrator can review registrations." };
  }

  const parsed = schema.safeParse({
    id: form.get("id"),
    decision: form.get("decision"),
    remarks: form.get("remarks") ?? "",
    trialDays: form.get("trialDays") ?? 30,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { id, decision, remarks, trialDays } = parsed.data;
  if (decision !== "approve" && !remarks) {
    return { error: decision === "reject" ? "Add a reason for rejecting this request." : "Say which documents or details are missing." };
  }

  const res = await decide({ id, decision, remarks: remarks || null, trialDays, actor: { id: user.id, name: user.name } });
  if (!res.ok) return { error: res.error };

  revalidatePath("/dashboard", "layout");
  return { ok: true, message: res.message };
}

/* ---------- Edit details (the administrator updates what the applicant confirmed by phone) ---------- */

import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { writeAudit } from "@/lib/audit";
import { adminEditSchema, fieldErrors, normalizeNtn, normalizeWebsite } from "@/lib/signup-schema";

export interface EditState { ok?: boolean; message?: string; error?: string; fieldErrors?: Record<string, string> }

const OPEN = ["pending", "under_review", "info_required"];
const LABELS: Record<string, string> = {
  officeName: "Company name", legalName: "Legal name", ntn: "NTN", salesTaxNumber: "Sales tax number", companyRegNumber: "Registration number",
  registeredAddress: "Registered address", operationalAddress: "Operational address", province: "Province", city: "City",
  officePhone: "Office phone", officeEmail: "Office email", officeWebsite: "Website",
  applicantName: "Contact name", designation: "Designation", applicantEmail: "Email", applicantPhone: "Mobile",
};

export async function updateRegistration(_prev: EditState, form: FormData): Promise<EditState> {
  const user = await getCurrentUser();
  if (!user || user.scope !== "system" || user.access.level !== "allowed") return { error: "Only the system administrator can edit registrations." };

  const id = String(form.get("id") ?? "");
  if (!ObjectId.isValid(id)) return { error: "This request could not be found." };

  const keys = Object.keys(adminEditSchema.shape);
  const parsed = adminEditSchema.safeParse(Object.fromEntries(keys.map((k) => [k, String(form.get(k) ?? "")])));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error.issues) };
  const d = parsed.data;
  const note = String(form.get("note") ?? "").trim().slice(0, 300);

  const db = await getDb();
  const regs = db.collection("registrations");
  const _id = new ObjectId(id);
  const reg = await regs.findOne({ _id });
  if (!reg) return { error: "This request could not be found." };
  if (!OPEN.includes(reg.status)) return { error: "This request has already been decided, so it can no longer be edited." };
  if (reg.kind !== "head") return { error: "Only company registrations can be edited here." };

  const next: Record<string, string | null> = {
    officeName: d.officeName, legalName: d.legalName || null, ntn: normalizeNtn(d.ntn),
    salesTaxNumber: d.salesTaxNumber || null, companyRegNumber: d.companyRegNumber || null,
    registeredAddress: d.registeredAddress, operationalAddress: d.operationalAddress, province: d.province, city: d.city,
    officePhone: d.officePhone, officeEmail: d.officeEmail, officeWebsite: normalizeWebsite(d.officeWebsite) || null,
    applicantName: d.contactName, designation: d.designation, applicantEmail: d.email, applicantPhone: d.phone,
  };
  const changed = Object.keys(next).filter((k) => String(reg[k] ?? "") !== String(next[k] ?? ""));
  if (!changed.length) return { ok: true, message: "No changes to save." };

  // Same duplicate rules as signup, ignoring this request itself.
  const errors: Record<string, string> = {};
  if (changed.includes("applicantEmail")) {
    const [u, other] = await Promise.all([
      db.collection("users").findOne({ email: next.applicantEmail }),
      regs.findOne({ applicantEmail: next.applicantEmail, _id: { $ne: _id }, status: { $in: OPEN } }),
    ]);
    if (u || other) errors.email = "This email already has an account or another pending request.";
  }
  const dupe = async (field: string, value: string) =>
    (await db.collection("offices").findOne({ [field]: value })) || (await regs.findOne({ [field]: value, _id: { $ne: _id }, status: { $in: [...OPEN, "approved"] } }));
  if (changed.includes("ntn") && (await dupe("ntn", next.ntn as string))) errors.ntn = "Another company already uses this NTN.";
  if (changed.includes("companyRegNumber") && next.companyRegNumber && (await dupe("companyRegNumber", next.companyRegNumber))) errors.companyRegNumber = "Another company already uses this registration number.";
  if (Object.keys(errors).length) return { fieldErrors: errors };

  const names = changed.map((k) => LABELS[k]).join(", ");
  const res = await regs.updateOne(
    { _id, status: { $in: OPEN } },
    {
      $set: { ...next, ...(reg.status === "pending" ? { status: "under_review" } : {}) }, // someone is now looking into it
      $push: { history: { at: new Date(), by: user.name, action: "edited", remarks: `Updated: ${names}.${note ? ` Note: ${note}` : ""}` } },
    } as never,
  );
  if (!res.modifiedCount) return { error: "This request has just been decided, so nothing was saved." };

  await writeAudit({ userId: new ObjectId(user.id), userName: user.name, headOfficeId: null, officeId: null, action: "registration.edit", summary: `Edited ${reg.officeName}: ${names}`, entity: "registration", entityId: id });
  revalidatePath("/dashboard", "layout");
  return { ok: true, message: `Saved. Updated: ${names}.` };
}
