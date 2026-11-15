"use server";

import { Binary, ObjectId, type Db } from "mongodb";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { can, getCurrentUser, type CurrentUser } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { getDb } from "@/lib/mongodb";
import { UPLOAD_LIMITS } from "@/lib/signup-config";
import { sniffMime } from "@/lib/signup-draft";
import type { FleetAllocationDoc, FleetVehicleDoc, FleetVehicleDocumentDoc, OfficeDoc } from "@/lib/types";

export interface FleetActionState {
  ok?: boolean;
  message?: string;
  error?: string;
  fieldErrors?: Record<string, string>;
}

const vehicleSchema = z.object({
  vehicleType: z.enum(["car_carrier", "recovery_vehicle", "other"]),
  registrationNumber: z.string().trim().min(2).max(30).transform((value) => value.toUpperCase()),
  make: z.string().trim().min(1).max(80),
  model: z.string().trim().min(1).max(80),
  modelYear: z.string().trim().optional(),
  chassisNumber: z.string().trim().toUpperCase().max(80).optional(),
  engineNumber: z.string().trim().max(80).optional(),
  acquisitionDate: z.string().optional(),
  capacity: z.string().trim().max(80).optional(),
  operationalStatus: z.enum(["available", "assigned", "maintenance", "out_of_service"]),
  assignedOfficeId: z.string().regex(/^[a-f\d]{24}$/i, "Choose an office."),
  remarks: z.string().trim().max(1000).optional(),
}).superRefine((value, ctx) => {
  if (value.modelYear && (!/^\d{4}$/.test(value.modelYear) || Number(value.modelYear) < 1900 || Number(value.modelYear) > new Date().getFullYear() + 1)) {
    ctx.addIssue({ code: "custom", path: ["modelYear"], message: "Enter a valid model year." });
  }
});

const documentSchema = z.object({
  category: z.enum(["registration", "insurance", "fitness", "route_permit", "other"]),
  documentNumber: z.string().trim().max(120).optional(),
  issuingAuthority: z.string().trim().max(120).optional(),
  issueDate: z.string().optional(),
  effectiveDate: z.string().optional(),
  expiryDate: z.string().optional(),
  jurisdiction: z.string().trim().max(160).optional(),
  remarks: z.string().trim().max(1000).optional(),
  replacesId: z.string().optional(),
});

type FleetPermission = "fleet.view" | "fleet.create" | "fleet.update" | "fleet.allocate" | "fleet_document.view" | "fleet_document.manage";

async function fleetActor(permission: FleetPermission): Promise<CurrentUser | null> {
  const user = await getCurrentUser();
  if (!user || user.scope === "system" || !user.office || !user.headOffice || user.access.level !== "allowed" || !can(user, permission)) return null;
  if (permission !== "fleet.view" && user.scope !== "head") return null;
  return user;
}

async function indexes(db: Db) {
  const collection = db.collection<FleetVehicleDoc>("fleet_vehicles");
  await Promise.all([
    collection.createIndex({ tenantId: 1, fleetId: 1 }, { unique: true }),
    collection.createIndex({ tenantId: 1, registrationNumber: 1 }, { unique: true }),
    collection.createIndex({ tenantId: 1, chassisNumber: 1 }, { unique: true, partialFilterExpression: { chassisNumber: { $type: "string" } } }),
    db.collection("fleet_vehicle_documents").createIndex({ tenantId: 1, vehicleId: 1, uploadedAt: -1 }),
    db.collection("fleet_files").createIndex({ tenantId: 1, vehicleId: 1 }),
  ]);
}

function formValues(form: FormData) {
  return Object.fromEntries([
    "vehicleType", "registrationNumber", "make", "model", "modelYear", "chassisNumber", "engineNumber",
    "capacity", "acquisitionDate", "operationalStatus", "assignedOfficeId", "remarks",
  ].map((key) => [key, String(form.get(key) ?? "")]));
}

