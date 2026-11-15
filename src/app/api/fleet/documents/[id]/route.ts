import { ObjectId, type Filter } from "mongodb";
import { can, getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";
import type { FleetFileDoc, FleetVehicleDoc } from "@/lib/types";

export const runtime = "nodejs";
const notFound = () => new Response("Not found", { status: 404 });

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.scope === "system" || !user.office || !user.headOffice || !can(user, "fleet_document.view") || user.access.level === "denied") return notFound();
  const { id } = await params;
  if (!ObjectId.isValid(id)) return notFound();

  const db = await getDb();
  const file = await db.collection<FleetFileDoc>("fleet_files").findOne({
    _id: new ObjectId(id),
    tenantId: new ObjectId(user.headOffice.id),
  });
  if (!file) return notFound();
  const vehicleFilter: Filter<FleetVehicleDoc> = {
    _id: file.vehicleId,
    tenantId: file.tenantId,
    ...(user.scope === "branch" ? { vehicleType: "recovery_vehicle" as const, assignedOfficeId: new ObjectId(user.office.id) } : {}),
  };
  const vehicle = await db.collection<FleetVehicleDoc>("fleet_vehicles").findOne(vehicleFilter);
  if (!vehicle) return notFound();

  const bytes = file.data.buffer.subarray(0, file.data.position);
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": file.mime,
      "Content-Length": String(bytes.byteLength),
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(file.name)}`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}
