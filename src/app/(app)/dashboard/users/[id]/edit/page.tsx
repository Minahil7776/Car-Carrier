import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ObjectId } from "mongodb";
import { can, getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";
import { getAssignableRoles, getManagedOffices, toManagedRole } from "@/lib/user-management";
import type { RoleDoc, UserDoc } from "@/lib/types";
import { UserForm } from "@/components/dashboard/user-form";

export const metadata: Metadata = { title: "Edit user" };
export const dynamic = "force-dynamic";

export default async function EditUserPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !can(user, "user.update") || user.access.level !== "allowed") redirect("/dashboard/users");
  const { id } = await params;
  if (!ObjectId.isValid(id)) notFound();

  const db = await getDb();
  const offices = await getManagedOffices(db, user);
  const officeIds = offices.map((office) => new ObjectId(office.id));
  const target = await db.collection<UserDoc>("users").findOne({
    _id: new ObjectId(id),
    officeId: { $in: officeIds },
  });
  if (!target?.officeId) notFound();
  const office = offices.find((item) => item.id === target.officeId!.toString());
  if (!office) notFound();

  const [activeRoles, assignedRoles] = await Promise.all([
    getAssignableRoles(db, office.type, office.headOfficeId),
    db.collection<RoleDoc>("roles").find({ key: { $in: target.roleKeys } }).toArray(),
  ]);
  const roleMap = new Map([...activeRoles, ...assignedRoles].map((role) => [role.key, role]));
  const roles = [...roleMap.values()]
    .filter((role) => role.scope === office.type && (!role.isCustom || role.headOfficeId?.toString() === office.headOfficeId))
    .map((role) => toManagedRole(role, office.headOfficeName));

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <Link href="/dashboard/users" className="text-sm text-muted hover:text-ink">Users</Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Edit user</h1>
        <p className="mt-1 text-sm text-muted">Update the user's name and assigned roles. The office and login email stay unchanged.</p>
      </header>
      <UserForm
        mode="edit"
        userId={id}
        offices={[office]}
        roles={roles}
        canEditRoles={target._id.toString() !== user.id}
        defaults={{ name: target.name, email: target.email, officeId: office.id, roleKeys: target.roleKeys }}
      />
    </div>
  );
}
