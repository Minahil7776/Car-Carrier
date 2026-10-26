import "server-only";
import { randomUUID } from "crypto";
import { SignJWT, jwtVerify } from "jose";
import type { Binary, Collection, ObjectId } from "mongodb";
import { getDb } from "./mongodb";
import { UPLOAD_LIMITS } from "./signup-config";

/**
 * Anonymous visitors have no session, so each signup page load gets a signed, expiring "draft token".
 * Uploaded files are tied to that token until the registration is submitted, then to the registration.
 */
function key() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) throw new Error("AUTH_SECRET is missing or too short.");
  return new TextEncoder().encode(secret);
}

export async function createDraftToken() {
  return new SignJWT({ did: randomUUID(), typ: "signup-draft" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${UPLOAD_LIMITS.draftHours}h`)
    .sign(key());
}

/** Returns the draft id, or null when the token is missing, forged or expired. */
export async function verifyDraftToken(token?: string | null) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"] });
    return payload.typ === "signup-draft" && typeof payload.did === "string" ? payload.did : null;
  } catch {
    return null;
  }
}

export interface RegFileDoc {
  _id: ObjectId;
  draftId: string;
  registrationId: ObjectId | null; // null while it is still a draft
  docType: string;
  name: string;
  mime: string;
  size: number;
  data: Binary;
  createdAt: Date;
  expiresAt?: Date; // drafts only: a TTL index deletes them, so abandoned uploads never pile up
}

let ready: Promise<unknown> | null = null;
export async function filesCollection(): Promise<Collection<RegFileDoc>> {
  const col = (await getDb()).collection<RegFileDoc>("registration_files");
  ready ??= Promise.all([
    col.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    col.createIndex({ draftId: 1, registrationId: 1 }),
    col.createIndex({ registrationId: 1 }),
  ]).catch((e) => { ready = null; throw e; });
  await ready;
  return col;
}

/** Identify the real type from the file's first bytes, so a renamed file can't pass as a PDF or image. */
export function sniffMime(b: Buffer): string | null {
  if (b.length >= 5 && b.subarray(0, 5).toString("latin1") === "%PDF-") return "application/pdf";
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  return null;
}
