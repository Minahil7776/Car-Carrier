import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, CheckCircle2, Pencil, Settings2 } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { getOrganizationDetail } from "@/lib/office-data";
import { formatDate, officeStatusMeta, subscriptionMeta } from "@/lib/utils";
import { Pill } from "@/components/ui/pill";
import { Empty, Section } from "@/components/dashboard/section";
import { Item } from "@/components/dashboard/detail-item";
import { StatusPanel } from "@/components/dashboard/status-panel";
import { StatusHistory } from "@/components/dashboard/status-history";

export const metadata: Metadata = { title: "Organization" };
export const dynamic = "force-dynamic";

export default async function OrganizationPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string; updated?: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.scope !== "system") redirect("/dashboard");

  const { id } = await params;
  const { created, updated } = await searchParams;
  const o = await getOrganizationDetail(id);
  if (!o) notFound();

  const meta = officeStatusMeta[o.status];
  const sub = subscriptionMeta[o.subscription.status];
  const subUntil = o.subscription.status === "exempt" ? o.subscription.exemptUntil : o.subscription.expiresAt;

  return (
    <div>
      <Link href="/dashboard/organizations" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink"><ArrowLeft className="size-4" aria-hidden /> Organizations</Link>

      {(created || updated) && (
        <p role="status" className="mb-5 flex items-center gap-2 rounded-card border border-ok/30 bg-ok-soft px-4 py-3 text-sm text-ok">
          <CheckCircle2 className="size-4 shrink-0" aria-hidden /> {created ? `${o.name} is created and active. ${o.contact.email ?? "The administrator"} can sign in now.` : "Changes saved."}
        </p>
      )}

      <div className="mb-7 flex flex-wrap items-center gap-x-4 gap-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">{o.name}</h1>
        <Pill tone={meta.tone}>{meta.label}</Pill>
        <p className="w-full text-sm text-muted"><span className="font-mono">{o.code}</span> · {o.city}{o.province ? `, ${o.province}` : ""} · registered {formatDate(o.createdAt)}</p>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[1fr_340px]">
        <div className="space-y-5">
          <Section title="Company" action={<Link href={`/dashboard/organizations/${o.id}/edit`} className="btn-outline h-8 px-3 text-xs"><Pencil className="size-3.5" aria-hidden /> Edit</Link>}>
            <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
              <Item label="Head office name" value={o.name} />
              <Item label="Registered legal name" value={o.legalName} />
              <Item label="NTN" value={o.ntn} mono />
              <Item label="Sales tax number" value={o.salesTaxNumber} mono />
              <Item label="Company registration number" value={o.companyRegNumber} mono />
              <Item label="Website" value={o.website} />
              <Item label="Registered address" value={o.registeredAddress} />
              <Item label="Operational address" value={o.operationalAddress} />
              <Item label="City" value={o.city} />
              <Item label="Province" value={o.province} />
              <Item label="Office phone" value={o.officePhone} />
              <Item label="Office email" value={o.officeEmail} />
            </dl>
          </Section>

          <Section title="Primary contact">
            <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
              <Item label="Name" value={o.contact.name} />
              <Item label="Designation" value={o.contact.designation} />
              <Item label="Email" value={o.contact.email} />
              <Item label="Mobile" value={o.contact.phone} />
            </dl>
          </Section>

          <Section title="Branches" description={`${o.branches.length} ${o.branches.length === 1 ? "branch" : "branches"} · ${o.userCount} ${o.userCount === 1 ? "user" : "users"} in total`} flush>
            {o.branches.length === 0 ? (
              <Empty title="No branches yet" body="Branches added by this head office will show here." />
            ) : (
              <ul className="divide-y divide-line border-t border-line">
                {o.branches.map((b) => (
                  <li key={b.id}>
                    <Link href={`/dashboard/branches/${b.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-raised/60">
                      <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{b.name}</p><p className="truncate text-xs text-muted"><span className="font-mono">{b.code}</span> · {b.city}</p></div>
                      <span className="hidden text-xs text-muted sm:block">{b.userCount} {b.userCount === 1 ? "user" : "users"}</span>
                      <Pill tone={officeStatusMeta[b.status].tone}>{officeStatusMeta[b.status].label}</Pill>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <StatusHistory rows={o.history} />
        </div>

        <div className="space-y-5 lg:sticky lg:top-24">
          <StatusPanel officeId={o.id} name={o.name} status={o.status} statusReason={o.statusReason} kind="head" />
          <Section title="Subscription" description="Subscription status is separate from office status." action={<Link href={`/dashboard/subscriptions?office=${o.id}`} className="btn-outline h-8 px-3 text-xs"><Settings2 className="size-3.5" aria-hidden /> Manage</Link>}>
            <Pill tone={sub.tone}>{sub.label}</Pill>
            <dl className="mt-4 space-y-3 text-sm">
              <div><dt className="text-muted">{o.subscription.status === "exempt" ? "Exempt until" : "Valid until"}</dt><dd className="mt-0.5 font-medium">{formatDate(subUntil)}</dd></div>
              {o.subscription.daysLeft !== null && <div><dt className="text-muted">Time remaining</dt><dd className="mt-0.5 font-medium">{o.subscription.daysLeft < 0 ? `${Math.abs(o.subscription.daysLeft)} days overdue` : `${o.subscription.daysLeft} days`}</dd></div>}
            </dl>
          </Section>
        </div>
      </div>
    </div>
  );
}
