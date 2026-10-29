import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { getOrganizationDetail } from "@/lib/office-data";
import { OrganizationForm } from "@/components/dashboard/organization-form";

export const metadata: Metadata = { title: "Edit organization" };
export const dynamic = "force-dynamic";

export default async function EditOrganizationPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.scope !== "system") redirect("/dashboard");

  const { id } = await params;
  const o = await getOrganizationDetail(id);
  if (!o) notFound();

  return (
    <div className="mx-auto max-w-3xl">
      <Link href={`/dashboard/organizations/${o.id}`} className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink"><ArrowLeft className="size-4" aria-hidden /> {o.name}</Link>
      <h1 className="mb-1 text-2xl font-semibold tracking-tight">Edit organization</h1>
      <p className="mb-7 text-sm text-muted"><span className="font-mono">{o.code}</span> cannot be changed. Every edit is written to the audit log.</p>
      <OrganizationForm id={o.id} cancelHref={`/dashboard/organizations/${o.id}`} defaults={{
        officeName: o.name, legalName: o.legalName, officeType: "head", ntn: o.ntn, salesTaxNumber: o.salesTaxNumber, companyRegNumber: o.companyRegNumber,
        registeredAddress: o.registeredAddress, operationalAddress: o.operationalAddress, province: o.province, city: o.city,
        officePhone: o.officePhone, officeEmail: o.officeEmail, officeWebsite: o.website,
      }} />
    </div>
  );
}
