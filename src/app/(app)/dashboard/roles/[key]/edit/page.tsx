import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { can, getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";
import { getManagedOffices, isManagedRole } from "@/lib/user-management";
import type { RoleDoc } from "@/lib/types";
import { RoleForm } from "@/components/dashboard/role-form";

export const metadata: Metadata = { title: "Edit role" };
export const dynamic = "force-dynamic";

export default async function EditRolePage({ params }: { params: Promise<{ key: string }> }) {
  const user = await getCurrentUser();
  if (!user || !can(user, "role.update") || user.access.level !== "allowed") redirect("/dashboard/roles");
  const { key } = await params;
  const db = await getDb();
  const role = await db.collection<RoleDoc>("roles").findOne({ key, isCustom: true });
  if (!role || !isManagedRole(user, role) || !role.headOfficeId) notFound();

  const offices = (await getManagedOffices(db, user))
    .filter((office) => office.type === "head")
    .map(({ id, name, code }) => ({ id, name, code }));
  const office = offices.find((item) => item.id === role.headOfficeId?.toString());
  if (!office) notFound();

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header>
        <Link href="/dashboard/roles" className="text-sm text-muted hover:text-ink">Roles and permissions</Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Edit {role.name}</h1>
        <p className="mt-1 text-sm text-muted">Changes to permissions apply to every user assigned this role.</p>
      </header>
      <RoleForm
        mode="edit"
        offices={offices}
        defaults={{
          key: role.key,
          name: role.name,
          description: role.description ?? "",
          scope: role.scope === "head" ? "head" : "branch",
          officeId: office.id,
          permissions: role.permissions,
        }}
      />
    </div>
  );
}
