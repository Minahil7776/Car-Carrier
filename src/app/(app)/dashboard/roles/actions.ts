"use server";

import { revalidatePath } from "next/cache";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { can, getCurrentUser } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { getDb } from "@/lib/mongodb";
import { PERMISSION_KEYS } from "@/lib/permissions";
import { getManagedOffices, isManagedRole } from "@/lib/user-management";
import type { RoleDoc, UserDoc } from "@/lib/types";

export interface RoleFormState {
  ok?: boolean;
  message?: string;
  error?: string;
  fieldErrors?: Record<string, string>;
}

const roleSchema = z.object({
  name: z.string().trim().min(2, "Enter a role name.").max(80, "Role name must be 80 characters or fewer."),
  description: z.string().trim().max(300, "Description must be 300 characters or fewer."),
  scope: z.enum(["head", "branch"]),
  officeId: z.string().regex(/^[a-f\d]{24}$/i, "Select a head office."),
});

function getPermissionKeys(form: FormData) {
  return [...new Set(form.getAll("permissions").filter((value): value is string => typeof value === "string"))];
}

async function actorWithPermission(permission: string) {
  const actor = await getCurrentUser();
  if (!actor || !can(actor, permission) || actor.access.level !== "allowed") return null;
  return actor;
}

async function getRoleOffice(user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>, officeId: string) {
  const db = await getDb();
  const offices = await getManagedOffices(db, user);
  return offices.find((office) => office.id === officeId && office.type === "head") ?? null;
}

function validPermissions(keys: string[]) {
  return keys.length > 0 && keys.every((key) => PERMISSION_KEYS.has(key));
}

export async function createRole(_prev: RoleFormState, form: FormData): Promise<RoleFormState> {
  const actor = await actorWithPermission("role.create");
  if (!actor) return { error: "You do not have permission to create roles." };

  const parsed = roleSchema.safeParse({
    name: form.get("name"),
    description: form.get("description") ?? "",
    scope: form.get("scope"),
    officeId: form.get("officeId"),
  });
  if (!parsed.success) {
    return { fieldErrors: Object.fromEntries(parsed.error.issues.map((issue) => [String(issue.path[0]), issue.message])) };
  }
  const permissions = getPermissionKeys(form);
  if (!validPermissions(permissions)) return { fieldErrors: { permissions: "Select at least one valid permission." } };

  const office = await getRoleOffice(actor, parsed.data.officeId);
  if (!office) return { fieldErrors: { officeId: "Choose a head office within your organizational scope." } };
  if (actor.scope === "branch") return { error: "Branch users cannot create roles." };

  const db = await getDb();
  const escapedName = parsed.data.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const nameExists = await db.collection<RoleDoc>("roles").findOne({
    name: { $regex: `^${escapedName}$`, $options: "i" },
    isCustom: true,
    headOfficeId: new ObjectId(office.headOfficeId),
    scope: parsed.data.scope,
  });
  if (nameExists) return { fieldErrors: { name: "A custom role with this name already exists for this office." } };

  const roleId = new ObjectId();
  const key = `custom_${office.headOfficeId.slice(-8)}_${parsed.data.scope}_${parsed.data.name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40)}_${roleId.toString().slice(-6)}`;
  try {
    await db.collection<RoleDoc>("roles").insertOne({
      _id: roleId,
      key,
      name: parsed.data.name,
      description: parsed.data.description,
      scope: parsed.data.scope,
      status: "active",
      isCustom: true,
      headOfficeId: new ObjectId(office.headOfficeId),
      permissions,
      createdById: new ObjectId(actor.id),
      createdAt: new Date(),
    });
    await writeAudit({
      userId: new ObjectId(actor.id),
      userName: actor.name,
      headOfficeId: new ObjectId(office.headOfficeId),
      officeId: new ObjectId(office.id),
      action: "role.create",
      summary: `Created ${parsed.data.scope}-office role ${parsed.data.name}`,
      entity: "role",
      entityId: key,
    });
  } catch (error) {
    console.error("role creation failed", error);
    return { error: "The role could not be created. Please try again." };
  }

  revalidatePath("/dashboard/roles");
  return { ok: true, message: "Role created." };
}

