import Link from "next/link";
import { Building2, ClipboardCheck, GitBranch, Users } from "lucide-react";
import type { SuperAdminData } from "@/lib/dashboard-data";
import { officeStatusMeta } from "@/lib/utils";
import { StatCard } from "./stat-card";
import { Section } from "./section";
import { TrendChart } from "./trend-chart";
import { StatusDonut } from "./status-donut";
import { RegistrationList } from "./registration-list";
import { OrgTree } from "./org-tree";
import { ActivityFeed } from "./activity-feed";
import { SubscriptionStrip } from "./subscription-strip";

export function SuperAdminView({ data }: { data: SuperAdminData }) {
  const { kpis } = data;
  const slices = data.statusBreakdown
    .map((s) => ({ key: s.status, label: officeStatusMeta[s.status].label, value: s.count, color: officeStatusMeta[s.status].color }))
    .sort((a, b) => b.value - a.value);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard href="/dashboard/registrations" label="Pending registrations" value={kpis.pending} note={kpis.pending ? "Waiting for your review" : "Nothing waiting"} icon={ClipboardCheck} attention={kpis.pending > 0} />
        <StatCard label="Organizations" value={kpis.organizations} note="Registered head offices" icon={Building2} />
        <StatCard label="Branches" value={kpis.branches} note="Across all organizations" icon={GitBranch} />
        <StatCard label="Users" value={kpis.users} note="Active and suspended accounts" icon={Users} />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Section className="lg:col-span-2" title="Registration requests" description="New requests received in the last 6 months">
          <TrendChart data={data.registrationTrend} unit="requests" />
        </Section>
        <Section title="Office status" description="Head offices and branches">
          <StatusDonut slices={slices} centerLabel="Offices" />
        </Section>
      </div>

      <Section title="Subscriptions" description="Active offices by subscription status">
        <SubscriptionStrip data={data.subscriptionBreakdown} />
      </Section>

      <div className="grid gap-5 lg:grid-cols-5">
        <Section className="lg:col-span-3" title="Organizations" description="Expand a head office to see its branches">
          <OrgTree rows={data.organizations} />
        </Section>
        <div className="grid gap-5 lg:col-span-2 lg:grid-rows-[auto_1fr]">
          <Section title="Review queue" description="Oldest requests first" action={<Link href="/dashboard/registrations" className="text-sm font-medium text-brand hover:underline">View all</Link>}>
            <RegistrationList rows={data.pending} linkBase="/dashboard/registrations" emptyBody="New registrations and branch requests will appear here." />
          </Section>
          <Section title="Recent activity">
            <ActivityFeed items={data.activity} />
          </Section>
        </div>
      </div>
    </div>
  );
}
