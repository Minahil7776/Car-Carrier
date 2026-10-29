import "server-only";
import { ObjectId, type Filter } from "mongodb";
import { getDb } from "./mongodb";
import { resolveSubscription } from "./subscription";
import { effectiveSubscription } from "./subscription-management";
import { OFFICE_SORTS, PAGE_SIZE, type OfficeSort } from "./office-schema";
import type { OfficeDoc, OfficeStatus, OfficeStatusHistoryDoc, RoleDoc, SubscriptionStatus, UserDoc } from "./types";

/* ---------- Shapes passed to pages and client components ---------- */

export interface ListParams { q?: string; status?: string; city?: string; head?: string; sort?: string; page?: string }
export interface Paged<T> { rows: T[]; total: number; page: number; pages: number; cities: string[] }

export interface OrgListRow {
  id: string; code: string; name: string; city: string; province: string | null; status: OfficeStatus; createdAt: string;
  branchCount: number; userCount: number; subscription: SubscriptionStatus;
  branches: { id: string; code: string; name: string; city: string; status: OfficeStatus; userCount: number }[];
}
export interface BranchListRow {
  id: string; code: string; name: string; city: string; status: OfficeStatus; managerName: string | null; createdAt: string;
  userCount: number; headOffice: { id: string; name: string; code: string; status: OfficeStatus };
}
export interface HistoryRow { id: string; from: OfficeStatus | null; to: OfficeStatus; reason: string; by: string; at: string }

export interface OrgDetail {
  id: string; code: string; name: string; legalName: string | null; ntn: string | null; salesTaxNumber: string | null; companyRegNumber: string | null;
  registeredAddress: string | null; operationalAddress: string | null; city: string; province: string | null; country: string;
  officePhone: string | null; officeEmail: string | null; website: string | null; status: OfficeStatus; statusReason: string | null; createdAt: string;
  contact: { name: string | null; designation: string | null; email: string | null; phone: string | null };
  subscription: { status: SubscriptionStatus; expiresAt: string | null; exemptUntil: string | null; daysLeft: number | null };
  userCount: number;
  branches: OrgListRow["branches"];
  history: HistoryRow[];
}
export interface BranchDetail {
  id: string; code: string; branchCode: string | null; name: string; address: string | null; city: string; province: string | null; country: string;
  contactPhone: string | null; email: string | null; managerName: string | null; managerEmail: string | null; managerPhone: string | null;
  openingDate: string | null; notes: string | null; status: OfficeStatus; statusReason: string | null; createdAt: string;
  headOffice: { id: string; name: string; code: string; status: OfficeStatus };
  subscription: { status: SubscriptionStatus; expiresAt: string | null; exemptUntil: string | null; daysLeft: number | null };
  team: { id: string; name: string; email: string; status: "active" | "suspended"; roles: string[] }[];
  teamCount: number;
  history: HistoryRow[];
}

/* ---------- Helpers ---------- */

const iso = (d?: Date | null) => (d ? d.toISOString() : null);
const escapeRx = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const STATUSES = ["active", "pending", "suspended", "blocked", "closed"];

function parseParams(p: ListParams) {
  const q = (p.q ?? "").trim().slice(0, 80);
  const status = STATUSES.includes(p.status ?? "") ? (p.status as OfficeStatus) : undefined;
  const sort: OfficeSort = OFFICE_SORTS.find((s) => s.value === p.sort)?.value ?? "name";
  const page = Math.max(1, Math.floor(Number(p.page)) || 1);
  return { q, rx: q ? new RegExp(escapeRx(q), "i") : null, status, city: (p.city ?? "").trim().slice(0, 60) || undefined, sort, page };
}
const sortSpec = (s: OfficeSort): Record<string, 1 | -1> => (s === "newest" ? { createdAt: -1 } : s === "city" ? { city: 1, name: 1 } : { name: 1 });

async function userCountsByOffice(ids: ObjectId[]) {
  if (!ids.length) return new Map<string, number>();
  const db = await getDb();
  const rows = await db.collection<UserDoc>("users")
    .aggregate<{ _id: ObjectId; count: number }>([{ $match: { officeId: { $in: ids } } }, { $group: { _id: "$officeId", count: { $sum: 1 } } }])
    .toArray();
  return new Map(rows.map((r) => [r._id.toString(), r.count]));
}

async function historyFor(officeId: ObjectId): Promise<HistoryRow[]> {
  const db = await getDb();
  const rows = await db.collection<OfficeStatusHistoryDoc>("office_status_history").find({ officeId }).sort({ at: -1 }).limit(25).toArray();
  return rows.map((h) => ({ id: h._id.toString(), from: h.from, to: h.to, reason: h.reason, by: h.byName, at: h.at.toISOString() }));
}

/* ---------- Organizations (Super Administrator) ---------- */

