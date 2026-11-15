import { timingSafeEqual } from "crypto";
import { ObjectId } from "mongodb";
import { sendMail } from "@/lib/mail";
import { getDb } from "@/lib/mongodb";
import type { FleetVehicleDoc, FleetVehicleDocumentDoc, RoleDoc, UserDoc } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(request: Request) {
  const secret = process.env.FLEET_ALERTS_SECRET;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!secret || !supplied) return false;
  const expectedBuffer = Buffer.from(secret);
  const suppliedBuffer = Buffer.from(supplied);
  return expectedBuffer.length === suppliedBuffer.length && timingSafeEqual(expectedBuffer, suppliedBuffer);
}

function recipientRoles(roles: RoleDoc[], tenantId: ObjectId) {
  const head = roles.filter((role) =>
    role.scope === "head" &&
    (role.key === "ho_admin" || role.key === "ho_fleet_manager" || role.permissions.includes("fleet.view")) &&
    (role.isCustom !== true || role.headOfficeId?.equals(tenantId)),
  );
  const branch = roles.filter((role) =>
    role.scope === "branch" &&
    (role.key === "branch_manager" || role.permissions.includes("fleet.view")) &&
    (role.isCustom !== true || role.headOfficeId?.equals(tenantId)),
  );
  return { headKeys: head.map((role) => role.key), branchKeys: branch.map((role) => role.key) };
}

export async function POST(request: Request) {
  if (!authorized(request)) return new Response("Unauthorized", { status: 401 });

  const db = await getDb();
  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const cutoff = new Date(today.getTime() + 30 * 86_400_000);
  const dateKey = today.toISOString().slice(0, 10);
  const documents = db.collection<FleetVehicleDocumentDoc>("fleet_vehicle_documents");
  const events = db.collection("fleet_alert_events");
  await Promise.all([
    documents.createIndex({ current: 1, expiryDate: 1 }),
    events.createIndex({ documentId: 1, dateKey: 1 }, { unique: true }),
  ]);
  const dueDocuments = await documents.find({
    current: true,
    expiryDate: { $lte: cutoff },
  }).limit(2000).toArray();
  const roles = await db.collection<RoleDoc>("roles").find({ status: { $ne: "inactive" } }).toArray();
  const dueVehicles = await db.collection<FleetVehicleDoc>("fleet_vehicles").find({
    _id: { $in: dueDocuments.map((document) => document.vehicleId) },
    administrativeStatus: "active",
  }).toArray();
  const vehiclesById = new Map(dueVehicles.map((vehicle) => [vehicle._id.toString(), vehicle]));
  const officeRecipientCache = new Map<string, { headKeys: string[]; branchKeys: string[]; headUsers: UserDoc[] }>();
  let notificationsSent = 0;
  let emailsSent = 0;
  let emailFailures = 0;
  let alertsCreated = 0;
  let skipped = 0;

  for (const document of dueDocuments) {
    const vehicle = vehiclesById.get(document.vehicleId.toString());
    if (!vehicle) continue;
    const tenantKey = vehicle.tenantId.toString();
    let recipients = officeRecipientCache.get(tenantKey);
    if (!recipients) {
      const { headKeys, branchKeys } = recipientRoles(roles, vehicle.tenantId);
      const headUsers = headKeys.length
        ? await db.collection<UserDoc>("users").find({
          officeId: vehicle.tenantId, roleKeys: { $in: headKeys }, status: "active",
        }).toArray()
        : [];
      recipients = { headKeys, branchKeys, headUsers };
      officeRecipientCache.set(tenantKey, recipients);
    }

    const branchUsers = recipients.branchKeys.length
      ? await db.collection<UserDoc>("users").find({
        officeId: vehicle.assignedOfficeId,
        roleKeys: { $in: recipients.branchKeys },
        status: "active",
      }).toArray()
      : [];
    const users = [...new Map([...recipients.headUsers, ...branchUsers].map((user) => [user._id.toString(), user])).values()];
    if (!users.length) {
      skipped++;
      continue;
    }

    const eventId = new ObjectId();
    try {
      await events.insertOne({
        _id: eventId,
        tenantId: vehicle.tenantId,
        vehicleId: vehicle._id,
        documentId: document._id,
        dateKey,
        createdAt: now,
      });
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error && error.code === 11000) continue;
      throw error;
    }

    const remaining = Math.ceil((document.expiryDate!.getTime() - today.getTime()) / 86_400_000);
    const expiryText = remaining < 0 ? `expired ${Math.abs(remaining)} day${remaining === -1 ? "" : "s"} ago`
      : remaining === 0 ? "expires today"
        : `expires in ${remaining} day${remaining === 1 ? "" : "s"}`;
    const category = document.category.replaceAll("_", " ");
    const body = `${vehicle.fleetId} (${vehicle.registrationNumber}): ${category}${document.documentNumber ? ` ${document.documentNumber}` : ""} ${expiryText}. Open /dashboard/fleet/${vehicle._id.toString()} to review.`;
    await db.collection("notifications").insertMany(users.map((user) => ({
      userId: user._id,
      title: `Vehicle document ${remaining < 0 ? "expired" : "expiry reminder"}`,
      body,
      read: false,
      createdAt: now,
    })));
    notificationsSent += users.length;
    alertsCreated++;

    const mailed = await sendMail({
      to: users.map((user) => user.email),
      subject: `Vehicle document alert: ${vehicle.registrationNumber}`,
      text: [
        `Fleet vehicle: ${vehicle.fleetId} (${vehicle.registrationNumber})`,
        `Document: ${category}${document.documentNumber ? ` ${document.documentNumber}` : ""}`,
        `Status: ${expiryText}`,
        `Assigned office: ${vehicle.assignedOfficeId.toString()}`,
        `Review: /dashboard/fleet/${vehicle._id.toString()}`,
      ].join("\n"),
    });
    if (mailed) emailsSent++;
    else emailFailures++;
  }

  return Response.json({ alertsCreated, notificationsSent, emailsSent, emailFailures, skipped });
}
