"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { MongoServerError, ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { can, getCurrentUser, type CurrentUser } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { sendMail } from "@/lib/mail";
import { BRANCH_EDIT_FIELDS, BRANCH_FIELDS, branchEditSchema, branchSchema } from "@/lib/office-schema";
import { fieldErrors } from "@/lib/signup-schema";
import type { SubscriptionExemption } from "@/lib/subscription-management";
import type { OfficeDoc, OfficeStatusHistoryDoc, UserDoc } from "@/lib/types";

export interface BranchFormState { ok?: boolean; message?: string; error?: string; fieldErrors?: Record<string, string> }

const read = (form: FormData, keys: string[]) => Object.fromEntries(keys.map((k) => [k, String(form.get(k) ?? "")]));
const escapeRx = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Branch creation is head-office-only; the Super Administrator may still edit branches. */
function allowed(user: CurrentUser | null, permission: "branch.create" | "branch.update"): user is CurrentUser {
  if (!user || user.access.level !== "allowed") return false;
  if (user.scope === "system") return permission === "branch.update";
  return user.scope === "head" && can(user, permission);
}

/* ---------- FR-BR-001: create a branch ---------- */

export async function createBranch(_prev: BranchFormState, form: FormData): Promise<BranchFormState> {
  const user = await getCurrentUser();
  if (!allowed(user, "branch.create")) return { error: "You don't have permission to create branches." };

  // The head office comes from the signed-in user, never from the request.
  const headId = user.office!.id;

  const parsed = branchSchema.safeParse(read(form, BRANCH_FIELDS));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error.issues) };
  const d = parsed.data;

  const db = await getDb();
  const offices = db.collection<OfficeDoc>("offices");
  const head = await offices.findOne({ _id: new ObjectId(headId), type: "head" });
  if (!head) return { error: "This head office could not be found." };
  if (head.status !== "active") return { error: `${head.name} is ${head.status}, so new branches can't be added right now.` };
  const headExemption = head.subscription?.exemptionId
    ? await db.collection<SubscriptionExemption>("subscription_exemptions").findOne({ _id: head.subscription.exemptionId, status: "active" })
    : null;
  const branchSubscription = headExemption?.scope === "organization"
    ? {
      exemptFrom: head.subscription?.exemptFrom,
      exemptUntil: head.subscription?.exemptUntil,
      exemptionId: head.subscription?.exemptionId,
    }
    : headExemption
      ? { inheritExemption: false }
      : undefined;

  const sameName = await offices.findOne({ parentId: head._id, type: "branch", name: new RegExp(`^${escapeRx(d.branchName)}$`, "i") });
  if (sameName) return { fieldErrors: { branchName: "This head office already has a branch with this name." } };

  // BR-LHR-001: the identifier is system-generated from the branch code and never typed in full by a user.
  const branchId = new ObjectId();
  const now = new Date();
  const prefix = `BR-${d.branchCode}`;
  let code = "";
  for (let attempt = 0; attempt < 4; attempt++) {
    let n = (await offices.countDocuments({ code: { $regex: `^${prefix}-\\d+$` } })) + 1 + attempt;
    while (await offices.findOne({ code: `${prefix}-${String(n).padStart(3, "0")}` })) n++;
    code = `${prefix}-${String(n).padStart(3, "0")}`;
    try {
      await offices.insertOne({
        _id: branchId, code, branchCode: d.branchCode, name: d.branchName, type: "branch", parentId: head._id,
        operationalAddress: d.address, city: d.city, province: d.province, country: "Pakistan",
        officePhone: d.contactPhone, officeEmail: d.email,
        managerName: d.managerName, managerEmail: d.managerEmail || undefined, managerPhone: d.managerPhone || undefined,
        openingDate: new Date(d.openingDate), notes: d.notes || undefined,
        ...(branchSubscription ? { subscription: branchSubscription } : {}),
        // SRS FR-BR-001 note: a branch is created straight away; the Super Administrator is told, not asked.
        status: "active", createdById: new ObjectId(user.id), createdAt: now,
      });
      break;
    } catch (err) {
      const dup = err instanceof MongoServerError && err.code === 11000;
      if (!dup || attempt === 3) {
        console.error("create branch failed", err);
        return { error: dup ? "Another branch was created at the same time. Please try again." : "Couldn't create the branch. Please try again." };
      }
    }
  }

  await db.collection<Omit<OfficeStatusHistoryDoc, "_id">>("office_status_history").insertOne({
    officeId: branchId, headOfficeId: head._id, from: null, to: "active", reason: "Branch created", byId: new ObjectId(user.id), byName: user.name, at: now,
  });
  await writeAudit({ userId: new ObjectId(user.id), userName: user.name, headOfficeId: head._id, officeId: branchId, action: "branch.create", summary: `Created branch ${d.branchName} (${code})`, entity: "branch", entityId: branchId.toString() });

  // Notify the Super Administrator(s): in the app and by email (FR-BR-001 note, section 36).
  const admins = await db.collection<UserDoc>("users").find({ roleKeys: "super_admin", status: "active" }).toArray();
  if (admins.length) {
    await db.collection("notifications").insertMany(admins.map((a) => ({
      userId: a._id, title: "New branch added", body: `${head.name} added ${d.branchName} (${code}) in ${d.city}.`, read: false, createdAt: now,
    })));
    void sendMail({
      to: admins.map((a) => a.email),
      subject: `New branch: ${d.branchName} (${head.name})`,
      text: [
        `${user.name} added a new branch.`, "",
        `Head office: ${head.name} (${head.code})`, `Branch: ${d.branchName} (${code})`, `City: ${d.city}, ${d.province}`,
        `Manager: ${d.managerName}`, `Opening date: ${d.openingDate}`, "",
        "No action is needed. You can suspend or block the branch from the Branches page if required.",
      ].join("\n"),
    });
  }

  revalidatePath("/dashboard", "layout");
  redirect(`/dashboard/branches/${branchId.toString()}?created=1`);
}

