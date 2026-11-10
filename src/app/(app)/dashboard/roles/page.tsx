import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ObjectId } from "mongodb";
import { can, getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";
import { toManagedRole } from "@/lib/user-management";
import type { OfficeDoc, RoleDoc } from "@/lib/types";
import { Pill } from "@/components/ui/pill";
import { RoleStatusButton } from "@/components/dashboard/role-status-button";

export const metadata: Metadata = { title: "Roles and permissions" };
export const dynamic = "force-dynamic";

export default async function RolesPage() {
  const user = await getCurrentUser();
  if (!user || !can(user, "role.view")) redirect("/dashboard");
  const db = await getDb();

  let filter: Record<string, unknown>;
  if (user.scope === "system") {
    filter = {};
  } else {
    const headOfficeId = user.headOffice?.id ?? user.office?.id;
    if (!headOfficeId) redirect("/dashboard");
    filter = {
      $or: [
        { isCustom: { $ne: true }, scope: user.scope === "head" ? { $in: ["head", "branch"] } : "branch" },
        { isCustom: true, headOfficeId: new ObjectId(headOfficeId) },
      ],
    };
  }

  const roles = await db.collection<RoleDoc>("roles").find(filter).sort({ scope: 1, name: 1 }).toArray();
  const headIds = [...new Set(roles.flatMap((role) => role.headOfficeId ? [role.headOfficeId] : []))];
  const heads = headIds.length ? await db.collection<OfficeDoc>("offices").find({ _id: { $in: headIds } }).toArray() : [];
  const headNames = new Map(heads.map((head) => [head._id.toString(), head.name]));
  const createAllowed = can(user, "role.create") && user.access.level === "allowed";
  const updateAllowed = can(user, "role.update") && user.access.level === "allowed";

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Roles and permissions</h1>
          <p className="mt-1 text-sm text-muted">Roles combine permissions. Users can hold multiple roles within their office scope.</p>
        </div>
        {createAllowed && <Link href="/dashboard/roles/new" className="btn-primary h-10 px-4">Create role</Link>}
      </header>

      <section className="card overflow-hidden">
        <div className="border-b border-line px-5 py-4">
          <h2 className="text-sm font-semibold">Available roles</h2>
          <p className="mt-1 text-xs text-muted">{roles.length} role{roles.length === 1 ? "" : "s"} in your organizational scope</p>
        </div>
        {roles.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead><tr className="border-b border-line bg-raised text-left text-xs text-muted">
                <th className="px-5 py-3 font-medium">Role</th>
                <th className="px-3 py-3 font-medium">Organization</th>
                <th className="px-3 py-3 font-medium">Scope</th>
                <th className="px-3 py-3 font-medium">Permissions</th>
                <th className="px-3 py-3 font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr></thead>
              <tbody className="divide-y divide-line">
                {roles.map((role) => {
                  const data = toManagedRole(role, role.headOfficeId ? headNames.get(role.headOfficeId.toString()) ?? null : null);
                  return (
                    <tr key={role.key} className="hover:bg-raised/60">
                      <td className="px-5 py-3">
                        <p className="font-medium">{role.name}</p>
                        <p className="mt-0.5 text-xs text-muted">{role.description || (data.isCustom ? "Custom role" : "Built-in role")}</p>
                      </td>
                      <td className="px-3 py-3 text-muted">{data.headOfficeName ?? (role.scope === "system" ? "System" : "Built-in")}</td>
                      <td className="px-3 py-3">{role.scope === "system" ? "System" : role.scope === "head" ? "Head office" : "Branch"}</td>
                      <td className="px-3 py-3">{role.permissions.includes("*") ? "All permissions" : `${role.permissions.length} permission${role.permissions.length === 1 ? "" : "s"}`}</td>
                      <td className="px-3 py-3"><Pill tone={data.status === "active" ? "ok" : "neutral"}>{data.status === "active" ? "Active" : "Inactive"}</Pill></td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {data.isCustom && updateAllowed && <Link href={`/dashboard/roles/${encodeURIComponent(role.key)}/edit`} className="btn-ghost h-8 px-2.5 text-xs">Edit</Link>}
                          {data.isCustom && updateAllowed && <RoleStatusButton roleKey={role.key} status={data.status} />}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : <p className="p-8 text-center text-sm text-muted">No roles are available in this scope.</p>}
      </section>
    </div>
  );
}
