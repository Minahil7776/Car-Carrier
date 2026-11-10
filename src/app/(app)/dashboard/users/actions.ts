"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { can, getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";
import { writeAudit } from "@/lib/audit";
import { getAssignableRoles, getManagedOffices } from "@/lib/user-management";
import type { UserDoc } from "@/lib/types";

export interface UserFormState {
  ok?: boolean;
  message?: string;
  error?: string;
  fieldErrors?: Record<string, string>;
}

const userFields = z.object({
  name: z.string().trim().min(2, "Enter a name.").max(100, "Name must be 100 characters or fewer."),
  email: z.string().trim().toLowerCase().email("Enter a valid email address.").max(254),
  officeId: z.string().regex(/^[a-f\d]{24}$/i, "Select an office."),
});
const passwordField = z.string().min(12, "Use a password with at least 12 characters.").max(128);
const nameField = userFields.shape.name;

function roleKeysFrom(form: FormData) {
  return [...new Set(form.getAll("roleKeys").filter((value): value is string => typeof value === "string"))];
}

async function actorWithPermission(permission: string, requiresActive = true) {
  const actor = await getCurrentUser();
  if (!actor || !can(actor, permission) || (requiresActive && actor.access.level !== "allowed")) return null;
  return actor;
}

async function selectedRoles(
  db: Awaited<ReturnType<typeof getDb>>,
  office: { type: "head" | "branch"; headOfficeId: string },
  keys: string[],
) {
  if (!keys.length || keys.some((key) => key.length > 100)) return null;
  const available = await getAssignableRoles(db, office.type, office.headOfficeId);
  const roles = available.filter((role) => keys.includes(role.key));
  return roles.length === keys.length ? roles : null;
}

export async function createUser(_prev: UserFormState, form: FormData): Promise<UserFormState> {
  const actor = await actorWithPermission("user.create");
  if (!actor) return { error: "You do not have permission to create users." };

  const parsed = userFields.safeParse({
    name: form.get("name"),
    email: form.get("email"),
    officeId: form.get("officeId"),
  });
  const password = passwordField.safeParse(form.get("password"));
  if (!parsed.success || !password.success) {
    const fieldErrors: Record<string, string> = {};
    if (!parsed.success) for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] = issue.message;
    if (!password.success) fieldErrors.password = password.error.issues[0]?.message ?? "Enter a valid password.";
    return { fieldErrors };
  }
  const data = parsed.data;
  const initialPassword = password.data;

  const db = await getDb();
  const offices = await getManagedOffices(db, actor);
  const office = offices.find((candidate) => candidate.id === data.officeId);
  if (!office) return { fieldErrors: { officeId: "Choose an office within your organizational scope." } };

  const roleKeys = roleKeysFrom(form);
  const roles = await selectedRoles(db, office, roleKeys);
  if (!roles) return { fieldErrors: { roleKeys: "Select at least one active role available to this office." } };

  const users = db.collection<UserDoc>("users");
  if (await users.findOne({ email: data.email })) {
    return { fieldErrors: { email: "An account already uses this email address." } };
  }

  const now = new Date();
  const officeId = new ObjectId(office.id);
  const userId = new ObjectId();
  try {
    const result = await users.insertOne({
      _id: userId,
      name: data.name,
      email: data.email,
      passwordHash: await bcrypt.hash(initialPassword, 12),
      status: "active",
      officeId,
      roleKeys,
      createdAt: now,
    });
    await writeAudit({
      userId: new ObjectId(actor.id),
      userName: actor.name,
      headOfficeId: new ObjectId(office.headOfficeId),
      officeId,
      action: "user.create",
      summary: `Created user ${data.name} for ${office.name}`,
      entity: "user",
      entityId: result.insertedId.toString(),
    });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === 11000) {
      return { fieldErrors: { email: "An account already uses this email address." } };
    }
    console.error("user creation failed", error);
    return { error: "The user could not be created. Please try again." };
  }

  revalidatePath("/dashboard/users");
  return { ok: true, message: "User created." };
}

