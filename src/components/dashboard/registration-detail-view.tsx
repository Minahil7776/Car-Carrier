import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { RegDetail } from "@/lib/registration-data";
import { formatDate, registrationMeta, timeAgo } from "@/lib/utils";
import { Pill } from "@/components/ui/pill";
import { Section } from "./section";
import { EditGuard } from "./edit-guard";
import { RegistrationDetails } from "./registration-details";
import { RegistrationDocuments } from "./registration-documents";
import { ReviewPanel } from "./review-panel";

const actionLabel = {
  approved: "Approved", rejected: "Rejected", info_requested: "Documents requested",
  edited: "Details edited", document_added: "Document added", document_removed: "Document removed",
} as const;
const OPEN = ["pending", "under_review", "info_required"];

export function RegistrationDetailView({ data }: { data: RegDetail }) {
  const meta = registrationMeta[data.status];
  const now = Date.now();
  // Only open company registrations can be edited; once decided, the record is fixed.
  const editable = OPEN.includes(data.status) && data.kind === "head";
  return (
    <div>
      <Link href="/dashboard/registrations" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink"><ArrowLeft className="size-4" aria-hidden /> Registrations</Link>
      <div className="mb-7 flex flex-wrap items-center gap-x-4 gap-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">{data.officeName}</h1>
        <Pill tone={meta.tone}>{meta.label}</Pill>
        <p className="w-full text-sm text-muted">{data.kind === "branch" ? `New branch for ${data.parentName ?? "a head office"}` : "New organization"}, submitted {timeAgo(data.submittedAt, now)} by {data.applicantName}.</p>
      </div>

      <EditGuard>
      <div className="grid items-start gap-5 lg:grid-cols-[1fr_340px]">
        <div className="space-y-5">
          <RegistrationDetails data={data} editable={editable} />
          <RegistrationDocuments data={data} editable={editable} />
          <Section title="Verification history">
            <ol className="space-y-4">
              {[...data.history].reverse().map((h, i) => (
                <li key={i} className="flex gap-3">
                  <span className="mt-1.5 size-2 shrink-0 rounded-full bg-brand" aria-hidden />
                  <div><p className="text-sm font-medium">{actionLabel[h.action] ?? h.action} by {h.by}</p>{h.remarks && <p className="text-sm text-muted">{h.remarks}</p>}<p className="text-xs text-faint">{formatDate(h.at)}</p></div>
                </li>
              ))}
              <li className="flex gap-3">
                <span className="mt-1.5 size-2 shrink-0 rounded-full bg-line" aria-hidden />
                <div><p className="text-sm font-medium">Request submitted</p><p className="text-xs text-faint">{formatDate(data.submittedAt)}</p></div>
              </li>
            </ol>
          </Section>
        </div>
        <div className="lg:sticky lg:top-24"><ReviewPanel id={data.id} kind={data.kind} status={data.status} reviewedAt={data.reviewedAt} reviewRemarks={data.reviewRemarks} /></div>
      </div>
      </EditGuard>
    </div>
  );
}
