import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { RegFilter, RegListRow } from "@/lib/registration-data";
import { cn, formatDate, registrationMeta, timeAgo } from "@/lib/utils";
import { Pill } from "@/components/ui/pill";
import { Empty } from "./section";

const tabs: { key: RegFilter; label: string }[] = [
  { key: "open", label: "Needs review" }, { key: "approved", label: "Approved" }, { key: "rejected", label: "Rejected" }, { key: "all", label: "All" },
];

export function RegistrationTable({ rows, counts, filter }: { rows: RegListRow[]; counts: Record<RegFilter, number>; filter: RegFilter }) {
  const now = Date.now();
  return (
    <div className="card overflow-hidden">
      <div role="tablist" aria-label="Filter requests" className="flex gap-1 overflow-x-auto border-b border-line px-3 pt-2">
        {tabs.map((t) => (
          <Link key={t.key} role="tab" aria-selected={filter === t.key} href={`/dashboard/registrations?status=${t.key}`} className={cn("-mb-px flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium", filter === t.key ? "border-brand text-ink" : "border-transparent text-muted hover:text-ink")}>
            {t.label}<span className="rounded-full bg-line/70 px-1.5 text-xs text-muted">{counts[t.key]}</span>
          </Link>
        ))}
      </div>
      {rows.length === 0 ? (
        <Empty title={filter === "open" ? "Nothing waiting for review" : "No requests here"} body={filter === "open" ? "New company and branch requests will appear here." : "Try another tab."} />
      ) : (
        <ul className="divide-y divide-line">
          {rows.map((r) => (
            <li key={r.id}>
              <Link href={`/dashboard/registrations/${r.id}`} className="flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-raised/70 md:grid md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_84px_132px_16px]">
                <div className="min-w-0 flex-1 md:flex-none">
                  <p className="truncate text-sm font-medium">{r.officeName}</p>
                  <p className="flex gap-3 truncate text-xs text-muted"><span>{r.kind === "branch" ? "New branch" : "New organization"}</span><span>{r.city}</span></p>
                </div>
                <div className="hidden min-w-0 md:block">
                  <p className="truncate text-sm">{r.applicantName}</p><p className="truncate text-xs text-muted">{r.applicantEmail}</p>
                </div>
                <div className="hidden text-right text-xs text-muted sm:block md:text-left">{r.status === "pending" || r.status === "under_review" || r.status === "info_required" ? timeAgo(r.submittedAt, now) : formatDate(r.submittedAt)}</div>
                <Pill tone={registrationMeta[r.status].tone}>{registrationMeta[r.status].label}</Pill>
                <ChevronRight className="size-4 shrink-0 text-faint" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
