"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { getCurrentUser } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { companySchema, fieldErrors, normalizeNtn, normalizeWebsite } from "@/lib/signup-schema";
import type { OfficeDoc } from "@/lib/types";

export interface OrgFormState { ok?: boolean; message?: string; error?: string; fieldErrors?: Record<string, string> }

const OPEN = ["pending", "under_review", "info_required"];
const COMPANY_FIELDS = Object.keys(companySchema.shape);
const read = (form: FormData, keys: string[]) => Object.fromEntries(keys.map((k) => [k, String(form.get(k) ?? "")]));

async function requireSuperAdmin() {
  const user = await getCurrentUser();
  if (!user || user.scope !== "system" || user.access.level !== "allowed") return null;
  return user;
}

/** NTN and registration number must be unique across offices and live registration requests (same rule as public signup). */
async function duplicateErrors(db: Awaited<ReturnType<typeof getDb>>, ntn: string, regNumber: string, ignoreOfficeId?: ObjectId) {
  const errors: Record<string, string> = {};
  const hit = async (field: string, value: string) =>
    (await db.collection("offices").findOne({ [field]: value, ...(ignoreOfficeId ? { _id: { $ne: ignoreOfficeId } } : {}) })) ||
    (await db.collection("registrations").findOne({ [field]: value, status: { $in: [...OPEN, "approved"] }, ...(ignoreOfficeId ? { officeId: { $ne: ignoreOfficeId } } : {}) }));
  if (await hit("ntn", ntn)) errors.ntn = "A company with this NTN is already registered or awaiting review.";
  if (regNumber && (await hit("companyRegNumber", regNumber))) errors.companyRegNumber = "A company with this registration number is already registered.";
  return errors;
}

/* ---------- Edit head office details ---------- */

const LABELS: Record<string, string> = {
  officeName: "Name", legalName: "Legal name", ntn: "NTN", salesTaxNumber: "Sales tax number", companyRegNumber: "Registration number",
  registeredAddress: "Registered address", operationalAddress: "Operational address", province: "Province", city: "City",
  officePhone: "Office phone", officeEmail: "Office email", officeWebsite: "Website",
};

export async function updateOrganization(_prev: OrgFormState, form: FormData): Promise<OrgFormState> {
  const admin = await requireSuperAdmin();
  if (!admin) return { error: "Only the system administrator can edit an organization." };

  const id = String(form.get("id") ?? "");
  if (!ObjectId.isValid(id)) return { error: "This organization could not be found." };
  const parsed = companySchema.safeParse(read(form, COMPANY_FIELDS));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error.issues) };
  const d = parsed.data;

  const db = await getDb();
  const _id = new ObjectId(id);
  const office = await db.collection<OfficeDoc>("offices").findOne({ _id, type: "head" });
  if (!office) return { error: "This organization could not be found." };

  const next: Record<string, string | null> = {
    officeName: d.officeName, legalName: d.legalName || null, ntn: normalizeNtn(d.ntn), salesTaxNumber: d.salesTaxNumber || null,
    companyRegNumber: d.companyRegNumber || null, registeredAddress: d.registeredAddress, operationalAddress: d.operationalAddress,
    province: d.province, city: d.city, officePhone: d.officePhone, officeEmail: d.officeEmail, officeWebsite: normalizeWebsite(d.officeWebsite) || null,
  };
  // Form names differ from stored names for two fields.
  const current: Record<string, string | null> = { ...(office as unknown as Record<string, string | null>), officeName: office.name, officeWebsite: office.website ?? null };
  const changed = Object.keys(next).filter((k) => String(current[k] ?? "") !== String(next[k] ?? ""));
  if (!changed.length) return { ok: true, message: "No changes to save." };

  const errors = await duplicateErrors(db, next.ntn as string, (next.companyRegNumber as string) ?? "", _id);
  if (!changed.includes("ntn")) delete errors.ntn;
  if (!changed.includes("companyRegNumber")) delete errors.companyRegNumber;
  if (Object.keys(errors).length) return { fieldErrors: errors };

  await db.collection<OfficeDoc>("offices").updateOne({ _id }, {
    $set: {
      name: d.officeName, legalName: d.legalName || undefined, ntn: next.ntn as string, salesTaxNumber: d.salesTaxNumber || undefined,
      companyRegNumber: d.companyRegNumber || undefined, registeredAddress: d.registeredAddress, operationalAddress: d.operationalAddress,
      province: d.province, city: d.city, officePhone: d.officePhone, officeEmail: d.officeEmail, website: (next.officeWebsite as string) || undefined, updatedAt: new Date(),
    },
  });
  const names = changed.map((k) => LABELS[k]).join(", ");
  await writeAudit({ userId: new ObjectId(admin.id), userName: admin.name, headOfficeId: _id, officeId: null, action: "office.update", summary: `Edited ${office.name}: ${names}`, entity: "office", entityId: id });

  revalidatePath("/dashboard", "layout");
  redirect(`/dashboard/organizations/${id}?updated=1`);
}
