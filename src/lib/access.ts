import type { OfficeDoc, UserDoc } from "./types";
import { resolveSubscription } from "./subscription";
import { effectiveSubscription, type SubscriptionSettings } from "./subscription-management";

export type AccessLevel = "allowed" | "restricted" | "denied";
export interface AccessDecision {
  level: AccessLevel;
  reason?: string;
  warning?: string;
}

/**
 * User status + office status + subscription status + exemption -> access decision (SRS 13 and 47).
 * Administrative status and subscription status stay separate: an expired subscription never turns an
 * office into "suspended"; it only restricts access.
 */
export function decideAccess(
  user: Pick<UserDoc, "status" | "officeId">,
  office: OfficeDoc | null,
  headOffice: OfficeDoc | null,
  subscriptionSettings: SubscriptionSettings = { gracePeriodDays: 0, graceMode: "warning_only" },
): AccessDecision {
  if (user.status !== "active") {
    return { level: "denied", reason: "Your account is suspended. Contact your administrator." };
  }
  if (!user.officeId) return { level: "allowed" }; // Super Administrator

  if (!office) return { level: "denied", reason: "Your office could not be found." };

  for (const o of [office, headOffice]) {
    if (!o) continue;
    if (o.status === "suspended")
      return { level: "denied", reason: `${o.name} is suspended. Contact the system administrator.` };
    if (o.status === "blocked")
      return { level: "denied", reason: `${o.name} is blocked from using the system.` };
    if (o.status === "closed") return { level: "denied", reason: `${o.name} is closed.` };
    if (o.status === "pending")
      return { level: "denied", reason: `${o.name} is still awaiting approval.` };
  }

  const sub = effectiveSubscription(office, headOffice);
  const { status } = resolveSubscription(sub);
  if (status === "expired" && sub?.expiresAt && subscriptionSettings.gracePeriodDays > 0) {
    const graceEndsAt = sub.expiresAt.getTime() + subscriptionSettings.gracePeriodDays * 86_400_000;
    if (Date.now() <= graceEndsAt) {
      const warning = `Your subscription expired. The ${subscriptionSettings.gracePeriodDays}-day grace period ends ${new Date(graceEndsAt).toLocaleDateString("en-GB")}.`;
      if (subscriptionSettings.graceMode === "warning_only" || subscriptionSettings.graceMode === "full_access") {
        return { level: "allowed", warning };
      }
      return { level: "restricted", reason: `${warning} Access is restricted during the grace period.` };
    }
  }
  if (status === "expired" || status === "not_subscribed" || status === "cancelled") {
    return { level: "restricted", reason: "Your office subscription is not active. Some actions are limited." };
  }
  return { level: "allowed" };
}
