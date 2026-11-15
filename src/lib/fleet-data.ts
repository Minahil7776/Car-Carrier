import "server-only";
import { ObjectId } from "mongodb";
import { getDb } from "./mongodb";
import type { FleetVehicleDoc, FleetVehicleDocumentDoc, OfficeDoc } from "./types";

export interface FleetVehicleView extends FleetVehicleDoc {
  id: string;
  assignedOfficeName: string;
  documents: FleetVehicleDocumentDoc[];
}

export async function getFleetVehicles(tenantId: string, branchId?: string): Promise<FleetVehicleView[]> {
  const db = await getDb();
  const tenantObjectId = new ObjectId(tenantId);
  const filter = {
    tenantId: tenantObjectId,
    ...(branchId
      ? { vehicleType: "recovery_vehicle" as const, assignedOfficeId: new ObjectId(branchId) }
      : {}),
  };
  const [vehicles, offices] = await Promise.all([
    db.collection<FleetVehicleDoc>("fleet_vehicles").find(filter).sort({ updatedAt: -1 }).toArray(),
    db.collection<OfficeDoc>("offices").find({
      $or: [{ _id: tenantObjectId }, { type: "branch", parentId: tenantObjectId }],
    }).toArray(),
  ]);
  const officeNames = new Map(offices.map((office) => [office._id.toString(), office.name]));
  const vehicleIds = vehicles.map((vehicle) => vehicle._id);
  const documents = vehicleIds.length
    ? await db.collection<FleetVehicleDocumentDoc>("fleet_vehicle_documents")
      .find({ tenantId: tenantObjectId, vehicleId: { $in: vehicleIds } })
      .sort({ uploadedAt: -1 })
      .toArray()
    : [];
  const documentsByVehicle = new Map<string, FleetVehicleDocumentDoc[]>();
  for (const document of documents) {
    const key = document.vehicleId.toString();
    documentsByVehicle.set(key, [...(documentsByVehicle.get(key) ?? []), document]);
  }

  return vehicles.map((vehicle) => ({
    ...vehicle,
    id: vehicle._id.toString(),
    assignedOfficeName: officeNames.get(vehicle.assignedOfficeId.toString()) ?? "Unknown office",
    documents: documentsByVehicle.get(vehicle._id.toString()) ?? [],
  }));
}

export async function getFleetVehicle(tenantId: string, vehicleId: string, branchId?: string) {
  if (!ObjectId.isValid(vehicleId)) return null;
  const db = await getDb();
  const vehicle = await db.collection<FleetVehicleDoc>("fleet_vehicles").findOne({
    _id: new ObjectId(vehicleId),
    tenantId: new ObjectId(tenantId),
    ...(branchId ? { vehicleType: "recovery_vehicle", assignedOfficeId: new ObjectId(branchId) } : {}),
  });
  if (!vehicle) return null;
  const [office, documents] = await Promise.all([
    db.collection<OfficeDoc>("offices").findOne({ _id: vehicle.assignedOfficeId }),
    db.collection<FleetVehicleDocumentDoc>("fleet_vehicle_documents")
      .find({ tenantId: new ObjectId(tenantId), vehicleId: vehicle._id })
      .sort({ uploadedAt: -1 })
      .toArray(),
  ]);
  return { ...vehicle, id: vehicle._id.toString(), assignedOfficeName: office?.name ?? "Unknown office", documents };
}

export function documentState(document: FleetVehicleDocumentDoc, now = new Date()) {
  if (!document.current) return "Superseded";
  if (document.effectiveDate && document.effectiveDate > now) return "Not yet valid";
  if (!document.expiryDate) return "Valid";
  const remaining = Math.ceil((document.expiryDate.getTime() - now.getTime()) / 86_400_000);
  if (remaining < 0) return "Expired";
  if (remaining <= 30) return "Expiring soon";
  return "Valid";
}
