import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { listRegistrations, type RegFilter } from "@/lib/registration-data";
import { RegistrationTable } from "@/components/dashboard/registration-table";

export const metadata: Metadata = { title: "Registrations" };
export const dynamic = "force-dynamic";

export default async function RegistrationsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.scope !== "system") redirect("/dashboard");

  const { status } = await searchParams;
  const filter: RegFilter = (["open", "approved", "rejected", "all"] as const).find((s) => s === status) ?? "open";
  const { rows, counts } = await listRegistrations(filter);

  return (
    <>
      <div className="mb-7">
        <h1 className="text-2xl font-semibold tracking-tight">Registrations</h1>
        <p className="mt-1 text-sm text-muted">Review new companies and branch requests before they go live.</p>
      </div>
      <RegistrationTable rows={rows} counts={counts} filter={filter} />
    </>
  );
}
