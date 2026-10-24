/**
 * Approve or reject a registration request until the dashboard review screen is built.
 *   npm run approve -- applicant@company.com
 *   npm run approve -- applicant@company.com --trial-days 60
 *   npm run approve -- applicant@company.com --reject "Documents did not match"
 */
import { config } from "dotenv";
import { MongoClient, ObjectId } from "mongodb";

config({ path: ".env.local" });
config();

const args = process.argv.slice(2);
const email = args.find((a) => !a.startsWith("--") && a.includes("@"))?.toLowerCase();
const rejectIdx = args.indexOf("--reject");
const reason = rejectIdx >= 0 ? args[rejectIdx + 1] || "Not approved" : null;
const trialIdx = args.indexOf("--trial-days");
const trialDays = trialIdx >= 0 ? Number(args[trialIdx + 1]) || 30 : 30;

if (!process.env.MONGODB_URI || !email) {
  console.error("Usage: npm run approve -- <applicant-email> [--trial-days 30] [--reject \"reason\"]");
  process.exit(1);
}

async function main() {
  const client = await new MongoClient(process.env.MONGODB_URI!).connect();
  const db = client.db(process.env.MONGODB_DB || "carrier_hub");
  const regs = db.collection("registrations");

  const reg = await regs.findOne({ applicantEmail: email, status: { $in: ["pending", "under_review", "info_required"] } });
  if (!reg) { console.error(`No open registration found for ${email}.`); process.exit(1); }

  const admin = await db.collection("users").findOne({ roleKeys: "super_admin" });
  const actor = { userId: admin?._id ?? null, userName: admin?.name ?? "System Administrator" };

  if (reason) {
    await regs.updateOne({ _id: reg._id }, { $set: { status: "rejected", reviewedAt: new Date(), reviewRemarks: reason } });
    await db.collection("audit_logs").insertOne({ ...actor, headOfficeId: null, officeId: null, action: "office.reject", summary: `Rejected registration for ${reg.officeName}`, entity: "registration", entityId: reg._id.toString(), createdAt: new Date() });
    console.log(`Rejected ${reg.officeName}.`);
    return client.close();
  }

  // Next head office code: HO-000001, HO-000002, ...
  let n = (await db.collection("offices").countDocuments({ type: "head" })) + 1;
  while (await db.collection("offices").findOne({ code: `HO-${String(n).padStart(6, "0")}` })) n++;
  const code = `HO-${String(n).padStart(6, "0")}`;

  const officeId = new ObjectId();
  const now = new Date();
  await db.collection("offices").insertOne({
    _id: officeId, code, name: reg.officeName, legalName: reg.legalName ?? undefined, ntn: reg.ntn ?? undefined,
    type: "head", parentId: null, city: reg.city, country: "Pakistan", status: "active",
    subscription: { expiresAt: new Date(now.getTime() + trialDays * 86_400_000) }, createdAt: now,
  });

  const userId = new ObjectId();
  await db.collection("users").insertOne({
    _id: userId, name: reg.applicantName, email: reg.applicantEmail, passwordHash: reg.passwordHash,
    status: "active", officeId, roleKeys: ["ho_admin"], createdAt: now,
  });

  await regs.updateOne({ _id: reg._id }, { $set: { status: "approved", reviewedAt: now, officeId }, $unset: { passwordHash: "" } });
  await db.collection("audit_logs").insertOne({ ...actor, headOfficeId: officeId, officeId: null, action: "office.approve", summary: `Approved registration for ${reg.officeName}`, entity: "office", entityId: officeId.toString(), createdAt: now });
  await db.collection("notifications").insertOne({ userId, title: "Registration approved", body: `${reg.officeName} is now active. Welcome aboard.`, read: false, createdAt: now });

  console.log(`Approved ${reg.officeName} as ${code}. ${reg.applicantEmail} can now sign in (${trialDays}-day trial subscription).`);
  await client.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
