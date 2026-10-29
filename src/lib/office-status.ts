import "server-only";
import { ObjectId } from "mongodb";
import { getDb } from "./mongodb";
import { writeAudit } from "./audit";
import { STATUS_ACTION_COPY, STATUS_TRANSITIONS } from "./office-schema";
import type { OfficeDoc, OfficeStatus, OfficeStatusHistoryDoc, UserDoc } from "./types";

const AUDIT_ACTION: Record<OfficeStatus, string> = {
  active: "office.reactivate", suspended: "office.suspend", blocked: "office.block", closed: "office.close", pending: "office.pending",
};

export type StatusResult = { ok: true; message: string } | { ok: false; error: string };

/**
 * Suspend, block, close or reactivate a head office or a branch (SRS FR-ORG-006 / FR-ORG-007).
 * Access is decided from the live status on every request (see access.ts), so this takes effect immediately
 * for the office's users, and for a head office it also covers every branch beneath it.
 */
export async function changeOfficeStatus(input: {
  officeId: string; to: OfficeStatus; reason: string; actor: { id: string; name: string };
}): Promise<StatusResult> {
  const { officeId, to, reason, actor } = input;
  if (!ObjectId.isValid(officeId)) return { ok: false, error: "This office could not be found." };

  const db = await getDb();
  const offices = db.collection<OfficeDoc>("offices");
  const _id = new ObjectId(officeId);
  const office = await offices.findOne({ _id });
  if (!office) return { ok: false, error: "This office could not be found." };
  if (office.status === to) return { ok: false, error: `${office.name} is already ${to}.` };
  if (!STATUS_TRANSITIONS[office.status].includes(to)) return { ok: false, error: `A ${office.status} office can't be changed to ${to}.` };

  const now = new Date();
  // Only applies if the status is still what we read, so two administrators can't overwrite each other.
  const res = await offices.updateOne({ _id, status: office.status }, { $set: { status: to, statusReason: reason, statusChangedAt: now, updatedAt: now } });
  if (!res.modifiedCount) return { ok: false, error: "This office was just changed by someone else. Refresh and try again." };

  const headOfficeId = office.type === "head" ? office._id : (office.parentId as ObjectId);
  await db.collection<Omit<OfficeStatusHistoryDoc, "_id">>("office_status_history").insertOne({
    officeId: _id, headOfficeId, from: office.status, to, reason, byId: new ObjectId(actor.id), byName: actor.name, at: now,
  });
  await writeAudit({
    userId: new ObjectId(actor.id), userName: actor.name, headOfficeId, officeId: office.type === "branch" ? _id : null,
    action: AUDIT_ACTION[to], summary: `${STATUS_ACTION_COPY[to].verb} ${office.name}: ${reason}`, entity: "office", entityId: officeId,
  });

  // In-system notifications (SRS section 36). A head office change reaches its branches too.
  const officeIds = [_id];
  if (office.type === "head") {
    const branches = await offices.find({ parentId: _id }, { projection: { _id: 1 } }).toArray();
    officeIds.push(...branches.map((b) => b._id));
  }
  const filter = office.type === "head"
    ? { officeId: { $in: officeIds } }
    : { $or: [{ officeId: _id }, { officeId: headOfficeId, roleKeys: "ho_admin" }] };
  const recipients = await db.collection<UserDoc>("users").find(filter, { projection: { _id: 1 } }).limit(500).toArray();
  if (recipients.length) {
    const title = to === "active" ? `${office.name} reactivated` : `${office.name} ${to}`;
    const body = to === "active" ? "Access has been restored." : `Reason: ${reason}`;
    await db.collection("notifications").insertMany(recipients.map((u) => ({ userId: u._id, title, body, read: false, createdAt: now })));
  }

  return { ok: true, message: `${office.name} ${to === "active" ? "reactivated" : to}.` };
}
