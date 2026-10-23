"use server";

import bcrypt from "bcryptjs";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/lib/mongodb";
import { SESSION_COOKIE, SESSION_MAX_AGE, signSession } from "@/lib/session";
import { writeAudit } from "@/lib/audit";
import type { UserDoc } from "@/lib/types";

export interface LoginState {
  error?: string;
  email?: string;
}

const schema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
});

const MAX_FAILS = 5;
const LOCK_MINUTES = 15;
// Valid bcrypt hash, so unknown emails cost the same time as wrong passwords.
const DUMMY_HASH = "$2b$10$8BDgtS3/pRUhvFYjaM74le6HacvOo6Dl4X7Mg/od3ZAMfH6vpHCkO";

export async function login(_prev: LoginState, form: FormData): Promise<LoginState> {
  const parsed = schema.safeParse({ email: form.get("email"), password: form.get("password") });
  const emailRaw = String(form.get("email") ?? "");
  if (!parsed.success) return { error: parsed.error.issues[0].message, email: emailRaw };

  const { email, password } = parsed.data;
  const generic = "Email or password is incorrect.";

  let db;
  try {
    db = await getDb();
  } catch {
    return { error: "Can't reach the database. Check MONGODB_URI and try again.", email };
  }

  const users = db.collection<UserDoc>("users");
  const user = await users.findOne({ email });
  const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);

  if (user?.lockedUntil && user.lockedUntil > new Date()) {
    const mins = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
    return { error: `Too many attempts. Try again in ${mins} minute${mins === 1 ? "" : "s"}.`, email };
  }

  if (!user || !ok) {
    if (user) {
      const fails = (user.failedLogins ?? 0) + 1;
      await users.updateOne(
        { _id: user._id },
        fails >= MAX_FAILS
          ? { $set: { failedLogins: 0, lockedUntil: new Date(Date.now() + LOCK_MINUTES * 60000) } }
          : { $set: { failedLogins: fails } },
      );
    }
    return { error: generic, email };
  }

  if (user.status !== "active") {
    return { error: "This account is suspended. Contact your administrator.", email };
  }

  await users.updateOne(
    { _id: user._id },
    { $set: { failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() } },
  );

  const h = await headers();
  await writeAudit({
    userId: user._id,
    userName: user.name,
    officeId: user.officeId ?? null,
    action: "auth.login",
    summary: `${user.name} signed in`,
    entity: "user",
    entityId: user._id.toString(),
    ip: h.get("x-forwarded-for")?.split(",")[0]?.trim(),
  });

  (await cookies()).set(SESSION_COOKIE, await signSession(user._id.toString()), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });

  const next = String(form.get("next") ?? "");
  redirect(next.startsWith("/dashboard") ? next : "/dashboard");
}
