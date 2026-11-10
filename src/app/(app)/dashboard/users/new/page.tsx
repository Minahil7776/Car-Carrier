import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { can, getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";
import { getAssignableRoles, getManagedOffices, toManagedRole } from "@/lib/user-management";
import { UserForm } from "@/components/dashboard/user-form";

export const metadata: Metadata = { title: "Add user" };
export const dynamic = "force-dynamic";

export default async function NewUserPage() {
  const user = await getCurrentUser();
  if (!user || !can(user, "user.create") || user.access.level !== "allowed") redirect("/dashboard/users");

  const db = await getDb();
  const offices = await getManagedOffices(db, user);
  const roleSets = await Promise.all(offices.map((office) => getAssignableRoles(db, office.type, office.headOfficeId)));
  const rolesByKey = new Map(roleSets.flat().map((role) => [role.key, role]));
  const roles = [...rolesByKey.values()].map((role) => {
    const office = offices.find((item) => item.headOfficeId === role.headOfficeId?.toString());
    return toManagedRole(role, office?.headOfficeName ?? null);
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <Link href="/dashboard/users" className="text-sm text-muted hover:text-ink">Users</Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Add user</h1>
        <p className="mt-1 text-sm text-muted">Create an account, associate it with an office, and assign its roles.</p>
      </header>
      {!offices.length
        ? <div className="card p-6 text-sm text-muted">No offices are available within your organizational scope.</div>
        : <UserForm mode="create" offices={offices} roles={roles} />}
    </div>
  );
}
