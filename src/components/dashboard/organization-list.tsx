"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { OrgListRow } from "@/lib/office-data";
import { officeStatusMeta, subscriptionMeta } from "@/lib/utils";
import { Pill } from "@/components/ui/pill";
import { Empty } from "./section";

/** FR-ORG-008: head offices with their branches underneath. Expand/collapse uses native <details>, so it needs no client script. */
export function OrganizationList({ rows, expandAll }: { rows: OrgListRow[]; expandAll: boolean }) {
  if (rows.length === 0) return <Empty title="No organizations match" body="Try a different search or clear the filters." />;
  return (
    <ul className="divide-y divide-line">
      {rows.map((o) => {
        const meta = officeStatusMeta[o.status];
        return (
          <li key={o.id}>
            <details open={expandAll} className="group">
              <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-3.5 transition-colors hover:bg-raised/70 [&::-webkit-details-marker]:hidden">
                <ChevronRight className="size-4 shrink-0 text-faint transition-transform group-open:rotate-90" aria-hidden />
                <div className="min-w-0 flex-1">
                  <Link href={`/dashboard/organizations/${o.id}`} className="block truncate text-sm font-medium hover:text-brand hover:underline" onClick={(e) => e.stopPropagation()}>{o.name}</Link>
                  <p className="flex gap-3 truncate text-xs text-muted"><span className="font-mono">{o.code}</span><span>{o.city}</span></p>
                </div>
                <div className="hidden text-right text-xs text-muted sm:block">
                  <p>{o.branchCount} {o.branchCount === 1 ? "branch" : "branches"}</p>
                  <p>{o.userCount} {o.userCount === 1 ? "user" : "users"}</p>
                </div>
                <Pill tone={subscriptionMeta[o.subscription].tone} dot={false} className="hidden md:inline-flex">{subscriptionMeta[o.subscription].label}</Pill>
                <Pill tone={meta.tone}>{meta.label}</Pill>
              </summary>
              <ul className="mb-3 ml-[2.35rem] mr-5 space-y-px border-l border-line pl-5">
                {o.branches.length === 0 && <li className="py-2 text-xs text-muted">No branches yet.</li>}
                {o.branches.map((b) => (
                  <li key={b.id}>
                    <Link href={`/dashboard/branches/${b.id}`} className="flex items-center gap-3 rounded-md py-2 pr-1 text-sm hover:text-brand">
                      <span className="flex-1 truncate">{b.name}<span className="ml-2 text-xs text-muted">{b.city}</span></span>
                      <span className="hidden font-mono text-xs text-faint sm:inline">{b.code}</span>
                      <Pill tone={officeStatusMeta[b.status].tone} className="scale-95">{officeStatusMeta[b.status].label}</Pill>
                    </Link>
                  </li>
                ))}
              </ul>
            </details>
          </li>
        );
      })}
    </ul>
  );
}