/* ---------- Edit a branch ---------- */

const LABELS: Record<string, string> = {
  branchName: "Name", address: "Address", province: "Province", city: "City", contactPhone: "Contact number", email: "Email",
  managerName: "Manager", managerEmail: "Manager email", managerPhone: "Manager mobile", openingDate: "Opening date", notes: "Notes",
};

export async function updateBranch(_prev: BranchFormState, form: FormData): Promise<BranchFormState> {
  const user = await getCurrentUser();
  if (!allowed(user, "branch.update")) return { error: "You don't have permission to edit branches." };

  const id = String(form.get("id") ?? "");
  if (!ObjectId.isValid(id)) return { error: "This branch could not be found." };
  const parsed = branchEditSchema.safeParse(read(form, BRANCH_EDIT_FIELDS));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error.issues) };
  const d = parsed.data;

  const db = await getDb();
  const offices = db.collection<OfficeDoc>("offices");
  // Tenant isolation: a head-office user can only reach branches under their own head office.
  const branch = await offices.findOne({ _id: new ObjectId(id), type: "branch", ...(user.scope === "head" ? { parentId: new ObjectId(user.office!.id) } : {}) });
  if (!branch) return { error: "This branch could not be found." };

  if (d.branchName.toLowerCase() !== branch.name.toLowerCase()) {
    const sameName = await offices.findOne({ parentId: branch.parentId, type: "branch", _id: { $ne: branch._id }, name: new RegExp(`^${escapeRx(d.branchName)}$`, "i") });
    if (sameName) return { fieldErrors: { branchName: "This head office already has a branch with this name." } };
  }

  const before: Record<string, string> = {
    branchName: branch.name, address: branch.operationalAddress ?? "", province: branch.province ?? "", city: branch.city, contactPhone: branch.officePhone ?? "",
    email: branch.officeEmail ?? "", managerName: branch.managerName ?? "", managerEmail: branch.managerEmail ?? "", managerPhone: branch.managerPhone ?? "",
    openingDate: branch.openingDate ? branch.openingDate.toISOString().slice(0, 10) : "", notes: branch.notes ?? "",
  };
  const changed = Object.keys(before).filter((k) => before[k] !== String((d as Record<string, string>)[k] ?? ""));
  if (!changed.length) return { ok: true, message: "No changes to save." };

  await offices.updateOne({ _id: branch._id }, {
    $set: {
      name: d.branchName, operationalAddress: d.address, province: d.province, city: d.city, officePhone: d.contactPhone, officeEmail: d.email,
      managerName: d.managerName, managerEmail: d.managerEmail || undefined, managerPhone: d.managerPhone || undefined,
      openingDate: new Date(d.openingDate), notes: d.notes || undefined, updatedAt: new Date(),
    },
  });
  await writeAudit({
    userId: new ObjectId(user.id), userName: user.name, headOfficeId: branch.parentId ?? null, officeId: branch._id, action: "branch.update",
    summary: `Edited ${branch.name}: ${changed.map((k) => LABELS[k]).join(", ")}`, entity: "branch", entityId: id,
  });

  revalidatePath("/dashboard", "layout");
  redirect(`/dashboard/branches/${id}?updated=1`);
}
