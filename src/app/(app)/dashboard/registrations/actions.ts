"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { decideRegistration as decide } from "@/lib/registration-review";

export interface ReviewState { ok?: boolean; message?: string; error?: string }

const schema = z.object({
  id: z.string().min(1),
  decision: z.enum(["approve", "reject", "info"]),
  remarks: z.string().trim().max(500, "Keep remarks under 500 characters.").optional(),
  trialDays: z.coerce.number().int().min(0).max(365).default(30),
});

export async function reviewRegistration(_prev: ReviewState, form: FormData): Promise<ReviewState> {
  // Server-side check: only the Super Administrator can decide, whatever the UI shows.
  const user = await getCurrentUser();
  if (!user || user.scope !== "system" || user.access.level !== "allowed") {
    return { error: "Only the system administrator can review registrations." };
  }

  const parsed = schema.safeParse({
    id: form.get("id"),
    decision: form.get("decision"),
    remarks: form.get("remarks") ?? "",
    trialDays: form.get("trialDays") ?? 30,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { id, decision, remarks, trialDays } = parsed.data;
  if (decision !== "approve" && !remarks) {
    return { error: decision === "reject" ? "Add a reason for rejecting this request." : "Say which documents or details are missing." };
  }

  const res = await decide({ id, decision, remarks: remarks || null, trialDays, actor: { id: user.id, name: user.name } });
  if (!res.ok) return { error: res.error };

  revalidatePath("/dashboard", "layout");
  return { ok: true, message: res.message };
}
