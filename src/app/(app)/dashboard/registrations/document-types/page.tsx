import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { getRegistrationDocumentTypes } from "@/lib/registration-documents";
import { DocumentTypeSettings } from "@/components/dashboard/document-type-settings";

export const metadata: Metadata = { title: "Registration document types" };
export const dynamic = "force-dynamic";

export default async function RegistrationDocumentTypesPage() {
  const user = await getCurrentUser();
  if (!user || user.scope !== "system") redirect("/dashboard");
  const documentTypes = await getRegistrationDocumentTypes();

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/dashboard/registrations" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink"><ArrowLeft className="size-4" aria-hidden /> Registrations</Link>
      <h1 className="mb-1 text-2xl font-semibold tracking-tight">Registration document types</h1>
      <p className="mb-7 text-sm text-muted">Configure the documents applicants can upload. Required types must be supplied before a registration can be submitted.</p>
      <DocumentTypeSettings initialTypes={documentTypes} />
    </div>
  );
}
