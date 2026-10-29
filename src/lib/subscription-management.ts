import "server-only";
import { ObjectId, type Binary } from "mongodb";
import { getDb } from "./mongodb";
import { resolveSubscription } from "./subscription";
import type { OfficeDoc, OfficeType, SubscriptionStatus } from "./types";

export type GraceMode = "warning_only" | "full_access" | "read_only" | "limited";
export type SubscriptionPlanStatus = "active" | "inactive";
export type ExemptionStatus = "scheduled" | "active" | "expired" | "revoked";
export type PaymentStatus = "received" | "void";

export interface SubscriptionPlan {
  _id: ObjectId;
  name: string;
  periodLabel: string;
  periodDays: number;
  amount: number;
  effectiveFrom: Date;
  status: SubscriptionPlanStatus;
  officeType: OfficeType | "both";
  terms: string;
  createdAt: Date;
}

export interface SubscriptionExemption {
  _id: ObjectId;
  officeId: ObjectId;
  headOfficeId: ObjectId;
  scope: "office" | "organization";
  officeIds: ObjectId[];
  from: Date;
  until: Date;
  reason: string;
  remarks: string;
  grantedById: ObjectId;
  grantedBy: string;
  grantedAt: Date;
  status: ExemptionStatus;
  revokedAt?: Date;
  revokedBy?: string;
}

export interface SubscriptionPayment {
  _id: ObjectId;
  receiptNumber: string;
  officeId: ObjectId;
  headOfficeId: ObjectId;
  officeName: string;
  officeCode: string;
  periodStart: Date;
  periodEnd: Date;
  planId: ObjectId;
  planName: string;
  amount: number;
  paymentDate: Date;
  method: string;
  reference: string;
  receivedById: ObjectId;
  receivedBy: string;
  remarks: string;
  status: PaymentStatus;
  receipt?: { name: string; mime: string; data: Binary };
  createdAt: Date;
}

export interface SubscriptionSettings {
  gracePeriodDays: number;
  graceMode: GraceMode;
}

export function effectiveSubscription(office: OfficeDoc, headOffice?: OfficeDoc | null) {
  if (office.type !== "branch" || !headOffice) return office.subscription;
  if (!office.subscription) return headOffice.subscription;

  const inherited = headOffice.subscription;
  const own = office.subscription;
  return {
    ...inherited,
    ...own,
    ...(own.inheritExemption === false && !own.exemptUntil
      ? { exemptFrom: null, exemptUntil: null, exemptionId: undefined }
      : {}),
  };
}

const SETTINGS_ID = new ObjectId("6a7c43e0d034b0a07e3f2102");

export async function getSubscriptionSettings(): Promise<SubscriptionSettings> {
  const setting = await (await getDb()).collection<{ gracePeriodDays?: number; graceMode?: GraceMode }>("system_settings").findOne({ _id: SETTINGS_ID });
  return {
    gracePeriodDays: setting?.gracePeriodDays ?? 7,
    graceMode: setting?.graceMode ?? "warning_only",
  };
}

export async function saveSubscriptionSettings(settings: SubscriptionSettings) {
  await (await getDb()).collection<{ gracePeriodDays: number; graceMode: GraceMode }>("system_settings").updateOne(
    { _id: SETTINGS_ID },
    { $set: settings },
    { upsert: true },
  );
}

export async function getSubscriptionAdminData() {
  const db = await getDb();
  const offices = db.collection<OfficeDoc>("offices");
  const [officeDocs, plans, exemptions, payments, settings] = await Promise.all([
    offices.find({}).sort({ type: 1, name: 1 }).toArray(),
    db.collection<SubscriptionPlan>("subscription_plans").find({}).sort({ effectiveFrom: -1, name: 1 }).toArray(),
    db.collection<SubscriptionExemption>("subscription_exemptions").find({}).sort({ grantedAt: -1 }).limit(100).toArray(),
    db.collection<SubscriptionPayment>("subscription_payments").find({}).sort({ paymentDate: -1 }).limit(100).toArray(),
    getSubscriptionSettings(),
  ]);
  const heads = new Map(officeDocs.filter((o) => o.type === "head").map((o) => [o._id.toString(), o]));
  const officeRows = officeDocs.map((office) => {
    const head = office.type === "head" ? office : heads.get(office.parentId?.toString() ?? "");
    const subscription = effectiveSubscription(office, head);
    const sub = resolveSubscription(subscription);
    return {
      id: office._id.toString(),
      name: office.name,
      code: office.code,
      type: office.type,
      headOfficeName: office.type === "head" ? office.name : head?.name ?? "—",
      status: office.status,
      subscriptionStatus: sub.status,
      expiresAt: subscription?.expiresAt?.toISOString() ?? null,
      exemptFrom: subscription?.exemptFrom?.toISOString() ?? null,
      exemptUntil: subscription?.exemptUntil?.toISOString() ?? null,
      daysLeft: sub.daysLeft,
    };
  });
  const officeNames = new Map(officeDocs.map((o) => [o._id.toString(), { name: o.name, code: o.code }]));
  const paymentRows = payments.map((payment) => ({
    id: payment._id.toString(),
    receiptNumber: payment.receiptNumber,
    officeId: payment.officeId.toString(),
    officeName: payment.officeName,
    officeCode: payment.officeCode,
    periodStart: payment.periodStart.toISOString(),
    periodEnd: payment.periodEnd.toISOString(),
    planName: payment.planName,
    amount: payment.amount,
    paymentDate: payment.paymentDate.toISOString(),
    method: payment.method,
    reference: payment.reference,
    receivedBy: payment.receivedBy,
    remarks: payment.remarks,
    status: payment.status,
    hasReceipt: !!payment.receipt,
  }));
  const now = new Date();
  const exemptionRows = exemptions.map((exemption) => ({
    id: exemption._id.toString(),
    officeId: exemption.officeId.toString(),
    officeName: officeNames.get(exemption.officeId.toString())?.name ?? "—",
    scope: exemption.scope,
    from: exemption.from.toISOString(),
    until: exemption.until.toISOString(),
    reason: exemption.reason,
    remarks: exemption.remarks,
    grantedBy: exemption.grantedBy,
    grantedAt: exemption.grantedAt.toISOString(),
    status: exemption.status === "active"
      ? exemption.until < now ? "expired" as const : exemption.from > now ? "scheduled" as const : "active" as const
      : exemption.status,
  }));
  return {
    offices: officeRows,
    plans: plans.map((plan) => ({
      id: plan._id.toString(),
      name: plan.name,
      periodLabel: plan.periodLabel,
      periodDays: plan.periodDays,
      amount: plan.amount,
      effectiveFrom: plan.effectiveFrom.toISOString(),
      status: plan.status,
      officeType: plan.officeType,
      terms: plan.terms,
    })),
    payments: paymentRows,
    exemptions: exemptionRows,
    settings,
    outstanding: officeRows.filter((office) => ["expired", "not_subscribed"].includes(office.subscriptionStatus)),
  };
}

export function getOfficeSubscriptionStatus(office?: Pick<OfficeDoc, "subscription"> | null): SubscriptionStatus {
  return resolveSubscription(office?.subscription).status;
}