export async function updateRole(_prev: RoleFormState, form: FormData): Promise<RoleFormState> {
  const actor = await actorWithPermission("role.update");
  if (!actor) return { error: "You do not have permission to update roles." };

  const key = String(form.get("key") ?? "");
  const parsed = roleSchema.omit({ scope: true }).safeParse({
    name: form.get("name"),
    description: form.get("description") ?? "",
    officeId: form.get("officeId"),
  });
  if (!key || !parsed.success) {
    return {
      fieldErrors: parsed.success ? undefined : Object.fromEntries(parsed.error.issues.map((issue) => [String(issue.path[0]), issue.message])),
      ...(key ? {} : { error: "This role could not be found." }),
    };
  }
  const permissions = getPermissionKeys(form);
  if (!validPermissions(permissions)) return { fieldErrors: { permissions: "Select at least one valid permission." } };

  const office = await getRoleOffice(actor, parsed.data.officeId);
  if (!office) return { fieldErrors: { officeId: "Choose a head office within your organizational scope." } };

  const db = await getDb();
  const role = await db.collection<RoleDoc>("roles").findOne({ key, isCustom: true });
  if (!role || !isManagedRole(actor, role) || role.headOfficeId?.toString() !== office.headOfficeId) {
    return { error: "This custom role is outside your organizational scope." };
  }
  const assignedToActor = await db.collection<UserDoc>("users").findOne({ _id: new ObjectId(actor.id), roleKeys: key });
  if (assignedToActor) return { error: "You cannot change a role assigned to your own account." };

  const escapedName = parsed.data.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const nameExists = await db.collection<RoleDoc>("roles").findOne({
    _id: { $ne: role._id },
    name: { $regex: `^${escapedName}$`, $options: "i" },
    isCustom: true,
    headOfficeId: new ObjectId(office.headOfficeId),
    scope: role.scope,
  });
  if (nameExists) return { fieldErrors: { name: "A custom role with this name already exists for this office." } };

  try {
    await db.collection<RoleDoc>("roles").updateOne(
      { _id: role._id, isCustom: true },
      { $set: { name: parsed.data.name, description: parsed.data.description, permissions, updatedAt: new Date() } },
    );
    await writeAudit({
      userId: new ObjectId(actor.id),
      userName: actor.name,
      headOfficeId: new ObjectId(office.headOfficeId),
      officeId: new ObjectId(office.id),
      action: "role.update",
      summary: `Updated custom role ${role.name}`,
      entity: "role",
      entityId: key,
    });
  } catch (error) {
    console.error("role update failed", error);
    return { error: "The role could not be updated. Please try again." };
  }

  revalidatePath("/dashboard/roles");
  revalidatePath(`/dashboard/roles/${encodeURIComponent(key)}/edit`);
  revalidatePath("/dashboard/users");
  return { ok: true, message: "Role updated." };
}

export async function changeRoleStatus(_prev: RoleFormState, form: FormData): Promise<RoleFormState> {
  const actor = await actorWithPermission("role.update");
  if (!actor) return { error: "You do not have permission to change role status." };

  const key = String(form.get("key") ?? "");
  const status = String(form.get("status") ?? "");
  if (!key || (status !== "active" && status !== "inactive")) return { error: "Choose a valid role and status." };

  const db = await getDb();
  const role = await db.collection<RoleDoc>("roles").findOne({ key, isCustom: true });
  if (!role || !isManagedRole(actor, role)) return { error: "This custom role is outside your organizational scope." };
  if (status === "inactive") {
    const assignedToActor = await db.collection<UserDoc>("users").findOne({ _id: new ObjectId(actor.id), roleKeys: key });
    if (assignedToActor) return { error: "You cannot deactivate a role assigned to your own account." };
  }
  if (role.status === status) return { ok: true, message: `Role is already ${status}.` };

  try {
    await db.collection<RoleDoc>("roles").updateOne(
      { _id: role._id, isCustom: true },
      { $set: { status, updatedAt: new Date() } },
    );
    await writeAudit({
      userId: new ObjectId(actor.id),
      userName: actor.name,
      headOfficeId: role.headOfficeId,
      officeId: role.headOfficeId,
      action: "role.update",
      summary: `${status === "active" ? "Reactivated" : "Deactivated"} custom role ${role.name}`,
      entity: "role",
      entityId: key,
    });
  } catch (error) {
    console.error("role status update failed", error);
    return { error: "The role status could not be changed. Please try again." };
  }

  revalidatePath("/dashboard/roles");
  revalidatePath("/dashboard/users");
  return { ok: true, message: status === "active" ? "Role reactivated." : "Role deactivated." };
}
