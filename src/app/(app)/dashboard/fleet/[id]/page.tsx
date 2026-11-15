import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ObjectId } from "mongodb";
import { can, getCurrentUser } from "@/lib/auth";
import { documentState, getFleetVehicle } from "@/lib/fleet-data";
import { getDb } from "@/lib/mongodb";
import type { OfficeDoc } from "@/lib/types";
import { Pill } from "@/components/ui/pill";
import { FleetDocumentForm, FleetVehicleActions, FleetVehicleDetailsForm } from "../fleet-forms";

export const metadata: Metadata = { title: "Fleet vehicle" };
export const dynamic = "force-dynamic";

const label = (value: string) => value.replaceAll("_", " ");
const date = (value?: Date) => value ? value.toLocaleDateString("en-GB", { timeZone: "UTC" }) : "—";

export default async function FleetVehiclePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.scope === "system" || !user.office || !user.headOffice || !can(user, "fleet.view")) redirect("/dashboard");
  const { id } = await params;
  const branchId = user.scope === "branch" ? user.office.id : undefined;
  const vehicle = await getFleetVehicle(user.headOffice.id, id, branchId);
  if (!vehicle) notFound();

  const canManage = user.scope === "head" && user.access.level === "allowed" && can(user, "fleet.update");
  const canAllocate = user.scope === "head" && user.access.level === "allowed" && can(user, "fleet.allocate");
  const canManageDocuments = user.scope === "head" && user.access.level === "allowed" && can(user, "fleet_document.manage");
  const canViewDocuments = can(user, "fleet_document.view");
  const db = await getDb();
  const offices = user.scope === "head" && (canManage || canAllocate)
    ? await db.collection<OfficeDoc>("offices").find({
      $or: [{ _id: new ObjectId(user.headOffice.id), type: "head" }, { type: "branch", parentId: new ObjectId(user.headOffice.id) }],
    }).sort({ type: 1, name: 1 }).toArray()
    : [];
  const officeOptions = offices.map((office) => ({ id: office._id.toString(), name: office.name, type: office.type }));

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href="/dashboard/fleet" className="text-sm text-muted hover:text-ink">← Fleet</Link>
          <p className="mt-4 text-xs font-medium uppercase tracking-[0.16em] text-brand">{vehicle.fleetId}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{vehicle.registrationNumber}</h1>
          <p className="mt-1 text-sm capitalize text-muted">{label(vehicle.vehicleType)} · {vehicle.make} {vehicle.model}{vehicle.modelYear ? ` (${vehicle.modelYear})` : ""}</p>
        </div>
        <Pill tone={vehicle.administrativeStatus === "active" ? "ok" : vehicle.administrativeStatus === "retired" ? "bad" : "neutral"}>{vehicle.administrativeStatus}</Pill>
      </header>

      <FleetVehicleDetailsForm
        canEdit={canManage}
        vehicle={{
          id: vehicle.id,
          vehicleType: vehicle.vehicleType,
          registrationNumber: vehicle.registrationNumber,
          make: vehicle.make,
          model: vehicle.model,
          modelYear: vehicle.modelYear,
          chassisNumber: vehicle.chassisNumber,
          engineNumber: vehicle.engineNumber,
          acquisitionDate: vehicle.acquisitionDate?.toISOString().slice(0, 10),
          capacity: vehicle.capacity,
          remarks: vehicle.remarks,
          assignedOfficeName: vehicle.assignedOfficeName,
          ownershipClassification: vehicle.ownershipClassification,
          registeredDate: date(vehicle.createdAt),
        }}
      />
      {(canManage || (canAllocate && vehicle.vehicleType === "recovery_vehicle")) && (
        <FleetVehicleActions
          vehicle={{ id: vehicle.id, fleetId: vehicle.fleetId, vehicleType: vehicle.vehicleType, operationalStatus: vehicle.operationalStatus, administrativeStatus: vehicle.administrativeStatus }}
          offices={officeOptions}
          canManage={canManage}
          canAllocate={canAllocate}
        />
      )}

      <section className="card overflow-hidden">
        <div className="border-b border-line px-5 py-4">
          <h2 className="text-sm font-semibold">Required document compliance</h2>
        </div>
        <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-4">
          {(["registration", "insurance", "fitness", "route_permit"] as const).map((category) => {
            const records = vehicle.documents.filter((document) => document.current && document.category === category);
            const states = records.map((document) => documentState(document));
            const status = !records.length ? "Missing"
              : states.includes("Expiring soon") ? "Expiring soon"
                : states.includes("Valid") ? "Valid" : "Expired";
            const tone = status === "Valid" ? "ok" : status === "Expiring soon" ? "warn" : status === "Expired" ? "bad" : "neutral";
            return (
              <div key={category} className="rounded-control border border-line p-3">
                <p className="mb-2 text-sm font-medium capitalize">{label(category)}</p>
                <Pill tone={tone}>{status}</Pill>
                {category === "route_permit" && records.length > 1 && <p className="mt-2 text-xs text-muted">{records.length} current permits</p>}
              </div>
            );
          })}
        </div>
      </section>

      {canViewDocuments && (
        <section className="card overflow-hidden">
          <div className="border-b border-line px-5 py-4">
            <h2 className="text-sm font-semibold">Vehicle documents</h2>
            <p className="mt-1 text-xs text-muted">Each route permit is tracked independently.</p>
          </div>
          {vehicle.documents.length ? (
            <div className="divide-y divide-line">
              {vehicle.documents.map((document) => {
                const state = documentState(document);
                const tone = state === "Valid" ? "ok" : state === "Expiring soon" ? "warn" : state === "Expired" ? "bad" : "neutral";
                return (
                  <div key={document._id.toString()} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                    <div className="min-w-0">
                      <p className="text-sm font-medium capitalize">{label(document.category)}{document.documentNumber ? ` · ${document.documentNumber}` : ""}</p>
                      <p className="mt-1 text-xs text-muted">
                        Issued {date(document.issueDate)} · Expires {date(document.expiryDate)}
                        {document.jurisdiction ? ` · ${document.jurisdiction}` : ""}
                      </p>
                      <p className="mt-1 text-xs text-muted">{document.fileName}</p>
                      <p className="mt-1 text-xs capitalize text-muted">Verification: {label(document.verificationStatus)}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Pill tone={tone}>{state}</Pill>
                      <a className="btn-ghost h-8 px-2.5 text-xs" href={`/api/fleet/documents/${document._id.toString()}`}>View file</a>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : <p className="p-6 text-sm text-muted">No documents have been added to this vehicle.</p>}
        </section>
      )}
        <section className="card overflow-hidden">
          <div className="border-b border-line px-5 py-4"><h2 className="text-sm font-semibold">Status history</h2></div>
          <div className="divide-y divide-line">
            {vehicle.statusHistory.slice().reverse().map((entry, index) => (
              <div key={`${entry.effectiveAt.toISOString()}-${index}`} className="flex flex-wrap justify-between gap-2 px-5 py-3 text-sm">
                <div>
                  <p className="font-medium capitalize">{label(entry.administrativeStatus)} · {label(entry.operationalStatus)}</p>
                  <p className="text-xs text-muted">{entry.byName}{entry.reason ? ` · ${entry.reason}` : ""}</p>
                </div>
                <p className="text-xs text-muted">{date(entry.effectiveAt)}</p>
              </div>
            ))}
          </div>
        </section>

      <section className="card overflow-hidden">
        <div className="border-b border-line px-5 py-4">
          <h2 className="text-sm font-semibold">Allocation history</h2>
        </div>
        {vehicle.allocations.length ? (
          <div className="divide-y divide-line">
            {vehicle.allocations.filter((allocation) => user.scope === "head" || allocation.officeId.toString() === user.office!.id).slice().reverse().map((allocation, index) => {
              const office = offices.find((option) => option._id.toString() === allocation.officeId.toString());
              return (
                <div key={`${allocation.allocatedAt.toISOString()}-${index}`} className="flex flex-wrap justify-between gap-2 px-5 py-3 text-sm">
                  <div><p className="font-medium">{office?.name ?? (allocation.officeId.toString() === user.headOffice!.id ? user.headOffice!.name : "Office")}</p><p className="text-xs text-muted">{allocation.reason} · {allocation.byName}</p></div>
                  <p className="text-xs text-muted">{date(allocation.allocatedAt)}{allocation.endedAt ? ` – ${date(allocation.endedAt)}` : " – Current"}</p>
                </div>
              );
            })}
          </div>
        ) : <p className="p-6 text-sm text-muted">No allocation history is available.</p>}
      </section>

      {canManageDocuments && (
        <FleetDocumentForm
          vehicleId={vehicle.id}
          documents={vehicle.documents.map((document) => ({ id: document._id.toString(), category: document.category, current: document.current }))}
        />
      )}
    </div>
  );
}