function issueMap(error: z.ZodError) {
  return Object.fromEntries(error.issues.map((issue) => [String(issue.path[0]), issue.message]));
}

async function selectedOffice(db: Db, tenantId: string, officeId: string) {
  if (!ObjectId.isValid(officeId)) return null;
  return db.collection<OfficeDoc>("offices").findOne({
    _id: new ObjectId(officeId),
    $or: [{ _id: new ObjectId(tenantId), type: "head" }, { type: "branch", parentId: new ObjectId(tenantId) }],
  });
}

async function ownedVehicle(db: Db, tenantId: string, vehicleId: string) {
  if (!ObjectId.isValid(vehicleId)) return null;
  return db.collection<FleetVehicleDoc>("fleet_vehicles").findOne({
    _id: new ObjectId(vehicleId),
    tenantId: new ObjectId(tenantId),
  });
}

async function duplicateMessage(db: Db, tenantId: ObjectId, registration: string, chassis?: string, exceptId?: ObjectId): Promise<Record<string, string> | null> {
  const scope = exceptId ? { _id: { $ne: exceptId } } : {};
  const registrationMatch = await db.collection<FleetVehicleDoc>("fleet_vehicles").findOne({
    tenantId, registrationNumber: registration, ...scope,
  });
  if (registrationMatch) return { registrationNumber: "A vehicle with this registration number already exists in your fleet." };
  if (chassis) {
    const chassisMatch = await db.collection<FleetVehicleDoc>("fleet_vehicles").findOne({
      tenantId, chassisNumber: chassis, ...scope,
    });
    if (chassisMatch) return { chassisNumber: "A vehicle with this chassis/VIN already exists in your fleet." };
  }
  return null;
}

export async function createFleetVehicle(_previous: FleetActionState, form: FormData): Promise<FleetActionState> {
  const actor = await fleetActor("fleet.create");
  if (!actor) return { error: "You do not have permission to create fleet vehicles." };
  const parsed = vehicleSchema.safeParse(formValues(form));
  if (!parsed.success) return { fieldErrors: issueMap(parsed.error) };
  const data = parsed.data;
  const acquisitionDate = parseDate(data.acquisitionDate ?? "");
  if (acquisitionDate === null || (acquisitionDate && acquisitionDate > new Date())) {
    return { fieldErrors: { acquisitionDate: "Enter a valid acquisition date that is not in the future." } };
  }
  const db = await getDb();
  await indexes(db);

  const office = await selectedOffice(db, actor.headOffice!.id, data.assignedOfficeId);
  if (!office) return { fieldErrors: { assignedOfficeId: "Choose an office within your head office." } };
  if (data.vehicleType !== "recovery_vehicle" && office._id.toString() !== actor.headOffice!.id) {
    return { fieldErrors: { assignedOfficeId: "Only recovery vehicles can be assigned to a branch." } };
  }
  const tenantId = new ObjectId(actor.headOffice!.id);
  const chassisNumber = data.chassisNumber?.toUpperCase() || undefined;
  const duplicate = await duplicateMessage(db, tenantId, data.registrationNumber, chassisNumber);
  if (duplicate) return { fieldErrors: duplicate };

  const now = new Date();
  const vehicleId = new ObjectId();
  const fleetId = `FLEET-${vehicleId.toHexString().toUpperCase()}`;
  const allocation: FleetAllocationDoc = {
    officeId: office._id,
    allocatedAt: now,
    reason: "Initial fleet registration",
    byId: new ObjectId(actor.id),
    byName: actor.name,
  };
  const vehicle: FleetVehicleDoc = {
    _id: vehicleId,
    tenantId,
    controllingOfficeId: tenantId,
    assignedOfficeId: office._id,
    vehicleType: data.vehicleType,
    ownershipClassification: "company_owned",
    fleetId,
    registrationNumber: data.registrationNumber,
    make: data.make,
    model: data.model,
    ...(data.modelYear ? { modelYear: Number(data.modelYear) } : {}),
    ...(chassisNumber ? { chassisNumber } : {}),
    ...(data.engineNumber ? { engineNumber: data.engineNumber } : {}),
    ...(acquisitionDate ? { acquisitionDate } : {}),
    ...(data.capacity ? { capacity: data.capacity } : {}),
    administrativeStatus: "active",
    operationalStatus: data.operationalStatus,
    ...(data.remarks ? { remarks: data.remarks } : {}),
    allocations: [allocation],
    statusHistory: [{
      administrativeStatus: "active",
      operationalStatus: data.operationalStatus,
      effectiveAt: now,
      reason: "Initial fleet registration",
      byId: new ObjectId(actor.id),
      byName: actor.name,
    }],
    createdById: new ObjectId(actor.id),
    updatedById: new ObjectId(actor.id),
    createdAt: now,
    updatedAt: now,
  };
  try {
    await db.collection<FleetVehicleDoc>("fleet_vehicles").insertOne(vehicle);
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === 11000) {
      return { fieldErrors: { registrationNumber: "A vehicle with these identity details already exists in your fleet." } };
    }
    console.error("fleet vehicle creation failed", error);
    return { error: "The vehicle could not be created. Please try again." };
  }
  await writeAudit({
    userId: new ObjectId(actor.id), userName: actor.name, headOfficeId: tenantId, officeId: office._id,
    action: "fleet.vehicle.create", summary: `Registered ${fleetId} (${data.registrationNumber})`, entity: "fleet_vehicle", entityId: vehicleId.toString(),
  });
  revalidatePath("/dashboard/fleet");
  return { ok: true, message: `Vehicle ${fleetId} registered.` };
}

