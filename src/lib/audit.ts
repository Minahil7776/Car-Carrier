import "server-only";
import { getDb } from "./mongodb";
import type { AuditLogDoc } from "./types";

type Entry = Omit<AuditLogDoc, "_id" | "createdAt">;

/** Append-only. Nothing in the app edits or deletes audit rows (SRS section 35). */
export async function writeAudit(entry: Entry) {
  try {
    const db = await getDb();
    await db.collection<Omit<AuditLogDoc, "_id">>("audit_logs").insertOne({ ...entry, createdAt: new Date() });
  } catch (err) {
    console.error("audit write failed", err);
  }
}
