import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { BranchListRow } from "@/lib/office-data";
import { officeStatusMeta } from "@/lib/utils";
import { Pill } from "@/components/ui/pill";
import { Empty } from "./section";

export function BranchTable({ rows, showHead }: { rows: BranchListRow[]; showHead: boolean }) {
  if (rows.length === 0) return <Empty title="No branches match" body="Try a different search, or clear the filters." />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-line bg-raised text-left text-xs text-muted">
            <th className="px-5 py-2 font-medium">Branch</th>
            {showHead && <th className="px-3 py-2 font-medium">Head office</th>}
            <th className="px-3 py-2 font-medium">City</th>
            <th className="px-3 py-2 font-medium">Manager</th>
            <th className="px-3 py-2 text-right font-medium">Users</th>
            <th className="px-5 py-2 font-medium">Status</th>
            <th className="w-8" />
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((b) => {
            const meta = officeStatusMeta[b.status];
            const headBlocked = b.headOffice.status !== "active";
            return (
              <tr key={b.id} className="hover:bg-raised/60">
                <td className="px-5 py-3"><Link href={`/dashboard/branches/${b.id}`} className="font-medium hover:text-brand hover:underline">{b.name}</Link><p className="font-mono text-xs text-faint">{b.code}</p></td>
                {showHead && <td className="px-3 py-3 text-muted"><Link href={`/dashboard/organizations/${b.headOffice.id}`} className="hover:text-brand hover:underline">{b.headOffice.name}</Link></td>}
                <td className="px-3 py-3 text-muted">{b.city}</td>
                <td className="px-3 py-3 text-muted">{b.managerName ?? "—"}</td>
                <td className="px-3 py-3 text-right">{b.userCount}</td>
                <td className="px-5 py-3">
                  <Pill tone={meta.tone}>{meta.label}</Pill>
                  {headBlocked && b.status === "active" && <p className="mt-1 text-xs text-warn">Head office {b.headOffice.status}</p>}
                </td>
                <td className="pr-4"><Link href={`/dashboard/branches/${b.id}`} aria-label={`Open ${b.name}`}><ChevronRight className="size-4 text-faint" aria-hidden /></Link></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
