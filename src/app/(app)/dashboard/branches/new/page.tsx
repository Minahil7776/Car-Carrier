import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { can, getCurrentUser } from "@/lib/auth";
import { BranchForm } from "@/components/dashboard/branch-form";

export const metadata: Metadata = { title: "Add branch" };
export const dynamic = "force-dynamic";

export default async function NewBranchPage() {
  const user = await getCurrentUser();
  if (!user || user.scope !== "head") redirect("/dashboard/branches");
  if (!can(user, "branch.create")) redirect("/dashboard/branches");
  if (user.access.level !== "allowed") redirect("/dashboard/branches");

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/dashboard/branches" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink"><ArrowLeft className="size-4" aria-hidden /> Branches</Link>
      <h1 className="mb-1 text-2xl font-semibold tracking-tight">Add branch</h1>
      <p className="mb-7 text-sm text-muted">The branch will belong to {user.office!.name}.</p>
      <BranchForm mode="create" cancelHref="/dashboard/branches" />
    </div>
  );
}