export async function updateUser(_prev: UserFormState, form: FormData): Promise<UserFormState> {
  const actor = await actorWithPermission("user.update");
  if (!actor) return { error: "You do not have permission to update users." };

  const id = String(form.get("id") ?? "");
  const name = nameField.safeParse(form.get("name"));
  if (!ObjectId.isValid(id)) return { error: "This user could not be found." };
  if (!name.success) return { fieldErrors: { name: name.error.issues[0]?.message ?? "Enter a valid name." } };

  const db = await getDb();
  const offices = await getManagedOffices(db, actor);
  const officeIds = offices.map((office) => new ObjectId(office.id));
  const target = await db.collection<UserDoc>("users").findOne({
    _id: new ObjectId(id),
    officeId: { $in: officeIds },
  });
  if (!target?.officeId) return { error: "This user is outside your organizational scope." };

  const office = offices.find((candidate) => candidate.id === target.officeId!.toString());
  if (!office) return { error: "This user's office could not be found." };

  const canChangeRoles = target._id.toString() !== actor.id;
  const roleKeys = canChangeRoles ? roleKeysFrom(form) : target.roleKeys;
  const roles = canChangeRoles ? await selectedRoles(db, office, roleKeys) : [];
  if (canChangeRoles && !roles) {
    return { fieldErrors: { roleKeys: "Select at least one active role available to this office." } };
  }

  const inactiveRoles = canChangeRoles ? await db.collection("roles").find({
    key: { $in: target.roleKeys },
    status: "inactive",
    scope: office.type,
    $or: [
      { isCustom: { $ne: true } },
      { isCustom: true, headOfficeId: new ObjectId(office.headOfficeId) },
    ],
  }).toArray() : [];
  const nextRoleKeys = canChangeRoles
    ? [...new Set([...roleKeys, ...inactiveRoles.map((role) => String(role.key))])]
    : target.roleKeys;
  const changedRoles = [...target.roleKeys].sort().join(",") !== [...nextRoleKeys].sort().join(",");

  try {
    await db.collection<UserDoc>("users").updateOne(
      { _id: target._id, officeId: target.officeId },
      { $set: { name: name.data, roleKeys: nextRoleKeys } },
    );
    if (target.name !== name.data || changedRoles) {
      await writeAudit({
        userId: new ObjectId(actor.id),
        userName: actor.name,
        headOfficeId: new ObjectId(office.headOfficeId),
        officeId: target.officeId,
        action: "user.update",
        summary: `Updated user ${target.name}`,
        entity: "user",
        entityId: id,
      });
    }
  } catch (error) {
    console.error("user update failed", error);
    return { error: "The user could not be updated. Please try again." };
  }

  revalidatePath("/dashboard/users");
  revalidatePath(`/dashboard/users/${id}/edit`);
  return { ok: true, message: "User updated." };
}

export async function changeUserStatus(_prev: UserFormState, form: FormData): Promise<UserFormState> {
  const actor = await actorWithPermission("user.suspend");
  if (!actor) return { error: "You do not have permission to change user status." };

  const id = String(form.get("id") ?? "");
  const status = String(form.get("status") ?? "");
  if (!ObjectId.isValid(id) || (status !== "active" && status !== "suspended")) {
    return { error: "Choose a valid user and status." };
  }
  if (id === actor.id) return { error: "You cannot suspend or reactivate your own account." };

  const db = await getDb();
  const offices = await getManagedOffices(db, actor);
  const officeIds = offices.map((office) => new ObjectId(office.id));
  const target = await db.collection<UserDoc>("users").findOne({
    _id: new ObjectId(id),
    officeId: { $in: officeIds },
  });
  if (!target?.officeId) return { error: "This user is outside your organizational scope." };
  if (target.status === status) return { ok: true, message: `User is already ${status}.` };

  const office = offices.find((candidate) => candidate.id === target.officeId!.toString());
  if (!office) return { error: "This user's office could not be found." };

  try {
    await db.collection<UserDoc>("users").updateOne(
      { _id: target._id, officeId: target.officeId, status: target.status },
      { $set: { status } },
    );
    await writeAudit({
      userId: new ObjectId(actor.id),
      userName: actor.name,
      headOfficeId: new ObjectId(office.headOfficeId),
      officeId: target.officeId,
      action: status === "suspended" ? "user.suspend" : "user.reactivate",
      summary: `${status === "suspended" ? "Suspended" : "Reactivated"} user ${target.name}`,
      entity: "user",
      entityId: id,
    });
  } catch (error) {
    console.error("user status update failed", error);
    return { error: "The user status could not be changed. Please try again." };
  }

  revalidatePath("/dashboard/users");
  return { ok: true, message: status === "suspended" ? "User suspended." : "User reactivated." };
}
