import "server-only";
import { ObjectId, type Db } from "mongodb";
import type { CurrentUser } from "@/lib/auth";
import type { OfficeDoc, RoleDoc, Scope } from "@/lib/types";

export interface ManagedOffice {
  id: string;
  name: string;
  code: string;
  type: "head" | "branch";
  headOfficeId: string;
  headOfficeName: string;
}

export interface ManagedRole {
  key: string;
  name: string;
  scope: "head" | "branch";
  description: string;
  isCustom: boolean;
  status: "active" | "inactive";
  headOfficeId: string | null;
  headOfficeName: string | null;
  permissions: string[];
}

export async function getManagedOffices(db: Db, user: CurrentUser): Promise<ManagedOffice[]> {
  const offices = db.collection<OfficeDoc>("offices");
  let rows: OfficeDoc[];

  if (user.scope === "system") {
    rows = await offices.find({ type: { $in: ["head", "branch"] } }).sort({ name: 1 }).toArray();
  } else if (user.scope === "head" && user.office) {
    const headId = new ObjectId(user.office.id);
    rows = await offices.find({ $or: [{ _id: headId }, { type: "branch", parentId: headId }] }).sort({ type: -1, name: 1 }).toArray();
  } else if (user.scope === "branch" && user.office) {
    const office = await offices.findOne({ _id: new ObjectId(user.office.id), type: "branch" });
    rows = office ? [office] : [];
  } else {
    rows = [];
  }

  const headIds = [...new Set(
    rows
      .map((office) => office.type === "head" ? office._id.toString() : office.parentId?.toString())
      .filter((id): id is string => Boolean(id)),
  )];
  const heads = headIds.length
    ? await offices.find({ _id: { $in: headIds.map((id) => new ObjectId(id)) }, type: "head" }).toArray()
    : [];
  const headNames = new Map(heads.map((head) => [head._id.toString(), head.name]));

  return rows.map((office) => {
    const headOfficeId = office.type === "head" ? office._id.toString() : office.parentId?.toString() ?? "";
    return {
      id: office._id.toString(),
      name: office.name,
      code: office.code,
      type: office.type,
      headOfficeId,
      headOfficeName: office.type === "head" ? office.name : headNames.get(headOfficeId) ?? "Head office",
    };
  });
}

export async function getAssignableRoles(
  db: Db,
  scope: Exclude<Scope, "system">,
  headOfficeId: string,
  includeInactive = false,
): Promise<RoleDoc[]> {
  return db.collection<RoleDoc>("roles").find({
    scope,
    ...(includeInactive ? {} : { status: { $ne: "inactive" } }),
    $or: [
      { isCustom: { $ne: true } },
      { isCustom: true, headOfficeId: new ObjectId(headOfficeId) },
    ],
  }).sort({ isCustom: 1, name: 1 }).toArray();
}

export function isManagedRole(user: CurrentUser, role: RoleDoc) {
  if (!role.isCustom || !role.headOfficeId) return false;
  if (user.scope === "system") return true;
  return user.scope === "head" && role.headOfficeId.toString() === user.office?.id;
}

export function toManagedRole(role: RoleDoc, headOfficeName: string | null = null): ManagedRole {
  return {
    key: role.key,
    name: role.name,
    scope: role.scope === "head" ? "head" : "branch",
    description: role.description ?? "",
    isCustom: role.isCustom === true,
    status: role.status === "inactive" ? "inactive" : "active",
    headOfficeId: role.headOfficeId?.toString() ?? null,
    headOfficeName,
    permissions: role.permissions,
  };
}
