/**
 * Seeds the database.
 *   npm run seed        -> indexes, roles, and the Super Administrator (safe to re-run)
 *   npm run seed:demo   -> the above plus sample offices, users and activity
 */
import { config } from "dotenv";
import bcrypt from "bcryptjs";
import { MongoClient, ObjectId } from "mongodb";

config({ path: ".env.local" });
config();

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("MONGODB_URI is not set. Add it to .env.local first.");
  process.exit(1);
}
const demo = process.argv.includes("--demo");
const DAY = 86_400_000;
const ago = (days: number) => new Date(Date.now() - days * DAY);
const ahead = (days: number) => new Date(Date.now() + days * DAY);

const ROLES = [
  { key: "super_admin", name: "Super Administrator", scope: "system", permissions: ["*"] },
  { key: "ho_admin", name: "Head Office Administrator", scope: "head", permissions: ["dashboard.view", "branch.view", "branch.create", "branch.update", "user.view", "user.create", "user.update", "user.suspend", "role.view", "role.create", "role.update", "audit.view"] },
  { key: "ho_ops_manager", name: "Head Office Operations Manager", scope: "head", permissions: ["dashboard.view", "branch.view", "booking.view", "vehicle.view"] },
  { key: "ho_accounts", name: "Head Office Accounts User", scope: "head", permissions: ["dashboard.view", "advance.view", "expense.view"] },
  { key: "branch_manager", name: "Branch Manager", scope: "branch", permissions: ["dashboard.view", "branch.view", "user.view", "user.create", "vehicle.view", "booking.view", "booking.create", "expense.approve"] },
  { key: "recovery_manager", name: "Fleet/Recovery Manager", scope: "branch", permissions: ["dashboard.view", "vehicle.view", "vehicle.update", "booking.assign"] },
  { key: "ops_officer", name: "Operations Officer", scope: "branch", permissions: ["dashboard.view", "booking.view", "booking.create", "booking.assign"] },
  { key: "accounts_officer", name: "Accounts Officer", scope: "branch", permissions: ["dashboard.view", "advance.create", "expense.view"] },
  { key: "data_entry", name: "Data Entry Operator", scope: "branch", permissions: ["dashboard.view", "booking.create"] },
];

async function main() {
  const client = await new MongoClient(uri!).connect();
  const db = client.db(process.env.MONGODB_DB || "carrier_hub");

  // Indexes
  await db.collection("users").createIndex({ email: 1 }, { unique: true });
  await db.collection("offices").createIndex({ code: 1 }, { unique: true });
  await db.collection("offices").createIndex({ parentId: 1 });
  await db.collection("roles").createIndex({ key: 1 }, { unique: true });
  await db.collection("registrations").createIndex({ status: 1, submittedAt: 1 });
  await db.collection("audit_logs").createIndex({ createdAt: -1 });
  await db.collection("audit_logs").createIndex({ headOfficeId: 1, createdAt: -1 });
  await db.collection("audit_logs").createIndex({ officeId: 1, createdAt: -1 });
  await db.collection("notifications").createIndex({ userId: 1, createdAt: -1 });

  // Roles
  for (const r of ROLES) {
    await db.collection("roles").updateOne({ key: r.key }, { $set: r }, { upsert: true });
  }
  console.log(`Roles ready (${ROLES.length})`);

  // Super Administrator
  const email = (process.env.SEED_ADMIN_EMAIL || "admin@example.com").toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD || "ChangeMe!2026";
  const existing = await db.collection("users").findOne({ email });
  let adminId: ObjectId;
  if (existing) {
    adminId = existing._id;
    console.log(`Super Administrator already exists: ${email}`);
  } else {
    const res = await db.collection("users").insertOne({
      name: process.env.SEED_ADMIN_NAME || "System Administrator",
      email,
      passwordHash: await bcrypt.hash(password, 12),
      status: "active",
      officeId: null,
      roleKeys: ["super_admin"],
      createdAt: new Date(),
    });
    adminId = res.insertedId;
    console.log(`Super Administrator created: ${email}`);
  }

  if (demo) await seedDemo(db, adminId);
  await client.close();
}

