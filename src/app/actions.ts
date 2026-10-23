"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ObjectId } from "mongodb";
import { SESSION_COOKIE } from "@/lib/session";
import { getDb } from "@/lib/mongodb";
import { getCurrentUser } from "@/lib/auth";

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}

export async function markNotificationsRead() {
  const user = await getCurrentUser();
  if (!user) return;
  const db = await getDb();
  await db.collection("notifications").updateMany({ userId: new ObjectId(user.id), read: false }, { $set: { read: true } });
}
