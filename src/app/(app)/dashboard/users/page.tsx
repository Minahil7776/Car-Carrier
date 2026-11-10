import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ObjectId, type Filter } from "mongodb";
import { can, getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";
import { getManagedOffices } from "@/lib/user-management";
import type { OfficeDoc, RoleDoc, UserDoc, UserStatus } from "@/lib/types";
import { Pill } from "@/components/ui/pill";
import { UserStatusButton } from "@/components/dashboard/user-status-button";

export const metadata: Metadata = { title: "Users" };
export const dynamic = "force-dynamic";
const PAGE_SIZE = 25;

function esc(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export default async function UsersPage({ searchParams }: {
  searchParams: Promise<{ q?: string; status?: string; office?: string; page?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user || !can(user, "user.view")) redirect("/dashboard");

  const params = await searchParams;
  const q = (params.q ?? "").trim().slice(0, 80);
  const status: UserStatus | "" = params.status === "active" || params.status === "suspended" ? params.status : "";
  const page = Math.max(1, Math.floor(Number(params.page)) || 1);
  const db = await getDb();
  const offices = await getManagedOffices(db, user);
  const officeIds = offices.map((office) => new ObjectId(office.id));
  const officeFilter: Filter<UserDoc> = user.scope === "system"
    ? { $or: [{ officeId: { $in: officeIds } }, { officeId: null }] }
    : { officeId: { $in: officeIds } };
  const filters: Filter<UserDoc>[] = [officeFilter];
  if (q) filters.push({
    $or: [
      { name: { $regex: esc(q), $options: "i" } },
      { email: { $regex: esc(q), $options: "i" } },
    ],
  });
  const selectedOffice = offices.some((office) => office.id === params.office) ? new ObjectId(params.office) : null;
  if (selectedOffice) filters.push({ officeId: selectedOffice });
  const baseFilter: Filter<UserDoc> = { $and: filters };
  const query: Filter<UserDoc> = status ? { $and: [baseFilter, { status }] } : baseFilter;
  const users = db.collection<UserDoc>("users");
  const [total, rows, allRoles, activeCount, suspendedCount] = await Promise.all([
    users.countDocuments(query),
    users.find(query).sort({ name: 1 }).skip((page - 1) * PAGE_SIZE).limit(PAGE_SIZE).toArray(),
    db.collection<RoleDoc>("roles").find({}).toArray(),
    users.countDocuments({ $and: [baseFilter, { status: "active" }] }),
    users.countDocuments({ $and: [baseFilter, { status: "suspended" }] }),
  ]);
  const roleKeys = [...new Set(rows.flatMap((row) => row.roleKeys))];
  const roleMap = new Map(allRoles.filter((role) => roleKeys.includes(role.key)).map((role) => [role.key, role]));
  const headIds = [...new Set(allRoles.flatMap((role) => role.headOfficeId ? [role.headOfficeId] : []))];
  const heads = headIds.length ? await db.collection<OfficeDoc>("offices").find({ _id: { $in: headIds } }).toArray() : [];
  const headNames = new Map(heads.map((head) => [head._id.toString(), head.name]));
  const allUsers = rows.map((row) => ({
    row,
    office: offices.find((office) => office.id === row.officeId?.toString()),
    roles: row.roleKeys.map((key) => roleMap.get(key)).filter((role): role is RoleDoc => Boolean(role)),
  }));
  const createAllowed = can(user, "user.create") && user.access.level === "allowed";
  const updateAllowed = can(user, "user.update") && user.access.level === "allowed";
  const statusAllowed = can(user, "user.suspend") && user.access.level === "allowed";
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
          <p className="mt-1 text-sm text-muted">
            {user.scope === "system" ? "Manage user accounts across all offices." : `Manage users within ${user.headOffice?.name ?? user.office?.name}.`}
          </p>
        </div>
        {createAllowed && <Link href="/dashboard/users/new" className="btn-primary h-10 px-4">Add user</Link>}
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        <div className="card p-4"><p className="text-sm text-muted">Users in this view</p><p className="mt-1 text-2xl font-semibold">{total}</p></div>
        <div className="card p-4"><p className="text-sm text-muted">Active accounts</p><p className="mt-1 text-2xl font-semibold">{activeCount}</p></div>
        <div className="card p-4"><p className="text-sm text-muted">Suspended accounts</p><p className="mt-1 text-2xl font-semibold">{suspendedCount}</p></div>
      </section>

      <form method="get" className="card grid gap-3 p-4 sm:grid-cols-[minmax(200px,1fr)_180px_220px_auto]">
        <input name="q" defaultValue={q} placeholder="Search name or email" className="input h-10" />
        <select name="status" defaultValue={status} className="input h-10">
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
        </select>
        <select name="office" defaultValue={selectedOffice?.toString() ?? ""} className="input h-10">
          <option value="">All offices</option>
          {offices.map((office) => <option key={office.id} value={office.id}>{office.name}</option>)}
        </select>
        <button type="submit" className="btn-outline h-10">Apply filters</button>
      </form>

      <section className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div><h2 className="text-sm font-semibold">Accounts</h2><p className="mt-1 text-xs text-muted">{total} result{total === 1 ? "" : "s"}</p></div>
        </div>
        {allUsers.length ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[780px] text-sm">
                <thead><tr className="border-b border-line bg-raised text-left text-xs text-muted">
                  <th className="px-5 py-3 font-medium">User</th>
                  <th className="px-3 py-3 font-medium">Office</th>
                  <th className="px-3 py-3 font-medium">Roles</th>
                  <th className="px-3 py-3 font-medium">Last sign-in</th>
                  <th className="px-3 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr></thead>
                <tbody className="divide-y divide-line">
                  {allUsers.map(({ row, office, roles }) => {
                    const self = row._id.toString() === user.id;
                    return (
                      <tr key={row._id.toString()} className="hover:bg-raised/60">
                        <td className="px-5 py-3">
                          <p className="font-medium">{row.name}{self && <span className="ml-2 text-xs text-muted">You</span>}</p>
                          <p className="mt-0.5 text-xs text-muted">{row.email}</p>
                        </td>
                        <td className="px-3 py-3">
                          {office ? <><p>{office.name}</p><p className="mt-0.5 text-xs text-muted">{office.type === "head" ? "Head office" : office.headOfficeName}</p></> : <span className="text-muted">System</span>}
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex max-w-[280px] flex-wrap gap-1.5">
                            {roles.length ? roles.map((role) => (
                              <Pill key={role.key} tone={role.status === "inactive" ? "neutral" : "brand"} dot={false}>
                                {role.name}{role.status === "inactive" ? " · inactive" : ""}
                              </Pill>
                            )) : <span className="text-xs text-muted">No role assigned</span>}
                          </div>
                        </td>
                        <td className="px-3 py-3 text-muted">
                          {row.lastLoginAt ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(row.lastLoginAt) : "Never"}
                        </td>
                        <td className="px-3 py-3"><Pill tone={row.status === "active" ? "ok" : "warn"}>{row.status === "active" ? "Active" : "Suspended"}</Pill></td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            {updateAllowed && office && <Link href={`/dashboard/users/${row._id.toString()}/edit`} className="btn-ghost h-8 px-2.5 text-xs">Edit</Link>}
                            {statusAllowed && office && !self && <UserStatusButton id={row._id.toString()} status={row.status} />}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {pages > 1 && <div className="flex items-center justify-between border-t border-line px-5 py-3 text-sm">
              <span className="text-muted">Page {page} of {pages}</span>
              <div className="flex gap-2">
                {page > 1 && <Link href={pageHref(page - 1, { q, status, office: params.office })} className="btn-outline h-8">Previous</Link>}
                {page < pages && <Link href={pageHref(page + 1, { q, status, office: params.office })} className="btn-outline h-8">Next</Link>}
              </div>
            </div>}
          </>
        ) : <p className="p-8 text-center text-sm text-muted">No users match these filters.</p>}
      </section>
    </div>
  );
}

function pageHref(page: number, params: { q: string; status: string; office?: string }) {
  const query = new URLSearchParams({ page: String(page) });
  if (params.q) query.set("q", params.q);
  if (params.status) query.set("status", params.status);
  if (params.office) query.set("office", params.office);
  return `/dashboard/users?${query.toString()}`;
}
