import type { OfficeSubscription, SubscriptionStatus } from "./types";

const DAY = 86_400_000;
export const EXPIRING_SOON_DAYS = 30;

/**
 * Subscription status is derived from dates, never stored, so it can't drift.
 * Exemption wins over expiry (SRS FR-SUB-001 / section 47).
 */
export function resolveSubscription(sub?: OfficeSubscription | null, now = new Date()) {
  if (!sub) return { status: "not_subscribed" as SubscriptionStatus, daysLeft: null as number | null };
  if (sub.cancelled) return { status: "cancelled" as SubscriptionStatus, daysLeft: null };

  const t = now.getTime();
  const exemptActive =
    sub.exemptUntil && sub.exemptUntil.getTime() >= t && (!sub.exemptFrom || sub.exemptFrom.getTime() <= t);
  if (exemptActive) {
    return { status: "exempt" as SubscriptionStatus, daysLeft: Math.ceil((sub.exemptUntil!.getTime() - t) / DAY) };
  }
  if (!sub.expiresAt) return { status: "not_subscribed" as SubscriptionStatus, daysLeft: null };

  const daysLeft = Math.ceil((sub.expiresAt.getTime() - t) / DAY);
  if (daysLeft < 0) return { status: "expired" as SubscriptionStatus, daysLeft };
  if (daysLeft <= EXPIRING_SOON_DAYS) return { status: "expiring_soon" as SubscriptionStatus, daysLeft };
  return { status: "active" as SubscriptionStatus, daysLeft };
}
