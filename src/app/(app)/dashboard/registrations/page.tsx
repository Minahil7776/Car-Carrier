import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Settings2 } from "lucide-react";
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
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Registrations</h1>
          <p className="mt-1 text-sm text-muted">Review new companies and branch requests before they go live.</p>
        </div>
        <Link href="/dashboard/registrations/document-types" className="btn-outline h-10"><Settings2 className="size-4" aria-hidden /> Document types</Link>
      </div>
      <RegistrationTable rows={rows} counts={counts} filter={filter} />
    </>
  );
}
