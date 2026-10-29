import Link from "next/link";
import { CalendarClock, GitBranch, Plus, ShieldCheck, Users } from "lucide-react";
import type { HeadOfficeData } from "@/lib/dashboard-data";
import { officeStatusMeta } from "@/lib/utils";
import { Pill } from "@/components/ui/pill";
import { StatCard } from "./stat-card";
import { Empty, Section } from "./section";
import { RegistrationList } from "./registration-list";
import { ActivityFeed } from "./activity-feed";
import { SubscriptionCard } from "./subscription-card";

export function HeadOfficeView({ data, canAddBranch = false }: { data: HeadOfficeData; canAddBranch?: boolean }) {
  const { kpis } = data;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard label="Branches" value={kpis.branches} note={`${kpis.activeBranches} active`} icon={GitBranch} />
        <StatCard label="Users" value={kpis.users} note="Across head office and branches" icon={Users} />
        <StatCard label="Branch requests" value={kpis.pendingBranches} note={kpis.pendingBranches ? "Waiting for approval" : "Nothing waiting"} icon={CalendarClock} attention={kpis.pendingBranches > 0} />
        <StatCard label="Active branches" value={`${kpis.activeBranches}/${kpis.branches}`} note="Open for operations" icon={ShieldCheck} />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Section className="lg:col-span-2" title="Branches" description="Status and team size at each branch" flush
          action={<div className="flex items-center gap-3"><Link href="/dashboard/branches" className="text-sm font-medium text-brand hover:underline">View all</Link>{canAddBranch && <Link href="/dashboard/branches/new" className="btn-outline h-8 px-3 text-xs"><Plus className="size-3.5" aria-hidden /> Add branch</Link>}</div>}>
          {data.branches.length === 0 ? (
            <Empty title="No branches yet" body="Use Add branch to create your first one. It goes live straight away." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[440px] text-sm">
                <thead>
                  <tr className="border-y border-line bg-raised text-left text-xs text-muted">
                    <th className="px-5 py-2 font-medium">Branch</th>
                    <th className="px-3 py-2 font-medium">City</th>
                    <th className="px-3 py-2 text-right font-medium">Users</th>
                    <th className="px-5 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {data.branches.map((b) => (
                    <tr key={b.id} className="hover:bg-raised/60">
                      <td className="px-5 py-3"><Link href={`/dashboard/branches/${b.id}`} className="font-medium hover:text-brand hover:underline">{b.name}</Link><p className="font-mono text-xs text-faint">{b.code}</p></td>
                      <td className="px-3 py-3 text-muted">{b.city}</td>
                      <td className="px-3 py-3 text-right">{b.userCount}</td>
                      <td className="px-5 py-3"><Pill tone={officeStatusMeta[b.status].tone}>{officeStatusMeta[b.status].label}</Pill></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>
        <SubscriptionCard sub={data.subscription} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Section title="Branch requests" description="Older requests still waiting for approval">
          <RegistrationList rows={data.pending} emptyBody="New branches are created straight away, so nothing is waiting." />
        </Section>
        <Section title="Recent activity"><ActivityFeed items={data.activity} /></Section>
      </div>
    </div>
  );
}

