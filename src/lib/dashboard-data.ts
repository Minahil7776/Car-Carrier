import "server-only";
import { ObjectId, type Filter } from "mongodb";
import { getDb } from "./mongodb";
import { resolveSubscription } from "./subscription";
import type {
  AuditLogDoc,
  OfficeDoc,
  OfficeStatus,
  RegistrationDoc,
  SubscriptionStatus,
  UserDoc,
} from "./types";

/* ---------- Serializable shapes passed to client components ---------- */

export interface ActivityItem {
  id: string;
  actor: string;
  summary: string;
  action: string;
  at: string;
}

export interface SubscriptionSummary {
  status: SubscriptionStatus;
  expiresAt: string | null;
  exemptUntil: string | null;
  daysLeft: number | null;
}

export interface OrgRow {
  id: string;
  code: string;
  name: string;
  city: string;
  status: OfficeStatus;
  branchCount: number;
  userCount: number;
  branches: { id: string; code: string; name: string; city: string; status: OfficeStatus }[];
}

export interface RegistrationRow {
  id: string;
  kind: "head" | "branch";
  officeName: string;
  applicantName: string;
  city: string;
  documentsCount: number;
  status: RegistrationDoc["status"];
  submittedAt: string;
}

export interface SuperAdminData {
  kpis: { organizations: number; branches: number; users: number; pending: number };
  statusBreakdown: { status: OfficeStatus; count: number }[];
  subscriptionBreakdown: { status: SubscriptionStatus; count: number }[];
  registrationTrend: { label: string; value: number }[];
  pending: RegistrationRow[];
  organizations: OrgRow[];
  activity: ActivityItem[];
}

export interface HeadOfficeData {
  kpis: { branches: number; activeBranches: number; users: number; pendingBranches: number };
  subscription: SubscriptionSummary;
  branches: (OrgRow["branches"][number] & { userCount: number })[];
  pending: RegistrationRow[];
  activity: ActivityItem[];
}

export interface BranchData {
  office: { code: string; name: string; city: string; province: string | null; status: OfficeStatus };
  headOffice: { name: string; code: string } | null;
  subscription: SubscriptionSummary;
  team: { id: string; name: string; email: string; status: "active" | "suspended"; roleKeys: string[]; lastLoginAt: string | null }[];
  activity: ActivityItem[];
}

/* ---------- Helpers ---------- */

const iso = (d?: Date | null) => (d ? d.toISOString() : null);

function toActivity(rows: AuditLogDoc[]): ActivityItem[] {
  return rows.map((r) => ({
    id: r._id.toString(),
    actor: r.userName,
    summary: r.summary,
    action: r.action,
    at: r.createdAt.toISOString(),
  }));
}

function toRegistration(r: RegistrationDoc): RegistrationRow {
  return {
    id: r._id.toString(),
    kind: r.kind,
    officeName: r.officeName,
    applicantName: r.applicantName,
    city: r.city,
    documentsCount: r.documentsCount,
    status: r.status,
    submittedAt: r.submittedAt.toISOString(),
  };
}

function toSubscription(sub: OfficeDoc["subscription"] | undefined): SubscriptionSummary {
  const { status, daysLeft } = resolveSubscription(sub);
  return { status, daysLeft, expiresAt: iso(sub?.expiresAt), exemptUntil: iso(sub?.exemptUntil) };
}

const OPEN_REGISTRATION = { $in: ["pending", "under_review", "info_required"] } as const;

function lastSixMonths() {
  const now = new Date();
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (5 - i), 1));
    return { key: `${d.getUTCFullYear()}-${d.getUTCMonth()}`, start: d, label: d.toLocaleString("en", { month: "short", timeZone: "UTC" }) };
  });
}

/* ---------- Super Administrator ---------- */

export async function getSuperAdminData(): Promise<SuperAdminData> {
  const db = await getDb();
  const offices = db.collection<OfficeDoc>("offices");
  const regs = db.collection<RegistrationDoc>("registrations");
  const months = lastSixMonths();

  const [orgs, branches, users, pending, statusAgg, subDocs, trendAgg, pendingRows, headOffices, activity] =
    await Promise.all([
      offices.countDocuments({ type: "head" }),
      offices.countDocuments({ type: "branch" }),
      db.collection<UserDoc>("users").countDocuments({}),
      regs.countDocuments({ status: OPEN_REGISTRATION }),
      offices.aggregate<{ _id: OfficeStatus; count: number }>([{ $group: { _id: "$status", count: { $sum: 1 } } }]).toArray(),
      // Status is derived from dates, so fetch only the fields needed. Fine into the tens of thousands of offices.
      offices.find({ status: "active" }, { projection: { subscription: 1 } }).toArray(),
      regs
        .aggregate<{ _id: { y: number; m: number }; count: number }>([
          { $match: { submittedAt: { $gte: months[0].start } } },
          { $group: { _id: { y: { $year: "$submittedAt" }, m: { $month: "$submittedAt" } }, count: { $sum: 1 } } },
        ])
        .toArray(),
      regs.find({ status: OPEN_REGISTRATION }).sort({ submittedAt: 1 }).limit(5).toArray(),
      offices.find({ type: "head" }).sort({ createdAt: -1 }).limit(6).toArray(),
      db.collection<AuditLogDoc>("audit_logs").find({}).sort({ createdAt: -1 }).limit(8).toArray(),
    ]);

  const subCounts = new Map<SubscriptionStatus, number>();
  for (const o of subDocs) {
    const { status } = resolveSubscription(o.subscription);
    subCounts.set(status, (subCounts.get(status) ?? 0) + 1);
  }

  const trendMap = new Map(trendAgg.map((t) => [`${t._id.y}-${t._id.m - 1}`, t.count]));

  // Organization tree: head offices with their branches and user counts
  const ids = headOffices.map((h) => h._id);
  const [branchDocs, userCounts] = await Promise.all([
    offices.find({ parentId: { $in: ids } }).sort({ city: 1 }).toArray(),
    db
      .collection<UserDoc>("users")
      .aggregate<{ _id: ObjectId; count: number }>([
        { $match: { officeId: { $ne: null } } },
        { $lookup: { from: "offices", localField: "officeId", foreignField: "_id", as: "o" } },
        { $unwind: "$o" },
        { $group: { _id: { $ifNull: ["$o.parentId", "$o._id"] }, count: { $sum: 1 } } },
        { $match: { _id: { $in: ids } } },
      ])
      .toArray(),
  ]);
  const userByHead = new Map(userCounts.map((u) => [u._id.toString(), u.count]));

  return {
    kpis: { organizations: orgs, branches, users, pending },
    statusBreakdown: statusAgg.map((s) => ({ status: s._id, count: s.count })),
    subscriptionBreakdown: (["active", "expiring_soon", "expired", "exempt"] as SubscriptionStatus[]).map((status) => ({
      status,
      count: subCounts.get(status) ?? 0,
    })),
    registrationTrend: months.map((m) => ({ label: m.label, value: trendMap.get(m.key) ?? 0 })),
    pending: pendingRows.map(toRegistration),
    organizations: headOffices.map((h) => {
      const bs = branchDocs.filter((b) => b.parentId?.equals(h._id));
      return {
        id: h._id.toString(),
        code: h.code,
        name: h.name,
        city: h.city,
        status: h.status,
        branchCount: bs.length,
        userCount: userByHead.get(h._id.toString()) ?? 0,
        branches: bs.map((b) => ({ id: b._id.toString(), code: b.code, name: b.name, city: b.city, status: b.status })),
      };
    }),
    activity: toActivity(activity),
  };
}

