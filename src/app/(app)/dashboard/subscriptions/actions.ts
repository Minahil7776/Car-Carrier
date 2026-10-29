"use server";

import { Binary, MongoServerError, ObjectId } from "mongodb";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { getDb } from "@/lib/mongodb";
import { sniffMime } from "@/lib/signup-draft";
import {
  getSubscriptionSettings,
  saveSubscriptionSettings,
  type SubscriptionExemption,
  type SubscriptionPayment,
  type SubscriptionPlan,
} from "@/lib/subscription-management";
import type { OfficeDoc } from "@/lib/types";

async function requireAdmin() {
  const user = await getCurrentUser();
  return user?.scope === "system" && user.access.level === "allowed" ? user : null;
}

function dateValue(value: FormDataEntryValue | null) {
  const raw = String(value ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const date = new Date(`${raw}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== raw ? null : date;
}
const dateEnd = (date: Date) => new Date(date.getTime() + 86_400_000 - 1);

function back(message: string): never {
  redirect(`/dashboard/subscriptions?message=${encodeURIComponent(message)}`);
}

export async function savePlan(form: FormData) {
  const user = await requireAdmin();
  if (!user) back("Only the system administrator can manage subscription plans.");
  const parsed = z.object({
    name: z.string().trim().min(2).max(80),
    periodLabel: z.string().trim().min(2).max(50),
    periodDays: z.coerce.number().int().min(1).max(3650),
    amount: z.coerce.number().finite().min(0).max(1_000_000_000),
    officeType: z.enum(["head", "branch", "both"]),
    terms: z.string().trim().max(500),
  }).safeParse(Object.fromEntries(form));
  if (!parsed.success) back(parsed.error.issues[0]?.message ?? "Check the plan details.");
  const effectiveFrom = dateValue(form.get("effectiveFrom"));
  if (!effectiveFrom) back("Enter a valid plan effective date.");

  const db = await getDb();
  const plan: SubscriptionPlan = {
    _id: new ObjectId(), ...parsed.data, effectiveFrom, status: "active", createdAt: new Date(),
  };
  await db.collection<SubscriptionPlan>("subscription_plans").insertOne(plan);
  await writeAudit({ userId: new ObjectId(user.id), userName: user.name, headOfficeId: null, officeId: null, action: "subscription.plan.create", summary: `Created subscription plan ${plan.name}`, entity: "subscription_plan", entityId: plan._id.toString() });
  back("Subscription plan created.");
}

export async function changePlanStatus(form: FormData) {
  const user = await requireAdmin();
  if (!user) back("Only the system administrator can manage subscription plans.");
  const id = String(form.get("id") ?? "");
  const status = form.get("status");
  if (!ObjectId.isValid(id) || (status !== "active" && status !== "inactive")) back("Invalid plan update.");
  const db = await getDb();
  const result = await db.collection<SubscriptionPlan>("subscription_plans").updateOne({ _id: new ObjectId(id) }, { $set: { status } });
  if (!result.modifiedCount) back("The subscription plan was not found or is already set to that status.");
  await writeAudit({ userId: new ObjectId(user.id), userName: user.name, headOfficeId: null, officeId: null, action: "subscription.plan.status", summary: `${status === "active" ? "Activated" : "Deactivated"} subscription plan ${id}`, entity: "subscription_plan", entityId: id });
  back("Subscription plan updated.");
}

export async function updateGraceSettings(form: FormData) {
  const user = await requireAdmin();
  if (!user) back("Only the system administrator can change grace settings.");
  const parsed = z.object({
    gracePeriodDays: z.coerce.number().int().min(0).max(365),
    graceMode: z.enum(["warning_only", "full_access", "read_only", "limited"]),
  }).safeParse(Object.fromEntries(form));
  if (!parsed.success) back(parsed.error.issues[0]?.message ?? "Invalid grace period settings.");
  await saveSubscriptionSettings(parsed.data);
  await writeAudit({ userId: new ObjectId(user.id), userName: user.name, headOfficeId: null, officeId: null, action: "subscription.grace.update", summary: `Set subscription grace period to ${parsed.data.gracePeriodDays} days (${parsed.data.graceMode})`, entity: "subscription_settings", entityId: "grace_period" });
  back("Grace period settings saved.");
}

export async function grantExemption(form: FormData) {
  const user = await requireAdmin();
  if (!user) back("Only the system administrator can grant exemptions.");
  const officeId = String(form.get("officeId") ?? "");
  const scope = form.get("scope");
  const reason = String(form.get("reason") ?? "").trim();
  const remarks = String(form.get("remarks") ?? "").trim();
  const from = dateValue(form.get("from"));
  const untilValue = dateValue(form.get("until"));
  const until = untilValue ? dateEnd(untilValue) : null;
  if (!ObjectId.isValid(officeId) || (scope !== "office" && scope !== "organization")) back("Select a valid office and exemption scope.");
  if (!from || !until || until < from) back("Enter a valid exemption period.");
  if (reason.length < 3 || reason.length > 120 || remarks.length > 500) back("Enter a reason (3–120 characters) and keep remarks under 500 characters.");

  const db = await getDb();
  const offices = db.collection<OfficeDoc>("offices");
  const selected = await offices.findOne({ _id: new ObjectId(officeId) });
  if (!selected) back("The selected office could not be found.");
  const headId = selected.type === "head" ? selected._id : selected.parentId;
  if (!headId) back("This office has no head office association.");
  const related = scope === "organization"
    ? await offices.find({ $or: [{ _id: headId }, { parentId: headId }] }).toArray()
    : [selected];
  if (scope === "organization" && selected.type !== "head") back("Select a head office for an organization-wide exemption.");

  const ids = related.map((office) => office._id);
  const overlapping = await db.collection<SubscriptionExemption>("subscription_exemptions").findOne({
    officeIds: { $in: ids }, status: "active", from: { $lte: until }, until: { $gte: from },
  });
  if (overlapping) back("An active exemption already overlaps this period for the selected office.");

  const recordId = new ObjectId();
  const now = new Date();
  const exemption: SubscriptionExemption = {
    _id: recordId, officeId: selected._id, headOfficeId: headId, scope, officeIds: ids,
    from, until, reason, remarks, grantedById: new ObjectId(user.id), grantedBy: user.name,
    grantedAt: now, status: "active",
  };
  await db.collection<SubscriptionExemption>("subscription_exemptions").insertOne(exemption);
  await offices.updateMany({ _id: { $in: ids } }, {
    $set: { "subscription.exemptFrom": from, "subscription.exemptUntil": until, "subscription.exemptionId": recordId, updatedAt: now },
  });
  if (selected.type === "head" && scope === "office") {
    await offices.updateMany({ parentId: selected._id, "subscription.exemptionId": { $exists: false } }, {
      $set: { "subscription.inheritExemption": false },
    });
  }
  await writeAudit({ userId: new ObjectId(user.id), userName: user.name, headOfficeId: headId, officeId: selected.type === "branch" ? selected._id : null, action: "subscription.exemption.grant", summary: `Granted ${scope} subscription exemption for ${selected.name}: ${reason}`, entity: "subscription_exemption", entityId: recordId.toString() });
  back("Subscription exemption granted.");
}

export async function revokeExemption(form: FormData) {
  const user = await requireAdmin();
  if (!user) back("Only the system administrator can revoke exemptions.");
  const id = String(form.get("id") ?? "");
  if (!ObjectId.isValid(id)) back("Invalid exemption.");
  const db = await getDb();
  const col = db.collection<SubscriptionExemption>("subscription_exemptions");
  const record = await col.findOne({ _id: new ObjectId(id), status: "active" });
  if (!record) back("The exemption is no longer active.");
  const now = new Date();
  const result = await col.updateOne({ _id: record._id, status: "active" }, { $set: { status: "revoked", revokedAt: now, revokedBy: user.name } });
  if (!result.modifiedCount) back("The exemption was just changed. Refresh and try again.");
  await db.collection<OfficeDoc>("offices").updateMany(
    { _id: { $in: record.officeIds }, "subscription.exemptionId": record._id },
    { $unset: { "subscription.exemptFrom": "", "subscription.exemptUntil": "", "subscription.exemptionId": "" } },
  );
  if (record.scope === "office" && record.officeId.equals(record.headOfficeId)) {
    await db.collection<OfficeDoc>("offices").updateMany(
      { parentId: record.headOfficeId, "subscription.exemptionId": { $exists: false } },
      { $set: { "subscription.inheritExemption": true } },
    );
  }
  await writeAudit({ userId: new ObjectId(user.id), userName: user.name, headOfficeId: record.headOfficeId, officeId: record.scope === "office" ? record.officeId : null, action: "subscription.exemption.revoke", summary: `Revoked exemption for ${record.officeId}: ${record.reason}`, entity: "subscription_exemption", entityId: id });
  back("Subscription exemption revoked.");
}

export async function recordPayment(form: FormData) {
  const user = await requireAdmin();
  if (!user) back("Only the system administrator can record payments.");
  const officeId = String(form.get("officeId") ?? "");
  const planId = String(form.get("planId") ?? "");
  const parsed = z.object({
    receiptNumber: z.string().trim().min(2).max(60),
    amount: z.coerce.number().finite().min(0).max(1_000_000_000),
    method: z.string().trim().min(2).max(60),
    reference: z.string().trim().max(120),
    remarks: z.string().trim().max(500),
  }).safeParse(Object.fromEntries(form));
  const paymentDate = dateValue(form.get("paymentDate"));
  const periodStart = dateValue(form.get("periodStart"));
  const periodEndValue = dateValue(form.get("periodEnd"));
  const periodEnd = periodEndValue ? dateEnd(periodEndValue) : null;
  if (!ObjectId.isValid(officeId) || !ObjectId.isValid(planId) || !parsed.success) back(parsed.success ? "Select a valid office and plan." : parsed.error.issues[0]?.message ?? "Check the payment details.");
  if (!paymentDate || !periodStart || !periodEnd || periodEnd < periodStart) back("Enter valid payment and subscription period dates.");

  const db = await getDb();
  const [office, plan] = await Promise.all([
    db.collection<OfficeDoc>("offices").findOne({ _id: new ObjectId(officeId) }),
    db.collection<SubscriptionPlan>("subscription_plans").findOne({ _id: new ObjectId(planId), status: "active" }),
  ]);
  if (!office || !plan) back("The selected office or active plan could not be found.");
  if (plan.officeType !== "both" && plan.officeType !== office.type) back("This plan does not apply to the selected office type.");
  if (plan.effectiveFrom > paymentDate) back("This plan is not effective on the payment date.");
  if (periodEnd.getTime() - periodStart.getTime() + 1 !== plan.periodDays * 86_400_000) {
    back(`The subscription period must be ${plan.periodDays} days for the selected plan.`);
  }
  const duplicate = await db.collection<SubscriptionPayment>("subscription_payments").findOne({ receiptNumber: parsed.data.receiptNumber });
  if (duplicate) back("That receipt number has already been used.");

  const file = form.get("receipt");
  let receipt: SubscriptionPayment["receipt"];
  if (file instanceof File && file.size > 0) {
    if (file.size > 4 * 1024 * 1024) back("Receipt file must be 4 MB or smaller.");
    const data = Buffer.from(await file.arrayBuffer());
    const mime = sniffMime(data);
    if (!mime) back("Receipt must be a PDF, JPG, or PNG with valid file contents.");
    receipt = { name: file.name.replace(/[\\/\u0000-\u001f]/g, "").slice(-120) || "receipt", mime, data: new Binary(data) };
  }

  const headOfficeId = office.type === "head" ? office._id : office.parentId;
  if (!headOfficeId) back("The selected office has no head office association.");
  const paymentId = new ObjectId();
  const payment: SubscriptionPayment = {
    _id: paymentId, receiptNumber: parsed.data.receiptNumber, officeId: office._id, headOfficeId,
    officeName: office.name, officeCode: office.code, periodStart, periodEnd, planId: plan._id,
    planName: plan.name, amount: parsed.data.amount, paymentDate, method: parsed.data.method,
    reference: parsed.data.reference, receivedById: new ObjectId(user.id), receivedBy: user.name,
    remarks: parsed.data.remarks, status: "received", receipt, createdAt: new Date(),
  };
  try {
    const paymentCollection = db.collection<SubscriptionPayment>("subscription_payments");
    await paymentCollection.createIndex({ receiptNumber: 1 }, { unique: true });
    await paymentCollection.insertOne(payment);
  } catch (error) {
    if (error instanceof MongoServerError && error.code === 11000) back("That receipt number has already been used.");
    throw error;
  }

  const expiry = office.subscription?.expiresAt && office.subscription.expiresAt > periodEnd ? office.subscription.expiresAt : periodEnd;
  await db.collection<OfficeDoc>("offices").updateOne({ _id: office._id }, {
    $set: { "subscription.expiresAt": expiry, "subscription.cancelled": false, "subscription.planId": plan._id, updatedAt: new Date() },
  });
  await writeAudit({ userId: new ObjectId(user.id), userName: user.name, headOfficeId, officeId: office.type === "branch" ? office._id : null, action: "subscription.payment.record", summary: `Recorded ${parsed.data.amount} payment for ${office.name} (${payment.receiptNumber})`, entity: "subscription_payment", entityId: paymentId.toString() });
  back("Subscription payment recorded.");
}
