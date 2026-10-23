import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getBranchData, getHeadOfficeData, getSuperAdminData } from "@/lib/dashboard-data";
import { getDb } from "@/lib/mongodb";
import type { RoleDoc } from "@/lib/types";
import { PageHeader } from "@/components/dashboard/page-header";
import { SuperAdminView } from "@/components/dashboard/super-admin-view";
import { HeadOfficeView } from "@/components/dashboard/head-office-view";
import { BranchView } from "@/components/dashboard/branch-view";

export const metadata: Metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/logout");

  // The data scope comes from the signed-in user's office, never from the URL or request.
  if (user.scope === "system") {
    const data = await getSuperAdminData();
    return (
      <>
        <PageHeader name={user.name} scopeLabel="System administrator" subtitle={data.kpis.pending ? `${data.kpis.pending} registration${data.kpis.pending === 1 ? " needs" : "s need"} your attention.` : "Everything is up to date."} />
        <SuperAdminView data={data} />
      </>
    );
  }

  if (user.scope === "head" && user.office) {
    const data = await getHeadOfficeData(user.office.id);
    return (
      <>
        <PageHeader name={user.name} scopeLabel="Head office" subtitle={`${user.office.name} at a glance.`} />
        <HeadOfficeView data={data} />
      </>
    );
  }

  if (user.office) {
    const db = await getDb();
    const roles = await db.collection<RoleDoc>("roles").find({}).toArray();
    const data = await getBranchData(user.office.id);
    return (
      <>
        <PageHeader name={user.name} scopeLabel="Branch" subtitle={`${user.office.name}${user.headOffice ? `, part of ${user.headOffice.name}` : ""}.`} />
        <BranchView data={data} roleLabels={Object.fromEntries(roles.map((r) => [r.key, r.name]))} />
      </>
    );
  }

  redirect("/logout");
}