export async function updateFleetVehicle(_previous: FleetActionState, form: FormData): Promise<FleetActionState> {
  const actor = await fleetActor("fleet.update");
  if (!actor) return { error: "You do not have permission to update fleet vehicles." };
  const id = String(form.get("vehicleId") ?? "");
  const parsed = z.object({
    administrativeStatus: z.enum(["active", "inactive", "retired"]),
    operationalStatus: z.enum(["available", "assigned", "on_trip", "maintenance", "out_of_service"]),
    reason: z.string().trim().max(300),
  }).safeParse({
    administrativeStatus: form.get("administrativeStatus"),
    operationalStatus: form.get("operationalStatus"),
    reason: form.get("reason"),
  });
  const operationalStatus = String(form.get("operationalStatus") ?? "");
  if (!ObjectId.isValid(id)) return { error: "This vehicle could not be found." };
  if (!parsed.success) return { error: "Choose valid vehicle statuses." };
  const { administrativeStatus: status, reason } = parsed.data;
  if (operationalStatus !== parsed.data.operationalStatus) return { error: "Choose a valid operational status." };
  if (reason.length < 3) return { fieldErrors: { reason: "Give a short reason for changing the vehicle status." } };
  const db = await getDb();
  const vehicle = await ownedVehicle(db, actor.headOffice!.id, id);
  if (!vehicle) return { error: "This vehicle could not be found in your head office fleet." };
  if (vehicle.operationalStatus === "on_trip" && status === "retired") {
    return { fieldErrors: { administrativeStatus: "Complete the current trip before retiring the vehicle." } };
  }
  const updatedAt = new Date();
  const result = await db.collection<FleetVehicleDoc>("fleet_vehicles").updateOne(
    { _id: vehicle._id, tenantId: vehicle.tenantId, updatedAt: vehicle.updatedAt },
    {
      $set: {
        administrativeStatus: status,
        operationalStatus: parsed.data.operationalStatus,
        ...(status === "retired" ? { retirementReason: reason } : { retirementReason: "" }),
        statusHistory: [...vehicle.statusHistory, {
          administrativeStatus: status,
          operationalStatus: parsed.data.operationalStatus,
          effectiveAt: updatedAt,
          ...(reason ? { reason } : {}),
          byId: new ObjectId(actor.id),
          byName: actor.name,
        }],
        updatedById: new ObjectId(actor.id),
        updatedAt,
      },
    },
  );
  if (!result.modifiedCount) return { error: "The vehicle changed while you were updating it. Refresh and try again." };
  await writeAudit({
    userId: new ObjectId(actor.id), userName: actor.name, headOfficeId: vehicle.tenantId, officeId: vehicle.assignedOfficeId,
    action: "fleet.vehicle.update", summary: `Updated ${vehicle.fleetId} status to ${status}`, entity: "fleet_vehicle", entityId: id,
  });
  revalidatePath("/dashboard/fleet");
  revalidatePath(`/dashboard/fleet/${id}`);
  return { ok: true, message: "Vehicle status updated." };
}