/* ---------- Head Office ---------- */

export async function getHeadOfficeData(headOfficeId: string): Promise<HeadOfficeData> {
  const db = await getDb();
  const hid = new ObjectId(headOfficeId);
  const offices = db.collection<OfficeDoc>("offices");

  const [head, branchDocs, pendingRows, activity] = await Promise.all([
    offices.findOne({ _id: hid }),
    offices.find({ parentId: hid }).sort({ city: 1 }).toArray(),
    db
      .collection<RegistrationDoc>("registrations")
      .find({ parentId: hid, status: OPEN_REGISTRATION })
      .sort({ submittedAt: 1 })
      .limit(5)
      .toArray(),
    // Tenant isolation: audit rows are filtered by headOfficeId, never by client input
    db.collection<AuditLogDoc>("audit_logs").find({ headOfficeId: hid }).sort({ createdAt: -1 }).limit(8).toArray(),
  ]);

  const officeIds = [hid, ...branchDocs.map((b) => b._id)];
  const counts = await db
    .collection<UserDoc>("users")
    .aggregate<{ _id: ObjectId; count: number }>([
      { $match: { officeId: { $in: officeIds } } },
      { $group: { _id: "$officeId", count: { $sum: 1 } } },
    ])
    .toArray();
  const byOffice = new Map(counts.map((c) => [c._id.toString(), c.count]));
  const totalUsers = counts.reduce((n, c) => n + c.count, 0);

  return {
    kpis: {
      branches: branchDocs.length,
      activeBranches: branchDocs.filter((b) => b.status === "active").length,
      users: totalUsers,
      pendingBranches: pendingRows.length,
    },
    subscription: toSubscription(head?.subscription),
    branches: branchDocs.map((b) => ({
      id: b._id.toString(),
      code: b.code,
      name: b.name,
      city: b.city,
      status: b.status,
      userCount: byOffice.get(b._id.toString()) ?? 0,
    })),
    pending: pendingRows.map(toRegistration),
    activity: toActivity(activity),
  };
}

/* ---------- Branch ---------- */

export async function getBranchData(branchId: string): Promise<BranchData> {
  const db = await getDb();
  const bid = new ObjectId(branchId);
  const offices = db.collection<OfficeDoc>("offices");
  const branch = await offices.findOne({ _id: bid });
  if (!branch) throw new Error("Branch not found");
  const head = branch.parentId ? await offices.findOne({ _id: branch.parentId }) : null;

  const userFilter: Filter<UserDoc> = { officeId: bid };
  const [team, activity] = await Promise.all([
    db.collection<UserDoc>("users").find(userFilter).sort({ name: 1 }).limit(8).toArray(),
    db.collection<AuditLogDoc>("audit_logs").find({ officeId: bid }).sort({ createdAt: -1 }).limit(8).toArray(),
  ]);

  return {
    office: {
      code: branch.code,
      name: branch.name,
      city: branch.city,
      province: branch.province ?? null,
      status: branch.status,
    },
    headOffice: head ? { name: head.name, code: head.code } : null,
    subscription: toSubscription(branch.subscription ?? head?.subscription),
    team: team.map((u) => ({
      id: u._id.toString(),
      name: u.name,
      email: u.email,
      status: u.status,
      roleKeys: u.roleKeys,
      lastLoginAt: iso(u.lastLoginAt),
    })),
    activity: toActivity(activity),
  };
}

export async function getUnreadNotifications(userId: string) {
  const db = await getDb();
  const rows = await db
    .collection<{ userId: ObjectId; title: string; body: string; read: boolean; createdAt: Date }>("notifications")
    .find({ userId: new ObjectId(userId) })
    .sort({ createdAt: -1 })
    .limit(6)
    .toArray();
  return rows.map((n) => ({
    id: n._id.toString(),
    title: n.title,
    body: n.body,
    read: n.read,
    at: n.createdAt.toISOString(),
  }));
}
