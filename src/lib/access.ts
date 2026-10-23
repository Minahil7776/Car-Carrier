import type { OfficeDoc, UserDoc } from "./types";
import { resolveSubscription } from "./subscription";

export type AccessLevel = "allowed" | "restricted" | "denied";
export interface AccessDecision {
  level: AccessLevel;
  reason?: string;
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

  // A branch without its own subscription inherits its head office's.
  const sub = office.subscription ?? headOffice?.subscription;
  const { status } = resolveSubscription(sub);
  if (status === "expired" || status === "not_subscribed" || status === "cancelled") {
    return { level: "restricted", reason: "Your office subscription is not active. Some actions are limited." };
  }
  return { level: "allowed" };
}