export async function updateFleetVehicleDetails(_previous: FleetActionState, form: FormData): Promise<FleetActionState> {
  const actor = await fleetActor("fleet.update");
  if (!actor) return { error: "You do not have permission to update fleet vehicles." };
  const id = String(form.get("vehicleId") ?? "");
  if (!ObjectId.isValid(id)) return { error: "This vehicle could not be found." };
  const parsed = z.object({
    vehicleType: z.enum(["car_carrier", "recovery_vehicle", "other"]),
    registrationNumber: z.string().trim().min(2).max(30).transform((value) => value.toUpperCase()),
    make: z.string().trim().min(1).max(80),
    model: z.string().trim().min(1).max(80),
    modelYear: z.string().trim().optional(),
    chassisNumber: z.string().trim().toUpperCase().max(80).optional(),
    engineNumber: z.string().trim().max(80).optional(),
    acquisitionDate: z.string().optional(),
    capacity: z.string().trim().max(80).optional(),
    remarks: z.string().trim().max(1000).optional(),
  }).safeParse({
    vehicleType: form.get("vehicleType"),
    registrationNumber: form.get("registrationNumber"),
    make: form.get("make"),
    model: form.get("model"),
    modelYear: form.get("modelYear"),
    chassisNumber: form.get("chassisNumber"),
    engineNumber: form.get("engineNumber"),
    acquisitionDate: form.get("acquisitionDate"),
    capacity: form.get("capacity"),
    remarks: form.get("remarks"),
  });
  if (!parsed.success) return { fieldErrors: issueMap(parsed.error) };
  const data = parsed.data;
  const acquisitionDate = parseDate(data.acquisitionDate ?? "");
  if (acquisitionDate === null || (acquisitionDate && acquisitionDate > new Date())) {
    return { fieldErrors: { acquisitionDate: "Enter a valid acquisition date that is not in the future." } };
  }
  if (data.modelYear && (!/^\d{4}$/.test(data.modelYear) || Number(data.modelYear) < 1900 || Number(data.modelYear) > new Date().getFullYear() + 1)) {
    return { fieldErrors: { modelYear: "Enter a valid model year." } };
  }
  const db = await getDb();
  const vehicle = await ownedVehicle(db, actor.headOffice!.id, id);
  if (!vehicle) return { error: "This vehicle could not be found in your head office fleet." };
  if (data.vehicleType !== "recovery_vehicle" && vehicle.assignedOfficeId.toString() !== actor.headOffice!.id) {
    return { fieldErrors: { vehicleType: "Transfer this recovery vehicle back to Head Office before changing its category." } };
  }
  if (data.vehicleType !== "recovery_vehicle" && vehicle.allocations.some((allocation) => allocation.officeId.toString() !== actor.headOffice!.id)) {
    return { fieldErrors: { vehicleType: "A vehicle with branch allocation history cannot be changed to a non-recovery category." } };
  }
  const chassisNumber = data.chassisNumber || undefined;
  const duplicate = await duplicateMessage(db, vehicle.tenantId, data.registrationNumber, chassisNumber, vehicle._id);
  if (duplicate) return { fieldErrors: duplicate };
  const now = new Date();
  const setFields = {
    vehicleType: data.vehicleType,
    registrationNumber: data.registrationNumber,
    make: data.make,
    model: data.model,
    ...(data.modelYear ? { modelYear: Number(data.modelYear) } : {}),
    ...(chassisNumber ? { chassisNumber } : {}),
    ...(data.engineNumber ? { engineNumber: data.engineNumber } : {}),
    ...(acquisitionDate ? { acquisitionDate } : {}),
    ...(data.capacity ? { capacity: data.capacity } : {}),
    ...(data.remarks ? { remarks: data.remarks } : {}),
    updatedById: new ObjectId(actor.id),
    updatedAt: now,
  };
  const unsetFields: Record<string, ""> = {};
  if (!data.modelYear) unsetFields.modelYear = "";
  if (!chassisNumber) unsetFields.chassisNumber = "";
  if (!data.engineNumber) unsetFields.engineNumber = "";
  if (!acquisitionDate) unsetFields.acquisitionDate = "";
  if (!data.capacity) unsetFields.capacity = "";
  if (!data.remarks) unsetFields.remarks = "";
  try {
    const result = await db.collection<FleetVehicleDoc>("fleet_vehicles").updateOne(
      { _id: vehicle._id, tenantId: vehicle.tenantId, updatedAt: vehicle.updatedAt },
      {
        $set: setFields,
        ...(Object.keys(unsetFields).length ? { $unset: unsetFields } : {}),
      },
    );
    if (!result.modifiedCount) return { error: "The vehicle changed while you were updating it. Refresh and try again." };
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === 11000) {
      return { fieldErrors: { registrationNumber: "A vehicle with these identity details already exists in your fleet." } };
    }
    console.error("fleet vehicle update failed", error);
    return { error: "The vehicle could not be updated. Please try again." };
  }
  await writeAudit({
    userId: new ObjectId(actor.id), userName: actor.name, headOfficeId: vehicle.tenantId, officeId: vehicle.assignedOfficeId,
    action: "fleet.vehicle.update", summary: `Updated master details for ${vehicle.fleetId}`, entity: "fleet_vehicle", entityId: id,
  });
  revalidatePath("/dashboard/fleet");
  revalidatePath(`/dashboard/fleet/${id}`);
  return { ok: true, message: "Vehicle details updated." };
}

