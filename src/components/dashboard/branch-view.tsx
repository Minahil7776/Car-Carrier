import { Building2, MapPin, UserCheck, UserX } from "lucide-react";
import type { BranchData } from "@/lib/dashboard-data";
import { officeStatusMeta, timeAgo } from "@/lib/utils";
import { Avatar, Pill } from "@/components/ui/pill";
import { StatCard } from "./stat-card";
import { Empty, Section } from "./section";
import { ActivityFeed } from "./activity-feed";
import { SubscriptionCard } from "./subscription-card";

export function BranchView({ data, roleLabels }: { data: BranchData; roleLabels: Record<string, string> }) {
  const active = data.team.filter((u) => u.status === "active").length;
  const meta = officeStatusMeta[data.office.status];
  const now = Date.now();

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard label="Branch" value={data.office.city} note={data.office.code} icon={MapPin} />
        <StatCard label="Team members" value={data.team.length} note="With access to this branch" icon={UserCheck} />
        <StatCard label="Suspended users" value={data.team.length - active} note={data.team.length - active ? "Cannot sign in" : "Everyone can sign in"} icon={UserX} attention={data.team.length - active > 0} />
        <StatCard label="Head office" value={data.headOffice?.name ?? "—"} note={data.headOffice?.code} icon={Building2} />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Section className="lg:col-span-2" title="Team" description="People who can work in this branch" flush
          action={<Pill tone={meta.tone}>{`Branch ${meta.label.toLowerCase()}`}</Pill>}>
          {data.team.length === 0 ? (
            <Empty title="No team members yet" body="Ask your head office administrator to add people to this branch." />
          ) : (
            <ul className="divide-y divide-line border-t border-line">
              {data.team.map((u) => (
                <li key={u.id} className="flex items-center gap-3 px-5 py-3">
                  <Avatar name={u.name} size={36} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{u.name}</p>
                    <p className="truncate text-xs text-muted">{u.roleKeys.map((k) => roleLabels[k] ?? k).join(", ")}</p>
                  </div>
                  <div className="hidden text-right text-xs text-faint sm:block">{u.lastLoginAt ? `Last seen ${timeAgo(u.lastLoginAt, now)}` : "Never signed in"}</div>
                  <Pill tone={u.status === "active" ? "ok" : "warn"}>{u.status === "active" ? "Active" : "Suspended"}</Pill>
                </li>
              ))}
            </ul>
          )}
        </Section>
        <SubscriptionCard sub={data.subscription} />
      </div>

      <Section title="Recent activity" description="What happened in this branch"><ActivityFeed items={data.activity} /></Section>
    </div>
  );
}
