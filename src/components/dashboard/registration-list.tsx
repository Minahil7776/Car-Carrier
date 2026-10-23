import type { RegistrationRow } from "@/lib/dashboard-data";
import { Pill } from "@/components/ui/pill";
import { registrationMeta, timeAgo } from "@/lib/utils";
import { Empty } from "./section";

export function RegistrationList({ rows, emptyBody }: { rows: RegistrationRow[]; emptyBody: string }) {
  if (!rows.length) return <Empty title="Nothing waiting" body={emptyBody} />;
  const now = Date.now();
  return (
    <ul className="divide-y divide-line">
      {rows.map((r) => {
        const meta = registrationMeta[r.status];
        return (
          <li key={r.id} className="flex items-center gap-3 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{r.officeName}</p>
              <p className="flex gap-2 truncate text-xs text-muted">
                <span>{r.kind === "branch" ? "New branch" : "New organization"}</span>
                <span>{r.city}</span>
                <span className="hidden sm:inline">{r.documentsCount} documents</span>
              </p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <Pill tone={meta.tone}>{meta.label}</Pill>
              <span className="text-xs text-faint">{timeAgo(r.submittedAt, now)}</span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