export async function transferRecoveryVehicle(_previous: FleetActionState, form: FormData): Promise<FleetActionState> {
  const actor = await fleetActor("fleet.allocate");
  if (!actor) return { error: "You do not have permission to allocate fleet vehicles." };
  const vehicleId = String(form.get("vehicleId") ?? "");
  const officeId = String(form.get("officeId") ?? "");
  const reason = String(form.get("reason") ?? "").trim();
  if (!ObjectId.isValid(vehicleId) || reason.length < 3 || reason.length > 300) {
    return { error: "Choose a destination and provide a transfer reason." };
  }
  const db = await getDb();
  const vehicle = await ownedVehicle(db, actor.headOffice!.id, vehicleId);
  if (!vehicle || vehicle.vehicleType !== "recovery_vehicle") return { error: "Only recovery vehicles can be allocated to a branch." };
  if (vehicle.administrativeStatus !== "active") return { error: "Only active vehicles can be transferred." };
  if (vehicle.operationalStatus === "on_trip") return { error: "A vehicle cannot be transferred until its trip is complete." };
  const destination = await selectedOffice(db, actor.headOffice!.id, officeId);
  if (!destination) return { error: "Choose a destination within your head office." };
  if (destination._id.equals(vehicle.assignedOfficeId)) return { error: "This vehicle is already allocated to that office." };
  const now = new Date();
  const allocations = vehicle.allocations.map((allocation) =>
    allocation.officeId.equals(vehicle.assignedOfficeId) && !allocation.endedAt ? { ...allocation, endedAt: now } : allocation,
  );
  allocations.push({
    officeId: destination._id, allocatedAt: now, reason, byId: new ObjectId(actor.id), byName: actor.name,
  });
  const result = await db.collection<FleetVehicleDoc>("fleet_vehicles").updateOne(
    { _id: vehicle._id, tenantId: vehicle.tenantId, assignedOfficeId: vehicle.assignedOfficeId, updatedAt: vehicle.updatedAt, operationalStatus: { $ne: "on_trip" } },
    { $set: { assignedOfficeId: destination._id, allocations, updatedById: new ObjectId(actor.id), updatedAt: now } },
  );
  if (!result.modifiedCount) return { error: "The vehicle changed while you were transferring it. Refresh and try again." };
  await writeAudit({
    userId: new ObjectId(actor.id), userName: actor.name, headOfficeId: vehicle.tenantId, officeId: destination._id,
    action: "fleet.vehicle.transfer", summary: `Transferred ${vehicle.fleetId} from ${vehicle.assignedOfficeId.toString()} to ${destination.name}`,
    entity: "fleet_vehicle", entityId: vehicleId,
  });
  revalidatePath("/dashboard/fleet");
  revalidatePath(`/dashboard/fleet/${vehicleId}`);
  return { ok: true, message: `Vehicle transferred to ${destination.name}.` };
}

