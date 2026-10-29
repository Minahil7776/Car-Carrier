"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { statusChangeSchema } from "@/lib/office-schema";
import { changeOfficeStatus } from "@/lib/office-status";

export interface StatusState { ok?: boolean; message?: string; error?: string }

/** Suspend, block, close or reactivate an office (FR-ORG-007). Only the Super Administrator can do this, whatever the UI shows. */
export async function updateOfficeStatus(_prev: StatusState, form: FormData): Promise<StatusState> {
  const user = await getCurrentUser();
  if (!user || user.scope !== "system" || user.access.level !== "allowed") {
    return { error: "Only the system administrator can change an office's status." };
  }
  const parsed = statusChangeSchema.safeParse({ id: form.get("id"), to: form.get("to"), reason: form.get("reason") ?? "" });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const res = await changeOfficeStatus({ officeId: parsed.data.id, to: parsed.data.to, reason: parsed.data.reason, actor: { id: user.id, name: user.name } });
  if (!res.ok) return { error: res.error };

  revalidatePath("/dashboard", "layout");
  return { ok: true, message: res.message };
}