export async function listOrganizations(params: ListParams): Promise<Paged<OrgListRow>> {
  const { rx, status, city, sort, page } = parseParams(params);
  const db = await getDb();
  const offices = db.collection<OfficeDoc>("offices");

  // A branch match should surface its head office, so the tree can open to it.
  let viaBranch: ObjectId[] = [];
  if (rx) {
    const hits = await offices.find({ type: "branch", $or: [{ name: rx }, { city: rx }, { code: rx }] }, { projection: { parentId: 1 } }).limit(500).toArray();
    viaBranch = hits.map((b) => b.parentId).filter((x): x is ObjectId => !!x);
  }
  const where: Filter<OfficeDoc> = {
    type: "head",
    ...(status ? { status } : {}),
    ...(city ? { city } : {}),
    ...(rx ? { $or: [{ name: rx }, { code: rx }, { city: rx }, { ntn: rx }, { legalName: rx }, { _id: { $in: viaBranch } }] } : {}),
  };

  const [total, heads, cities] = await Promise.all([
    offices.countDocuments(where),
    offices.find(where).sort(sortSpec(sort)).skip((page - 1) * PAGE_SIZE).limit(PAGE_SIZE).toArray(),
    offices.distinct("city", { type: "head" }),
  ]);

  const branches = heads.length ? await offices.find({ parentId: { $in: heads.map((h) => h._id) } }).sort({ city: 1, name: 1 }).toArray() : [];
  const counts = await userCountsByOffice([...heads.map((h) => h._id), ...branches.map((b) => b._id)]);

  const rows = heads.map<OrgListRow>((h) => {
    const bs = branches.filter((b) => b.parentId?.equals(h._id));
    const branchRows = bs.map((b) => ({ id: b._id.toString(), code: b.code, name: b.name, city: b.city, status: b.status, userCount: counts.get(b._id.toString()) ?? 0 }));
    return {
      id: h._id.toString(), code: h.code, name: h.name, city: h.city, province: h.province ?? null, status: h.status, createdAt: h.createdAt.toISOString(),
      branchCount: bs.length, userCount: (counts.get(h._id.toString()) ?? 0) + branchRows.reduce((n, b) => n + b.userCount, 0),
      subscription: resolveSubscription(h.subscription).status, branches: branchRows,
    };
  });
  return { rows, total, page, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)), cities: cities.sort() };
}

export async function getOrganizationDetail(id: string): Promise<OrgDetail | null> {
  if (!ObjectId.isValid(id)) return null;
  const db = await getDb();
  const offices = db.collection<OfficeDoc>("offices");
  const _id = new ObjectId(id);
  const h = await offices.findOne({ _id, type: "head" });
  if (!h) return null;

  const [branches, history, admin] = await Promise.all([
    offices.find({ parentId: _id }).sort({ city: 1, name: 1 }).toArray(),
    historyFor(_id),
    // Offices approved from a public registration don't store a contact; fall back to the administrator account.
    db.collection<UserDoc>("users").findOne({ officeId: _id, roleKeys: "ho_admin" }, { sort: { createdAt: 1 } }),
  ]);
  const counts = await userCountsByOffice([_id, ...branches.map((b) => b._id)]);
  const branchRows = branches.map((b) => ({ id: b._id.toString(), code: b.code, name: b.name, city: b.city, status: b.status, userCount: counts.get(b._id.toString()) ?? 0 }));
  const sub = resolveSubscription(h.subscription);

  return {
    id, code: h.code, name: h.name, legalName: h.legalName ?? null, ntn: h.ntn ?? null, salesTaxNumber: h.salesTaxNumber ?? null,
    companyRegNumber: h.companyRegNumber ?? null, registeredAddress: h.registeredAddress ?? null, operationalAddress: h.operationalAddress ?? null,
    city: h.city, province: h.province ?? null, country: h.country, officePhone: h.officePhone ?? null, officeEmail: h.officeEmail ?? null,
    website: h.website ?? null, status: h.status, statusReason: h.statusReason ?? null, createdAt: h.createdAt.toISOString(),
    contact: {
      name: h.contactName ?? admin?.name ?? null, designation: h.contactDesignation ?? null,
      email: h.contactEmail ?? admin?.email ?? null, phone: h.contactPhone ?? null,
    },
    subscription: { status: sub.status, daysLeft: sub.daysLeft, expiresAt: iso(h.subscription?.expiresAt), exemptUntil: iso(h.subscription?.exemptUntil) },
    userCount: (counts.get(id) ?? 0) + branchRows.reduce((n, b) => n + b.userCount, 0),
    branches: branchRows, history,
  };
}

/* ---------- Branches ---------- */