function parseDate(value: string) {
  if (!value) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : date;
}

export async function addFleetDocument(_previous: FleetActionState, form: FormData): Promise<FleetActionState> {
  const actor = await fleetActor("fleet_document.manage");
  if (!actor) return { error: "You do not have permission to manage vehicle documents." };
  const vehicleId = String(form.get("vehicleId") ?? "");
  if (!ObjectId.isValid(vehicleId)) return { error: "This vehicle could not be found." };
  const parsed = documentSchema.safeParse({
    category: form.get("category"),
    documentNumber: String(form.get("documentNumber") ?? ""),
    issuingAuthority: String(form.get("issuingAuthority") ?? ""),
    issueDate: String(form.get("issueDate") ?? ""),
    effectiveDate: String(form.get("effectiveDate") ?? ""),
    expiryDate: String(form.get("expiryDate") ?? ""),
    jurisdiction: String(form.get("jurisdiction") ?? ""),
    remarks: String(form.get("remarks") ?? ""),
    replacesId: String(form.get("replacesId") ?? ""),
  });
  if (!parsed.success) return { fieldErrors: issueMap(parsed.error) };
  const data = parsed.data;
  const dates = [data.issueDate, data.effectiveDate, data.expiryDate].map((date) => parseDate(date ?? ""));
  if (dates.some((date) => date === null)) return { fieldErrors: { expiryDate: "Enter valid document dates." } };
  const [issueDate, effectiveDate, expiryDate] = dates as (Date | undefined)[];
  if (issueDate && expiryDate && expiryDate < issueDate) return { fieldErrors: { expiryDate: "Expiry date cannot be before the issue date." } };
  if (effectiveDate && expiryDate && expiryDate < effectiveDate) return { fieldErrors: { expiryDate: "Expiry date cannot be before the effective date." } };
  if (["registration", "insurance", "fitness", "route_permit"].includes(data.category) && !expiryDate) {
    return { fieldErrors: { expiryDate: "Enter an expiry date for this document." } };
  }
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return { fieldErrors: { file: "Choose a document file." } };
  if (file.size > UPLOAD_LIMITS.maxFileBytes) return { fieldErrors: { file: `The file must be smaller than ${Math.floor(UPLOAD_LIMITS.maxFileBytes / 1024 / 1024)} MB.` } };
  const bytes = Buffer.from(await file.arrayBuffer());
  const mime = sniffMime(bytes);
  if (!mime) return { fieldErrors: { file: "Only PDF, JPEG, or PNG files are accepted." } };
  const vehicleFile = file.name.replace(/[\\/\u0000-\u001f]/g, "").slice(-120) || "vehicle-document";

  const db = await getDb();
  await indexes(db);
  const vehicle = await ownedVehicle(db, actor.headOffice!.id, vehicleId);
  if (!vehicle) return { error: "This vehicle could not be found in your head office fleet." };
  let replaced: FleetVehicleDocumentDoc | null = null;
  if (data.replacesId) {
    if (!ObjectId.isValid(data.replacesId)) return { fieldErrors: { replacesId: "Choose a valid previous document." } };
    replaced = await db.collection<FleetVehicleDocumentDoc>("fleet_vehicle_documents").findOne({
      _id: new ObjectId(data.replacesId), vehicleId: vehicle._id, tenantId: vehicle.tenantId, current: true,
    });
    if (!replaced || replaced.category !== data.category) return { fieldErrors: { replacesId: "Choose a current document of the same category." } };
  }

  const now = new Date();
  const fileId = new ObjectId();
  const documentId = new ObjectId();
  const fileRecord = {
    _id: fileId, tenantId: vehicle.tenantId, vehicleId: vehicle._id, mime, name: vehicleFile, size: bytes.length,
    data: new Binary(bytes), uploadedAt: now,
  };
  const document: FleetVehicleDocumentDoc = {
    _id: documentId,
    tenantId: vehicle.tenantId,
    vehicleId: vehicle._id,
    category: data.category,
    verificationStatus: "pending",
    ...(data.documentNumber ? { documentNumber: data.documentNumber } : {}),
    ...(data.issuingAuthority ? { issuingAuthority: data.issuingAuthority } : {}),
    ...(issueDate ? { issueDate } : {}),
    ...(effectiveDate ? { effectiveDate } : {}),
    ...(expiryDate ? { expiryDate } : {}),
    ...(data.jurisdiction ? { jurisdiction: data.jurisdiction } : {}),
    ...(data.remarks ? { remarks: data.remarks } : {}),
    fileId,
    fileName: vehicleFile,
    mime,
    size: bytes.length,
    ...(replaced ? { supersedesId: replaced._id } : {}),
    current: true,
    uploadedById: new ObjectId(actor.id),
    uploadedAt: now,
  };
  let previousSuperseded = false;
  try {
    if (replaced) {
      const superseded = await db.collection<FleetVehicleDocumentDoc>("fleet_vehicle_documents").updateOne(
        { _id: replaced._id, current: true },
        { $set: { current: false } },
      );
      if (!superseded.modifiedCount) return { fieldErrors: { replacesId: "This document was renewed by someone else. Refresh and try again." } };
      previousSuperseded = true;
    }
    await db.collection("fleet_files").insertOne(fileRecord);
    await db.collection<FleetVehicleDocumentDoc>("fleet_vehicle_documents").insertOne(document);
  } catch (error) {
    await db.collection("fleet_files").deleteOne({ _id: fileId });
    await db.collection<FleetVehicleDocumentDoc>("fleet_vehicle_documents").deleteOne({ _id: documentId });
    if (previousSuperseded && replaced) {
      await db.collection<FleetVehicleDocumentDoc>("fleet_vehicle_documents").updateOne(
        { _id: replaced._id, current: false },
        { $set: { current: true } },
      );
    }
    console.error("fleet document upload failed", error);
    return { error: "The vehicle document could not be saved. Please try again." };
  }
  await writeAudit({
    userId: new ObjectId(actor.id), userName: actor.name, headOfficeId: vehicle.tenantId, officeId: vehicle.assignedOfficeId,
    action: replaced ? "fleet.document.renew" : "fleet.document.add",
    summary: `${replaced ? "Renewed" : "Added"} ${data.category.replaceAll("_", " ")} for ${vehicle.fleetId}`,
    entity: "fleet_vehicle_document", entityId: documentId.toString(),
  });
  revalidatePath("/dashboard/fleet");
  revalidatePath(`/dashboard/fleet/${vehicleId}`);
  return { ok: true, message: replaced ? "Document renewed; the previous version is retained." : "Document added." };
}
