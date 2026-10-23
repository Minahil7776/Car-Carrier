import type { SubscriptionSummary } from "@/lib/dashboard-data";
import { formatDate, subscriptionMeta } from "@/lib/utils";
import { Pill } from "@/components/ui/pill";
import { Section } from "./section";

export function SubscriptionCard({ sub }: { sub: SubscriptionSummary }) {
  const meta = subscriptionMeta[sub.status];
  const exempt = sub.status === "exempt";
  const until = exempt ? sub.exemptUntil : sub.expiresAt;
  return (
    <Section title="Subscription" description="Status for your office">
      <Pill tone={meta.tone}>{meta.label}</Pill>
      <dl className="mt-5 space-y-4 text-sm">
        <div>
          <dt className="text-muted">{exempt ? "Exempt until" : "Valid until"}</dt>
          <dd className="mt-0.5 text-lg font-semibold">{formatDate(until)}</dd>
        </div>
        {sub.daysLeft !== null && (
          <div>
            <dt className="text-muted">Time left</dt>
            <dd className="mt-0.5 font-medium">{sub.daysLeft < 0 ? `Expired ${Math.abs(sub.daysLeft)} days ago` : `${sub.daysLeft} days`}</dd>
          </div>
        )}
      </dl>
      {(sub.status === "expired" || sub.status === "not_subscribed") && (
        <p className="mt-5 rounded-lg bg-bad-soft px-3 py-2 text-xs text-bad">Some actions are limited until the subscription is renewed.</p>
      )}
    </Section>
  );
}
