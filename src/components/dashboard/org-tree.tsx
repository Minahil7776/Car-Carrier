"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronRight, Search } from "lucide-react";
import type { OrgRow } from "@/lib/dashboard-data";
import { cn, officeStatusMeta } from "@/lib/utils";
import { Pill } from "@/components/ui/pill";
import { Empty } from "./section";

export function OrgTree({ rows }: { rows: OrgRow[] }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<Set<string>>(new Set(rows[0] ? [rows[0].id] : []));

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) => `${r.name} ${r.city} ${r.code}`.toLowerCase().includes(s) || r.branches.some((b) => `${b.name} ${b.city}`.toLowerCase().includes(s)));
  }, [q, rows]);

  const toggle = (id: string) => setOpen((o) => { const n = new Set(o); n.has(id) ? n.delete(id) : n.add(id); return n; });

  return (
    <div>
      <div className="relative mb-3">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" aria-hidden />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find an organization or branch" aria-label="Find an organization or branch" className="input h-9 pl-9" />
      </div>

      {filtered.length === 0 ? (
        <Empty title="No match" body="Try a different name or city." />
      ) : (
        <ul className="divide-y divide-line">
          {filtered.map((o) => {
            const isOpen = open.has(o.id) || (q.length > 0 && o.branches.length > 0);
            const meta = officeStatusMeta[o.status];
            return (
              <li key={o.id}>
                <button onClick={() => toggle(o.id)} aria-expanded={isOpen} className="flex w-full items-center gap-3 py-3 text-left">
                  <ChevronRight className={cn("size-4 shrink-0 text-faint transition-transform", isOpen && "rotate-90")} aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{o.name}</p>
                    <p className="flex gap-2 truncate text-xs text-muted"><span className="font-mono">{o.code}</span><span>{o.city}</span></p>
                  </div>
                  <div className="hidden text-right text-xs text-muted sm:block">
                    <p>{o.branchCount} {o.branchCount === 1 ? "branch" : "branches"}</p>
                    <p>{o.userCount} users</p>
                  </div>
                  <Pill tone={meta.tone}>{meta.label}</Pill>
                </button>
                {isOpen && (
                  <ul className="mb-3 ml-[7px] space-y-px border-l border-line pl-5">
                    <li className="py-1.5"><Link href={`/dashboard/organizations/${o.id}`} className="text-xs font-medium text-brand hover:underline">Open organization</Link></li>
                    {o.branches.length === 0 && <li className="py-1.5 text-xs text-muted">No branches yet.</li>}
                    {o.branches.map((b) => (
                      <li key={b.id} className="flex items-center gap-3 rounded-md py-1.5 pr-1 text-sm">
                        <Link href={`/dashboard/branches/${b.id}`} className="flex-1 truncate hover:text-brand hover:underline">{b.name}</Link>
                        <span className="hidden font-mono text-xs text-faint sm:inline">{b.code}</span>
                        <Pill tone={officeStatusMeta[b.status].tone} className="scale-95">{officeStatusMeta[b.status].label}</Pill>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