async function seedDemo(db: ReturnType<MongoClient["db"]>, adminId: ObjectId) {
  if (await db.collection("offices").findOne({ code: "HO-000001" })) {
    console.log("Demo data already present, skipping.");
    return;
  }
  const demoPassword = process.env.SEED_DEMO_PASSWORD || "Demo@12345";
  const hash = await bcrypt.hash(demoPassword, 12);
  const offices = db.collection("offices");

  const mkHead = async (code: string, name: string, city: string, createdDaysAgo: number, sub: object) => {
    const _id = new ObjectId();
    await offices.insertOne({ _id, code, name, legalName: `${name} (Pvt) Ltd`, type: "head", parentId: null, city, province: "Punjab", country: "Pakistan", status: "active", subscription: sub, createdAt: ago(createdDaysAgo) });
    return _id;
  };
  const mkBranch = async (parentId: ObjectId, code: string, name: string, city: string, status = "active", sub?: object) => {
    const _id = new ObjectId();
    await offices.insertOne({ _id, code, name, type: "branch", parentId, city, province: "Punjab", country: "Pakistan", status, ...(sub ? { subscription: sub } : {}), createdAt: ago(60) });
    return _id;
  };

  const abc = await mkHead("HO-000001", "ABC Car Carriers", "Lahore", 210, { expiresAt: ahead(140) });
  const lhr = await mkBranch(abc, "BR-LHR-001", "Lahore Branch", "Lahore");
  const fsd = await mkBranch(abc, "BR-FSD-001", "Faisalabad Branch", "Faisalabad");
  const psh = await mkBranch(abc, "BR-PSH-001", "Peshawar Branch", "Peshawar", "active", { exemptFrom: ago(10), exemptUntil: ahead(50), expiresAt: ago(5) });
  await mkBranch(abc, "BR-RWP-001", "Rawalpindi Branch", "Rawalpindi", "suspended");

  const xyz = await mkHead("HO-000002", "XYZ Car Carriers", "Karachi", 120, { expiresAt: ahead(18) });
  await mkBranch(xyz, "BR-KHI-001", "Karachi Branch", "Karachi");
  await mkBranch(xyz, "BR-LHR-002", "Lahore Branch", "Lahore");
  await mkHead("HO-000003", "Indus Haulage", "Multan", 70, { expiresAt: ago(12) });

  const mkUser = async (name: string, email: string, officeId: ObjectId, roleKeys: string[], extra: object = {}) => {
    const _id = new ObjectId();
    await db.collection("users").insertOne({ _id, name, email, passwordHash: hash, status: "active", officeId, roleKeys, createdAt: ago(40), ...extra });
    return _id;
  };
  const hoAdmin = await mkUser("Sana Malik", "sana@abccarriers.test", abc, ["ho_admin"], { lastLoginAt: ago(0) });
  const mgr = await mkUser("Ali Raza", "ali@abccarriers.test", lhr, ["branch_manager", "recovery_manager"], { lastLoginAt: ago(1) });
  await mkUser("Bilal Ahmed", "bilal@abccarriers.test", lhr, ["ops_officer"], { lastLoginAt: ago(2) });
  await mkUser("Hira Khan", "hira@abccarriers.test", lhr, ["accounts_officer"], { lastLoginAt: ago(3) });
  await mkUser("Usman Tariq", "usman@abccarriers.test", lhr, ["data_entry"], { status: "suspended" });
  await mkUser("Farah Iqbal", "farah@abccarriers.test", fsd, ["branch_manager"], { lastLoginAt: ago(4) });
  await mkUser("Zain Ali", "zain@abccarriers.test", psh, ["branch_manager"]);
  await mkUser("Omar Sheikh", "omar@xyzcarriers.test", xyz, ["ho_admin"]);

  // Registration queue (a few per month so the trend chart has shape)
  const people = [["Karim Traders", "Imran Butt", "Sialkot"], ["Gulf Auto Movers", "Nadia Aslam", "Karachi"], ["Northern Recovery", "Tahir Mehmood", "Gilgit"], ["Metro Car Haul", "Saad Hussain", "Islamabad"], ["Prime Fleet", "Maryam Zafar", "Gujranwala"], ["Eagle Carriers", "Danish Qureshi", "Quetta"]];
  const statuses = ["pending", "under_review", "info_required", "pending", "approved", "rejected"];
  const monthsAgo = [0, 0, 1, 2, 3, 4, 4, 5, 5, 1, 2, 3];
  const regs: Record<string, unknown>[] = monthsAgo.map((m, i) => {
    const p = people[i % people.length];
    return { kind: "head", officeName: p[0] + (i > 5 ? ` ${i}` : ""), applicantName: p[1], applicantEmail: `${p[1].split(" ")[0].toLowerCase()}@example.test`, city: p[2], parentId: null, documentsCount: 3 + (i % 3), status: i < 6 ? statuses[i] : "approved", submittedAt: ago(m * 30 + (i % 7) + 1) };
  });
  regs.push({ kind: "branch", officeName: "Sialkot Branch", applicantName: "Sana Malik", applicantEmail: "sana@abccarriers.test", city: "Sialkot", parentId: abc, documentsCount: 2, status: "pending", submittedAt: ago(1) });
  await db.collection("registrations").insertMany(regs);

  const audit = (userName: string, userId: ObjectId | null, summary: string, action: string, entity: string, mins: number, ho: ObjectId | null, office: ObjectId | null = null) => ({ userId, userName, headOfficeId: ho, officeId: office, summary, action, entity, createdAt: new Date(Date.now() - mins * 60000) });
  await db.collection("audit_logs").insertMany([
    audit("System Administrator", adminId, "Approved registration for Indus Haulage", "office.approve", "office", 35, null),
    audit("Sana Malik", hoAdmin, "Created user Zain Ali", "user.create", "user", 95, abc),
    audit("System Administrator", adminId, "Suspended Rawalpindi Branch", "office.suspend", "office", 260, abc, null),
    audit("Ali Raza", mgr, "Signed in", "auth.login", "user", 410, abc, lhr),
    audit("Sana Malik", hoAdmin, "Requested new branch: Sialkot", "branch.create", "branch", 1500, abc),
    audit("System Administrator", adminId, "Granted exemption to Peshawar Branch", "office.exempt", "office", 2900, abc, psh),
    audit("Ali Raza", mgr, "Assigned role Fleet/Recovery Manager to Ali Raza", "user.role", "user", 4300, abc, lhr),
    audit("System Administrator", adminId, "Rejected registration for Eagle Carriers", "office.reject", "office", 6000, null),
  ]);

  await db.collection("notifications").insertMany([
    { userId: adminId, title: "New registration", body: "Karim Traders submitted a registration request.", read: false, createdAt: ago(0) },
    { userId: adminId, title: "Branch request", body: "ABC Car Carriers asked to add Sialkot Branch.", read: false, createdAt: ago(1) },
    { userId: adminId, title: "Subscription expiring", body: "XYZ Car Carriers expires in 18 days.", read: true, createdAt: ago(3) },
    { userId: hoAdmin, title: "Branch suspended", body: "Rawalpindi Branch was suspended by the administrator.", read: false, createdAt: ago(0) },
  ]);

  console.log(`Demo data created. Demo logins use the password: ${demoPassword}`);
  console.log("  Head Office admin : sana@abccarriers.test");
  console.log("  Branch manager    : ali@abccarriers.test");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
