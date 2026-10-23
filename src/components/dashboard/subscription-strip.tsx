import type { SubscriptionStatus } from "@/lib/types";
import { subscriptionMeta } from "@/lib/utils";

/** Counts only. Fees and payments are not part of this release. */
export function SubscriptionStrip({ data }: { data: { status: SubscriptionStatus; count: number }[] }) {
  const total = data.reduce((n, d) => n + d.count, 0);
  return (
    <div>
      <div className="flex h-2.5 overflow-hidden rounded-full bg-line" role="img" aria-label={data.map((d) => `${subscriptionMeta[d.status].label}: ${d.count}`).join(", ")}>
        {total > 0 && data.filter((d) => d.count > 0).map((d) => (
          <span key={d.status} style={{ width: `${(d.count / total) * 100}%`, background: subscriptionMeta[d.status].color }} className="first:rounded-l-full last:rounded-r-full" />
        ))}
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
        {data.map((d) => (
          <div key={d.status}>
            <dt className="flex items-center gap-2 text-xs text-muted">
              <span className="size-2 rounded-full" style={{ background: subscriptionMeta[d.status].color }} aria-hidden />
              {d.status === "expiring_soon" ? "Expiring in 30 days" : subscriptionMeta[d.status].label}
            </dt>
            <dd className="mt-0.5 text-xl font-semibold">{d.count}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
