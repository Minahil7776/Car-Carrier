import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { can, getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";
import { getManagedOffices } from "@/lib/user-management";
import { RoleForm } from "@/components/dashboard/role-form";

export const metadata: Metadata = { title: "Create role" };
export const dynamic = "force-dynamic";

export default async function NewRolePage() {
  const user = await getCurrentUser();
  if (!user || !can(user, "role.create") || user.access.level !== "allowed") redirect("/dashboard/roles");
  const db = await getDb();
  const offices = (await getManagedOffices(db, user))
    .filter((office) => office.type === "head")
    .map(({ id, name, code }) => ({ id, name, code }));

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header>
        <Link href="/dashboard/roles" className="text-sm text-muted hover:text-ink">Roles and permissions</Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Create custom role</h1>
        <p className="mt-1 text-sm text-muted">Define what this role can do and which office-level users can receive it.</p>
      </header>
      {offices.length
        ? <RoleForm mode="create" offices={offices} />
        : <div className="card p-6 text-sm text-muted">No head offices are available within your organizational scope.</div>}
    </div>
  );
}