/** scopeHeadId is set for head-office users: they only ever see their own tenant. The Super Administrator passes null. */
export async function listBranches(scopeHeadId: string | null, params: ListParams): Promise<Paged<BranchListRow> & { heads: { id: string; name: string }[] }> {
  const { rx, status, city, sort, page } = parseParams(params);
  const db = await getDb();
  const offices = db.collection<OfficeDoc>("offices");

  const headFilter = scopeHeadId ? new ObjectId(scopeHeadId) : ObjectId.isValid(params.head ?? "") ? new ObjectId(params.head) : null;
  let viaHead: ObjectId[] = [];
  if (rx && !scopeHeadId) {
    const hits = await offices.find({ type: "head", name: rx }, { projection: { _id: 1 } }).limit(200).toArray();
    viaHead = hits.map((h) => h._id);
  }
  const where: Filter<OfficeDoc> = {
    type: "branch",
    ...(headFilter ? { parentId: headFilter } : {}),
    ...(status ? { status } : {}),
    ...(city ? { city } : {}),
    ...(rx ? { $or: [{ name: rx }, { code: rx }, { city: rx }, { managerName: rx }, ...(viaHead.length ? [{ parentId: { $in: viaHead } }] : [])] } : {}),
  };
  const scopeOnly: Filter<OfficeDoc> = { type: "branch", ...(scopeHeadId ? { parentId: new ObjectId(scopeHeadId) } : {}) };

  const [total, rows, cities, headDocs] = await Promise.all([
    offices.countDocuments(where),
    offices.find(where).sort(sortSpec(sort)).skip((page - 1) * PAGE_SIZE).limit(PAGE_SIZE).toArray(),
    offices.distinct("city", scopeOnly),
    scopeHeadId ? Promise.resolve([]) : offices.find({ type: "head" }, { projection: { name: 1 } }).sort({ name: 1 }).limit(500).toArray(),
  ]);

  const parentIds = [...new Map(rows.map((r) => [r.parentId!.toString(), r.parentId!])).values()];
  const [parents, counts] = await Promise.all([
    parentIds.length ? offices.find({ _id: { $in: parentIds } }).toArray() : Promise.resolve([]),
    userCountsByOffice(rows.map((r) => r._id)),
  ]);
  const parentMap = new Map(parents.map((p) => [p._id.toString(), p]));

  return {
    rows: rows.map<BranchListRow>((b) => {
      const p = parentMap.get(b.parentId!.toString());
      return {
        id: b._id.toString(), code: b.code, name: b.name, city: b.city, status: b.status, managerName: b.managerName ?? null, createdAt: b.createdAt.toISOString(),
        userCount: counts.get(b._id.toString()) ?? 0,
        headOffice: { id: b.parentId!.toString(), name: p?.name ?? "—", code: p?.code ?? "", status: p?.status ?? "active" },
      };
    }),
    total, page, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)), cities: cities.sort(),
    heads: headDocs.map((h) => ({ id: h._id.toString(), name: h.name })),
  };
}

/** Tenant isolation: a head-office user passes their own head office id, so another company's branch id returns null. */
export async function getBranchDetail(id: string, scopeHeadId: string | null): Promise<BranchDetail | null> {
  if (!ObjectId.isValid(id)) return null;
  const db = await getDb();
  const offices = db.collection<OfficeDoc>("offices");
  const _id = new ObjectId(id);
  const b = await offices.findOne({ _id, type: "branch", ...(scopeHeadId ? { parentId: new ObjectId(scopeHeadId) } : {}) });
  if (!b || !b.parentId) return null;

  const [head, users, teamCount, history, roles] = await Promise.all([
    offices.findOne({ _id: b.parentId }),
    db.collection<UserDoc>("users").find({ officeId: _id }).sort({ name: 1 }).limit(20).toArray(),
    db.collection<UserDoc>("users").countDocuments({ officeId: _id }),
    historyFor(_id),
    db.collection<RoleDoc>("roles").find({}).toArray(),
  ]);
  const roleName = new Map(roles.map((r) => [r.key, r.name]));
  const sub = resolveSubscription(effectiveSubscription(b, head));

  return {
    id, code: b.code, branchCode: b.branchCode ?? null, name: b.name, address: b.operationalAddress ?? null, city: b.city, province: b.province ?? null, country: b.country,
    contactPhone: b.officePhone ?? null, email: b.officeEmail ?? null, managerName: b.managerName ?? null, managerEmail: b.managerEmail ?? null, managerPhone: b.managerPhone ?? null,
    openingDate: iso(b.openingDate), notes: b.notes ?? null, status: b.status, statusReason: b.statusReason ?? null, createdAt: b.createdAt.toISOString(),
    headOffice: { id: b.parentId.toString(), name: head?.name ?? "—", code: head?.code ?? "", status: head?.status ?? "active" },
    subscription: {
      status: sub.status,
      expiresAt: iso(effectiveSubscription(b, head)?.expiresAt),
      exemptUntil: iso(effectiveSubscription(b, head)?.exemptUntil),
      daysLeft: sub.daysLeft,
    },
    team: users.map((u) => ({ id: u._id.toString(), name: u.name, email: u.email, status: u.status, roles: u.roleKeys.map((k) => roleName.get(k) ?? k) })),
    teamCount, history,
  };
}
