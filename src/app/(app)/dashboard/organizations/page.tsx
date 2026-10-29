import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { listOrganizations, type ListParams } from "@/lib/office-data";
import { OfficeFilters } from "@/components/dashboard/office-filters";
import { OrganizationList } from "@/components/dashboard/organization-list";
import { Pager } from "@/components/dashboard/pager";

export const metadata: Metadata = { title: "Organizations" };
export const dynamic = "force-dynamic";

export default async function OrganizationsPage({ searchParams }: { searchParams: Promise<ListParams> }) {
  const user = await getCurrentUser();
  if (!user || user.scope !== "system") redirect("/dashboard");

  const params = await searchParams;
  const { rows, total, page, pages, cities } = await listOrganizations(params);

  return (
    <>
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Organizations</h1>
          <p className="mt-1 text-sm text-muted">Every registered head office with its branches. Open one to manage its status.</p>
        </div>
      </div>

      <OfficeFilters cities={cities} placeholder="Search by name, code, city or NTN" />
      <div className="card overflow-hidden">
        <OrganizationList rows={rows} expandAll={!!params.q} />
        <Pager page={page} pages={pages} total={total} basePath="/dashboard/organizations" params={{ q: params.q, status: params.status, city: params.city, sort: params.sort }} />
      </div>
    </>
  );
}
