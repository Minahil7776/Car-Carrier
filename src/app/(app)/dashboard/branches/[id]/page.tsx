import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, CheckCircle2, Pencil, Settings2, TriangleAlert } from "lucide-react";
import { can, getCurrentUser } from "@/lib/auth";
import { getBranchDetail } from "@/lib/office-data";
import { formatDate, officeStatusMeta, subscriptionMeta } from "@/lib/utils";
import { Avatar, Pill } from "@/components/ui/pill";
import { Empty, Section } from "@/components/dashboard/section";
import { Item } from "@/components/dashboard/detail-item";
import { StatusPanel } from "@/components/dashboard/status-panel";
import { StatusHistory } from "@/components/dashboard/status-history";

export const metadata: Metadata = { title: "Branch" };
export const dynamic = "force-dynamic";

export default async function BranchPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string; updated?: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.scope === "branch") redirect("/dashboard");

  const system = user.scope === "system";
  const { id } = await params;
  const { created, updated } = await searchParams;
  // Another company's branch id returns "not found", not "forbidden", so ids can't be probed.
  const b = await getBranchDetail(id, system ? null : user.office!.id);
  if (!b) notFound();

  const meta = officeStatusMeta[b.status];
  const canEdit = user.access.level === "allowed" && (system || can(user, "branch.update"));
  const headBlocked = b.headOffice.status !== "active";

  return (
    <div>
      <Link href="/dashboard/branches" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink"><ArrowLeft className="size-4" aria-hidden /> Branches</Link>

      {(created || updated) && (
        <p role="status" className="mb-5 flex items-center gap-2 rounded-card border border-ok/30 bg-ok-soft px-4 py-3 text-sm text-ok">
          <CheckCircle2 className="size-4 shrink-0" aria-hidden /> {created ? `${b.name} is created and active. The system administrator has been notified.` : "Changes saved."}
        </p>
      )}
      {headBlocked && (
        <p role="status" className="mb-5 flex items-start gap-2 rounded-card border border-beacon/40 bg-beacon-soft px-4 py-3 text-sm text-warn">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden /> {b.headOffice.name} is {b.headOffice.status}, so this branch&apos;s users can&apos;t sign in until it is reactivated.
        </p>
      )}

      <div className="mb-7 flex flex-wrap items-center gap-x-4 gap-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">{b.name}</h1>
        <Pill tone={meta.tone}>{meta.label}</Pill>
        <p className="w-full text-sm text-muted">
          <span className="font-mono">{b.code}</span> · {b.city} · part of{" "}
          {system ? <Link href={`/dashboard/organizations/${b.headOffice.id}`} className="font-medium text-brand hover:underline">{b.headOffice.name}</Link> : b.headOffice.name}
        </p>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[1fr_340px]">
        <div className="space-y-5">
          <Section title="Branch details" action={canEdit ? <Link href={`/dashboard/branches/${b.id}/edit`} className="btn-outline h-8 px-3 text-xs"><Pencil className="size-3.5" aria-hidden /> Edit</Link> : undefined}>
            <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
              <Item label="Branch name" value={b.name} />
              <Item label="Identifier" value={b.code} mono />
              <Item label="Address" value={b.address} />
              <Item label="City" value={b.city} />
              <Item label="Province" value={b.province} />
              <Item label="Country" value={b.country} />
              <Item label="Contact number" value={b.contactPhone} />
              <Item label="Email" value={b.email} />
              <Item label="Opening date" value={b.openingDate ? formatDate(b.openingDate) : null} />
              <Item label="Created" value={formatDate(b.createdAt)} />
              {b.notes && <div className="sm:col-span-2"><Item label="Other information" value={b.notes} /></div>}
            </dl>
          </Section>

          <Section title="Branch manager">
            <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-3">
              <Item label="Name" value={b.managerName} />
              <Item label="Email" value={b.managerEmail} />
              <Item label="Mobile" value={b.managerPhone} />
            </dl>
          </Section>

          <Section title="Team" description={`${b.teamCount} ${b.teamCount === 1 ? "person" : "people"} with access to this branch`} flush>
            {b.team.length === 0 ? (
              <Empty title="No team members yet" body="User management is the next module. People added to this branch will show here." />
            ) : (
              <ul className="divide-y divide-line border-t border-line">
                {b.team.map((u) => (
                  <li key={u.id} className="flex items-center gap-3 px-5 py-3">
                    <Avatar name={u.name} size={36} />
                    <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{u.name}</p><p className="truncate text-xs text-muted">{u.roles.join(", ") || "No role"}</p></div>
                    <Pill tone={u.status === "active" ? "ok" : "warn"}>{u.status === "active" ? "Active" : "Suspended"}</Pill>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <StatusHistory rows={b.history} />
        </div>

        <div className="space-y-5 lg:sticky lg:top-24">
          {system ? (
            <>
              <StatusPanel officeId={b.id} name={b.name} status={b.status} statusReason={b.statusReason} kind="branch" />
              <Section title="Subscription" description="Recorded against this office.">
                <Pill tone={subscriptionMeta[b.subscription.status].tone}>{subscriptionMeta[b.subscription.status].label}</Pill>
                <dl className="mt-4 space-y-3 text-sm">
                  <div><dt className="text-muted">{b.subscription.status === "exempt" ? "Exempt until" : "Valid until"}</dt><dd className="mt-0.5 font-medium">{formatDate(b.subscription.status === "exempt" ? b.subscription.exemptUntil : b.subscription.expiresAt)}</dd></div>
                  {b.subscription.daysLeft !== null && <div><dt className="text-muted">Time remaining</dt><dd className="mt-0.5 font-medium">{b.subscription.daysLeft < 0 ? `${Math.abs(b.subscription.daysLeft)} days overdue` : `${b.subscription.daysLeft} days`}</dd></div>}
                </dl>
                <Link href={`/dashboard/subscriptions?office=${b.id}`} className="btn-outline mt-4 h-8 px-3 text-xs"><Settings2 className="size-3.5" aria-hidden /> Manage subscription</Link>
              </Section>
            </>
          ) : (
            <Section title="Status">
              <Pill tone={meta.tone}>{meta.label}</Pill>
              {b.statusReason && b.status !== "active" && <p className="mt-3 rounded-lg bg-raised px-3 py-2 text-sm"><span className="text-muted">Reason: </span>{b.statusReason}</p>}
              <p className="mt-3 text-xs text-muted">Only the system administrator can suspend, block or close a branch.</p>
            </Section>
          )}
        </div>
      </div>
    </div>
  );
}
