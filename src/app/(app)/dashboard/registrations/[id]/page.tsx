import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getRegistrationDetail } from "@/lib/registration-data";
import { RegistrationDetailView } from "@/components/dashboard/registration-detail-view";

export const metadata: Metadata = { title: "Review registration" };
export const dynamic = "force-dynamic";

export default async function RegistrationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.scope !== "system") redirect("/dashboard");

  const { id } = await params;
  const data = await getRegistrationDetail(id);
  if (!data) notFound();
  return <RegistrationDetailView data={data} />;
}
