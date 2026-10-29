import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { can, getCurrentUser } from "@/lib/auth";
import { getBranchDetail } from "@/lib/office-data";
import { BranchForm } from "@/components/dashboard/branch-form";

export const metadata: Metadata = { title: "Edit branch" };
export const dynamic = "force-dynamic";

export default async function EditBranchPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.scope === "branch") redirect("/dashboard");
  const system = user.scope === "system";
  const { id } = await params;
  if (user.access.level !== "allowed" || (!system && !can(user, "branch.update"))) redirect(`/dashboard/branches/${id}`);

  const b = await getBranchDetail(id, system ? null : user.office!.id);
  if (!b) notFound();

  return (
    <div className="mx-auto max-w-3xl">
      <Link href={`/dashboard/branches/${b.id}`} className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink"><ArrowLeft className="size-4" aria-hidden /> {b.name}</Link>
      <h1 className="mb-1 text-2xl font-semibold tracking-tight">Edit branch</h1>
      <p className="mb-7 text-sm text-muted">Every edit is written to the audit log.</p>
      <BranchForm mode="edit" id={b.id} code={b.code} cancelHref={`/dashboard/branches/${b.id}`} defaults={{
        branchName: b.name, address: b.address, province: b.province, city: b.city, contactPhone: b.contactPhone, email: b.email,
        managerName: b.managerName, managerEmail: b.managerEmail, managerPhone: b.managerPhone, openingDate: b.openingDate?.slice(0, 10), notes: b.notes,
      }} />
    </div>
  );
}
