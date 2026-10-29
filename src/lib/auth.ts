import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { ObjectId } from "mongodb";
import { getDb } from "./mongodb";
import { SESSION_COOKIE, verifySession } from "./session";
import { decideAccess, type AccessDecision } from "./access";
import { getSubscriptionSettings } from "./subscription-management";
import type { OfficeDoc, RoleDoc, Scope, UserDoc } from "./types";

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  scope: Scope;
  roleNames: string[];
  permissions: string[];
  office: { id: string; code: string; name: string; city: string; type: "head" | "branch" } | null;
  headOffice: { id: string; code: string; name: string } | null;
  access: AccessDecision;
}

/**
 * Loads the signed-in user fresh from the database on every request, so suspending a user or an
 * office takes effect immediately instead of waiting for a token to expire (SRS FR-ORG-007).
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const store = await cookies();
  const uid = await verifySession(store.get(SESSION_COOKIE)?.value);
  if (!uid || !ObjectId.isValid(uid)) return null;

  const db = await getDb();
  const user = await db.collection<UserDoc>("users").findOne({ _id: new ObjectId(uid) });
  if (!user) return null;

  const office = user.officeId
    ? await db.collection<OfficeDoc>("offices").findOne({ _id: user.officeId })
    : null;
  const headOffice =
    office?.type === "branch" && office.parentId
      ? await db.collection<OfficeDoc>("offices").findOne({ _id: office.parentId })
      : office?.type === "head"
        ? office
        : null;

  const roles = await db.collection<RoleDoc>("roles").find({ key: { $in: user.roleKeys } }).toArray();
  const subscriptionSettings = office ? await getSubscriptionSettings() : { gracePeriodDays: 0, graceMode: "warning_only" as const };
  const scope: Scope = !office ? "system" : office.type === "head" ? "head" : "branch";
  const access = decideAccess(user, office, headOffice, subscriptionSettings);

  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    scope,
    roleNames: roles.map((r) => r.name),
    permissions: [...new Set(roles.flatMap((r) => r.permissions))],
    office: office
      ? { id: office._id.toString(), code: office.code, name: office.name, city: office.city, type: office.type }
      : null,
    headOffice: headOffice
      ? { id: headOffice._id.toString(), code: headOffice.code, name: headOffice.name }
      : null,
    access,
  };
});

export function can(user: CurrentUser, permission: string) {
  // The Super Administrator role carries the "*" wildcard.
  return user.permissions.includes("*") || user.permissions.includes(permission);
}
