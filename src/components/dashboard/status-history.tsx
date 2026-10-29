import type { HistoryRow } from "@/lib/office-data";
import { STATUS_ACTION_COPY } from "@/lib/office-schema";
import { formatDate } from "@/lib/utils";
import { Section } from "./section";

/** FR-ORG-007: previous status, new status, who, when and why, newest first. Read-only. */
export function StatusHistory({ rows }: { rows: HistoryRow[] }) {
  return (
    <Section title="Status history" description="Every administrative change is kept for audit">
      {rows.length === 0 ? (
        <p className="text-sm text-muted">No status changes yet.</p>
      ) : (
        <ol className="space-y-4">
          {rows.map((h) => (
            <li key={h.id} className="flex gap-3">
              <span className="mt-1.5 size-2 shrink-0 rounded-full bg-brand" aria-hidden />
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  {h.from ? `${STATUS_ACTION_COPY[h.to].verb} (was ${h.from})` : h.to === "active" ? "Created as active" : STATUS_ACTION_COPY[h.to].verb} by {h.by}
                </p>
                <p className="break-words text-sm text-muted">{h.reason}</p>
                <p className="text-xs text-faint">{formatDate(h.at)}</p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </Section>
  );
}
