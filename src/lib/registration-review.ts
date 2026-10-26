import "server-only";
import { ObjectId } from "mongodb";
import { getDb } from "./mongodb";
import { writeAudit } from "./audit";

const OPEN = ["pending", "under_review", "info_required"];
export type Decision = "approve" | "reject" | "info";
export type DecideResult = { ok: true; message: string } | { ok: false; error: string };

/**
 * One place for review decisions, used by the dashboard. Approving is claimed atomically first,
 * so two administrators clicking at once cannot create the same company twice.
 */
export async function decideRegistration(input: {
  id: string;
  decision: Decision;
  remarks: string | null;
  trialDays: number;
  actor: { id: string; name: string };
}): Promise<DecideResult> {
  const { id, decision, remarks, trialDays, actor } = input;
  if (!ObjectId.isValid(id)) return { ok: false, error: "This request could not be found." };

  const db = await getDb();
  const regs = db.collection("registrations");
  const _id = new ObjectId(id);
  const now = new Date();
  const actorId = new ObjectId(actor.id);
  const entry = (action: string) => ({ at: now, by: actor.name, action, remarks });

  const current = await regs.findOne({ _id });
  if (!current) return { ok: false, error: "This request could not be found." };
  if (!OPEN.includes(current.status)) return { ok: false, error: "This request has already been decided." };

  const applicant = await db.collection("users").findOne({ email: current.applicantEmail });
  const notify = async (title: string, body: string) => {
    if (applicant) await db.collection("notifications").insertOne({ userId: applicant._id, title, body, read: false, createdAt: now });
  };

  if (decision === "info") {
    await regs.updateOne({ _id, status: { $in: OPEN } }, { $set: { status: "info_required", reviewRemarks: remarks }, $push: { history: entry("info_requested") } as never });
    await writeAudit({ userId: actorId, userName: actor.name, headOfficeId: current.parentId ?? null, officeId: null, action: "office.request_info", summary: `Requested documents from ${current.officeName}`, entity: "registration", entityId: id });
    await notify("More information needed", `${current.officeName}: ${remarks}`);
    return { ok: true, message: "Marked as needing documents." };
  }

  if (decision === "reject") {
    const res = await regs.updateOne({ _id, status: { $in: OPEN } }, { $set: { status: "rejected", reviewedAt: now, reviewRemarks: remarks }, $unset: { passwordHash: "" }, $push: { history: entry("rejected") } as never });
    if (!res.modifiedCount) return { ok: false, error: "This request has already been decided." };
    await writeAudit({ userId: actorId, userName: actor.name, headOfficeId: current.parentId ?? null, officeId: null, action: "office.reject", summary: `Rejected registration for ${current.officeName}`, entity: "registration", entityId: id });
    await notify("Request not approved", `${current.officeName}: ${remarks}`);
    return { ok: true, message: "Registration rejected." };
  }

  // Approve: claim first (atomic), then create records. Undo the claim if anything fails.
  const claimed = await regs.findOneAndUpdate(
    { _id, status: { $in: OPEN } },
    { $set: { status: "approved", reviewedAt: now, reviewRemarks: remarks }, $push: { history: entry("approved") } as never },
    { returnDocument: "before" },
  );
  if (!claimed) return { ok: false, error: "This request has already been decided." };
  const reg = claimed;

  try {
    const offices = db.collection("offices");
    const officeId = new ObjectId();

    if (reg.kind === "branch") {
      const prefix = `BR-${String(reg.city).replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase().padEnd(3, "X")}`;
      let n = (await offices.countDocuments({ code: { $regex: `^${prefix}-` } })) + 1;
      while (await offices.findOne({ code: `${prefix}-${String(n).padStart(3, "0")}` })) n++;
      await offices.insertOne({ _id: officeId, code: `${prefix}-${String(n).padStart(3, "0")}`, name: reg.officeName, type: "branch", parentId: reg.parentId, city: reg.city, country: "Pakistan", status: "active", createdAt: now });
      await writeAudit({ userId: actorId, userName: actor.name, headOfficeId: reg.parentId, officeId, action: "office.approve", summary: `Approved branch ${reg.officeName}`, entity: "office", entityId: officeId.toString() });
      await notify("Branch approved", `${reg.officeName} is now active.`);
      return { ok: true, message: `${reg.officeName} approved as a branch.` };
    }

    let n = (await offices.countDocuments({ type: "head" })) + 1;
    while (await offices.findOne({ code: `HO-${String(n).padStart(6, "0")}` })) n++;
    const code = `HO-${String(n).padStart(6, "0")}`;

    await offices.insertOne({
      _id: officeId, code, name: reg.officeName, legalName: reg.legalName ?? undefined, ntn: reg.ntn ?? undefined,
      type: "head", parentId: null, city: reg.city, province: reg.province ?? undefined, country: "Pakistan", status: "active",
      salesTaxNumber: reg.salesTaxNumber ?? undefined, companyRegNumber: reg.companyRegNumber ?? undefined,
      registeredAddress: reg.registeredAddress ?? undefined, operationalAddress: reg.operationalAddress ?? undefined,
      officePhone: reg.officePhone ?? undefined, officeEmail: reg.officeEmail ?? undefined, website: reg.officeWebsite ?? undefined,
      subscription: { expiresAt: new Date(now.getTime() + trialDays * 86_400_000) }, createdAt: now,
    });
    const userId = new ObjectId();
    await db.collection("users").insertOne({
      _id: userId, name: reg.applicantName, email: reg.applicantEmail, passwordHash: reg.passwordHash,
      status: "active", officeId, roleKeys: ["ho_admin"], createdAt: now,
    });
    await regs.updateOne({ _id }, { $set: { officeId }, $unset: { passwordHash: "" } });
    await db.collection("notifications").insertOne({ userId, title: "Registration approved", body: `${reg.officeName} is now active. Welcome aboard.`, read: false, createdAt: now });
    await writeAudit({ userId: actorId, userName: actor.name, headOfficeId: officeId, officeId: null, action: "office.approve", summary: `Approved registration for ${reg.officeName}`, entity: "office", entityId: officeId.toString() });
    return { ok: true, message: `${reg.officeName} approved as ${code}. They can sign in now.` };
  } catch (err) {
    // Roll the claim back so the request can be reviewed again.
    await regs.updateOne({ _id }, { $set: { status: reg.status }, $pop: { history: 1 } });
    console.error("approve failed", err);
    return { ok: false, error: "Couldn't create the account. If this email already has a user, resolve that first." };
  }
}
