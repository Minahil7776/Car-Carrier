import Link from "next/link";
import { ArrowLeft, FileText } from "lucide-react";
import type { RegDetail } from "@/lib/registration-data";
import { formatDate, registrationMeta, timeAgo } from "@/lib/utils";
import { Pill } from "@/components/ui/pill";
import { Empty, Section } from "./section";
import { ReviewPanel } from "./review-panel";

function Item({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className={`mt-0.5 truncate text-sm font-medium ${mono ? "font-mono" : ""}`}>{value || <span className="font-normal text-faint">Not provided</span>}</dd>
    </div>
  );
}

const actionLabel = { approved: "Approved", rejected: "Rejected", info_requested: "Documents requested" } as const;

export function RegistrationDetailView({ data }: { data: RegDetail }) {
  const meta = registrationMeta[data.status];
  const now = Date.now();
  return (
    <div>
      <Link href="/dashboard/registrations" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink"><ArrowLeft className="size-4" aria-hidden /> Registrations</Link>
      <div className="mb-7 flex flex-wrap items-center gap-x-4 gap-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">{data.officeName}</h1>
        <Pill tone={meta.tone}>{meta.label}</Pill>
        <p className="w-full text-sm text-muted">{data.kind === "branch" ? `New branch for ${data.parentName ?? "a head office"}` : "New organization"}, submitted {timeAgo(data.submittedAt, now)} by {data.applicantName}.</p>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[1fr_340px]">
        <div className="space-y-5">
          <Section title="Company">
            <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
              <Item label="Company name" value={data.officeName} />
              <Item label="Registered legal name" value={data.legalName} />
              <Item label="City" value={data.city} />
              <Item label="NTN" value={data.ntn} mono />
            </dl>
          </Section>
          <Section title="Applicant" description="Becomes the administrator when approved">
            <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
              <Item label="Full name" value={data.applicantName} />
              <Item label="Mobile" value={data.applicantPhone} />
              <Item label="Email" value={data.applicantEmail} />
            </dl>
          </Section>
          <Section title="Documents">
            {data.documentsCount > 0 ? (
              <p className="flex items-center gap-2 text-sm"><FileText className="size-4 text-faint" aria-hidden /> {data.documentsCount} documents uploaded</p>
            ) : (
              <Empty title="No documents uploaded" body="Use Request documents to tell the applicant what to provide. File upload is a later module." />
            )}
          </Section>
          <Section title="Verification history">
            <ol className="space-y-4">
              {[...data.history].reverse().map((h, i) => (
                <li key={i} className="flex gap-3">
                  <span className="mt-1.5 size-2 shrink-0 rounded-full bg-brand" aria-hidden />
                  <div><p className="text-sm font-medium">{actionLabel[h.action]} by {h.by}</p>{h.remarks && <p className="text-sm text-muted">{h.remarks}</p>}<p className="text-xs text-faint">{formatDate(h.at)}</p></div>
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
    </div>
  );
}
