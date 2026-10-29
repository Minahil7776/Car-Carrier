import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { can, getCurrentUser } from "@/lib/auth";
import { listBranches, type ListParams } from "@/lib/office-data";
import { OfficeFilters } from "@/components/dashboard/office-filters";
import { BranchTable } from "@/components/dashboard/branch-table";
import { Pager } from "@/components/dashboard/pager";

export const metadata: Metadata = { title: "Branches" };
export const dynamic = "force-dynamic";

export default async function BranchesPage({ searchParams }: { searchParams: Promise<ListParams> }) {
  const user = await getCurrentUser();
  if (!user || user.scope === "branch") redirect("/dashboard");

  const system = user.scope === "system";
  const params = await searchParams;
  // Scope comes from the signed-in user. A head-office user can never ask for another company's branches via the URL.
  const { rows, total, page, pages, cities, heads } = await listBranches(system ? null : user.office!.id, params);
  const canCreate = user.scope === "head" && can(user, "branch.create");

  return (
    <>
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Branches</h1>
          <p className="mt-1 text-sm text-muted">{system ? "Branches across all organizations." : `Branches of ${user.office!.name}.`}</p>
        </div>
        {canCreate && user.access.level === "allowed" && <Link href="/dashboard/branches/new" className="btn-primary h-10"><Plus className="size-4" aria-hidden /> Add branch</Link>}
      </div>

      <OfficeFilters cities={cities} heads={system ? heads : undefined} placeholder="Search by name, code, city or manager" />
      <div className="card overflow-hidden">
        <BranchTable rows={rows} showHead={system} />
        <Pager page={page} pages={pages} total={total} basePath="/dashboard/branches" params={{ q: params.q, status: params.status, city: params.city, head: system ? params.head : undefined, sort: params.sort }} />
      </div>
    </>
  );
}
