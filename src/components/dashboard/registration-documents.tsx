"use client";

import { useRouter } from "next/navigation";
import { FileText } from "lucide-react";
import type { RegDetail } from "@/lib/registration-data";
import { DocumentsStep, fmtSize, useDocumentUploads } from "@/components/signup-documents";
import { Empty, Section } from "./section";

/** While a request is open the administrator can add, replace or remove documents on the applicant's behalf. */
export function RegistrationDocuments({ data, editable }: { data: RegDetail; editable: boolean }) {
  const router = useRouter();
  const uploads = useDocumentUploads({
    url: `/api/registrations/${data.id}/documents`,
    deleteUrl: (fileId) => `/api/registrations/${data.id}/documents?fileId=${fileId}`,
    viewUrl: (fileId) => `/api/registrations/documents/${fileId}`,
    awaitRemove: true,
    initial: Object.fromEntries(data.documents.map((d) => [d.docType, { id: d.id, name: d.name, size: d.size }])),
    onChanged: () => router.refresh(), // keeps the history list below in step
  });

  if (editable) {
    return (
      <Section title="Documents" description="Upload or replace a document the applicant sent you. Each change is saved straight away.">
        <DocumentsStep uploads={uploads} intro={false} />
      </Section>
    );
  }

  return (
    <Section title="Documents">
      {data.documents.length === 0 ? (
        <Empty title="No documents uploaded" body="This request was decided without documents." />
      ) : (
        <ul className="divide-y divide-line">
          {data.documents.map((d) => (
            <li key={d.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
              <FileText className="size-4 shrink-0 text-faint" aria-hidden />
              <div className="min-w-0 flex-1"><p className="text-sm font-medium">{d.label}</p><p className="truncate text-xs text-muted">{d.name} ({fmtSize(d.size)})</p></div>
              <a href={`/api/registrations/documents/${d.id}`} target="_blank" rel="noopener" className="text-sm font-medium text-brand hover:underline">View</a>
              <a href={`/api/registrations/documents/${d.id}?download=1`} className="text-sm font-medium text-muted hover:text-ink">Download</a>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
