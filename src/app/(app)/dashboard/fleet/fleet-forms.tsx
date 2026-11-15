"use client";

import { useActionState, useEffect, useState } from "react";
import { Check, Pencil, X } from "lucide-react";
import type { FleetActionState } from "./actions";
import { addFleetDocument, createFleetVehicle, transferRecoveryVehicle, updateFleetVehicle, updateFleetVehicleDetails } from "./actions";
import { useToast } from "@/components/ui/toast";

interface OfficeOption { id: string; name: string; type: "head" | "branch" }
interface VehicleOption { id: string; fleetId: string; vehicleType: string; operationalStatus: string; administrativeStatus: string }

function Feedback({ state }: { state: FleetActionState }) {
  if (state.error) return <p role="alert" className="text-sm text-bad">{state.error}</p>;
  if (state.ok) return <p role="status" className="text-sm text-ok">{state.message}</p>;
  return null;
}

function FieldError({ state, name }: { state: FleetActionState; name: string }) {
  return state.fieldErrors?.[name] ? <p className="mt-1 text-xs text-bad">{state.fieldErrors[name]}</p> : null;
}

export function CreateFleetVehicleForm({ offices }: { offices: OfficeOption[] }) {
  const [state, action, pending] = useActionState(createFleetVehicle, {});
  return (
    <form action={action} className="card space-y-4 p-5">
      <div>
        <h2 className="text-base font-semibold">Register a vehicle</h2>
        <p className="mt-1 text-sm text-muted">Create a Head Office fleet record. Hired vehicles for individual trips are not fleet master records.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="field-label">Vehicle category
          <select className="field-input" name="vehicleType" defaultValue="recovery_vehicle">
            <option value="recovery_vehicle">Recovery vehicle</option>
            <option value="car_carrier">Car carrier</option>
            <option value="other">Other</option>
          </select>
        </label>
        <label className="field-label">Registration number
          <input className="field-input" name="registrationNumber" required maxLength={30} />
          <FieldError state={state} name="registrationNumber" />
        </label>
        <label className="field-label">Make
          <input className="field-input" name="make" required maxLength={80} />
          <FieldError state={state} name="make" />
        </label>
        <label className="field-label">Model
          <input className="field-input" name="model" required maxLength={80} />
          <FieldError state={state} name="model" />
        </label>
        <label className="field-label">Model year
          <input className="field-input" name="modelYear" inputMode="numeric" pattern="[0-9]{4}" />
          <FieldError state={state} name="modelYear" />
        </label>
        <label className="field-label">Chassis / VIN
          <input className="field-input" name="chassisNumber" maxLength={80} />
          <FieldError state={state} name="chassisNumber" />
        </label>
        <label className="field-label">Engine number
          <input className="field-input" name="engineNumber" maxLength={80} />
        </label>
        <label className="field-label">Acquisition date
          <input className="field-input" type="date" name="acquisitionDate" />
          <FieldError state={state} name="acquisitionDate" />
        </label>
        <label className="field-label">Capacity
          <input className="field-input" name="capacity" maxLength={80} placeholder="e.g. 2 vehicles" />
        </label>
        <label className="field-label">Initial operational status
          <select className="field-input" name="operationalStatus" defaultValue="available">
            <option value="available">Available</option><option value="assigned">Assigned</option>
            <option value="maintenance">Maintenance</option><option value="out_of_service">Out of service</option>
          </select>
        </label>
        <label className="field-label">Initial controlling office
          <select className="field-input" name="assignedOfficeId" required defaultValue={offices.find((office) => office.type === "head")?.id}>
            {offices.map((office) => <option key={office.id} value={office.id}>{office.name}</option>)}
          </select>
          <FieldError state={state} name="assignedOfficeId" />
        </label>
        <label className="field-label sm:col-span-2">Remarks
          <textarea className="field-input min-h-20" name="remarks" maxLength={1000} />
        </label>
      </div>
      <Feedback state={state} />
      <button className="btn-primary h-10 px-4" disabled={pending}>{pending ? "Saving…" : "Register vehicle"}</button>
    </form>
  );
}

export function FleetVehicleActions({ vehicle, offices, canManage, canAllocate }: {
  vehicle: VehicleOption;
  offices: OfficeOption[];
  canManage: boolean;
  canAllocate: boolean;
}) {
  const [statusState, statusAction, statusPending] = useActionState(updateFleetVehicle, {});
  const [transferState, transferAction, transferPending] = useActionState(transferRecoveryVehicle, {});
  const [editingStatus, setEditingStatus] = useState(false);
  const toast = useToast();
  useEffect(() => {
    if (statusState.ok) {
      setEditingStatus(false);
      toast(statusState.message ?? "Vehicle status updated.");
    } else if (statusState.error) toast(statusState.error, "error");
  }, [statusState, toast]);
  useEffect(() => {
    if (transferState.ok) toast(transferState.message ?? "Vehicle transferred.");
    else if (transferState.error) toast(transferState.error, "error");
  }, [transferState, toast]);
  const branchOptions = offices.filter((office) => office.type === "branch");
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="card space-y-4 p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">Vehicle status</h2>
            <p className="mt-1 text-xs text-muted">Administrative and operational availability</p>
          </div>
          {canManage && !editingStatus && (
            <button type="button" className="btn-outline h-9 px-3 text-xs" onClick={() => setEditingStatus(true)}>
              <Pencil className="size-3.5" aria-hidden /> Edit
            </button>
          )}
        </div>
        {editingStatus ? (
          <form action={statusAction} className="space-y-3">
            <input type="hidden" name="vehicleId" value={vehicle.id} />
            <label className="field-label">Administrative status
              <select className="field-input" name="administrativeStatus" defaultValue={vehicle.administrativeStatus}>
                <option value="active">Active</option><option value="inactive">Inactive</option><option value="retired">Retired</option>
              </select>
              <FieldError state={statusState} name="administrativeStatus" />
            </label>
            <label className="field-label">Operational status
              <select className="field-input" name="operationalStatus" defaultValue={vehicle.operationalStatus}>
                <option value="available">Available</option><option value="assigned">Assigned</option><option value="on_trip">On trip</option>
                <option value="maintenance">Maintenance</option><option value="out_of_service">Out of service</option>
              </select>
            </label>
            <label className="field-label">Reason
              <input className="field-input" name="reason" required minLength={3} maxLength={300} />
              <FieldError state={statusState} name="reason" />
            </label>
            <Feedback state={statusState} />
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-ghost" onClick={() => setEditingStatus(false)}>Cancel</button>
              <button className="btn-primary" disabled={statusPending}>
                <Check className="size-4" aria-hidden />{statusPending ? "Saving…" : "Save status"}
              </button>
            </div>
          </form>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <div><p className="text-xs text-muted">Administrative</p><p className="mt-1 text-sm font-medium capitalize">{vehicle.administrativeStatus}</p></div>
            <div><p className="text-xs text-muted">Operational</p><p className="mt-1 text-sm font-medium capitalize">{vehicle.operationalStatus.replaceAll("_", " ")}</p></div>
          </div>
        )}
      </section>
      {canAllocate && vehicle.vehicleType === "recovery_vehicle" && branchOptions.length > 0 && (
        <form action={transferAction} className="card space-y-3 p-5">
          <h2 className="text-sm font-semibold">Transfer recovery vehicle</h2>
          <input type="hidden" name="vehicleId" value={vehicle.id} />
          <label className="field-label">New controlling office
            <select className="field-input" name="officeId" required defaultValue="">
              <option value="" disabled>Choose an office</option>
              {offices.map((office) => <option key={office.id} value={office.id}>{office.name}</option>)}
            </select>
          </label>
          <label className="field-label">Transfer reason
            <input className="field-input" name="reason" required minLength={3} maxLength={300} />
          </label>
          <Feedback state={transferState} />
          <div className="flex justify-end">
            <button className="btn-primary" disabled={transferPending}>{transferPending ? "Transferring…" : "Transfer vehicle"}</button>
          </div>
        </form>
      )}
    </div>
  );
}

export function FleetVehicleDetailsForm({ vehicle, canEdit }: { vehicle: {
  id: string;
  vehicleType: string;
  registrationNumber: string;
  make: string;
  model: string;
  modelYear?: number;
  chassisNumber?: string;
  engineNumber?: string;
  acquisitionDate?: string;
  capacity?: string;
  remarks?: string;
  assignedOfficeName: string;
  ownershipClassification: string;
  registeredDate: string;
}; canEdit: boolean }) {
  const [state, action, pending] = useActionState(updateFleetVehicleDetails, {});
  const [editing, setEditing] = useState(false);
  const toast = useToast();
  useEffect(() => {
    if (state.ok) {
      setEditing(false);
      toast(state.message ?? "Vehicle details updated.");
    } else if (state.error) toast(state.error, "error");
  }, [state, toast]);
  const displayFields = [
    ["Category", vehicle.vehicleType.replaceAll("_", " ")],
    ["Registration number", vehicle.registrationNumber],
    ["Make and model", `${vehicle.make} ${vehicle.model}${vehicle.modelYear ? ` (${vehicle.modelYear})` : ""}`],
    ["Assigned office", vehicle.assignedOfficeName],
    ["Ownership", vehicle.ownershipClassification.replaceAll("_", " ")],
    ["Chassis / VIN", vehicle.chassisNumber || "—"],
    ["Engine number", vehicle.engineNumber || "—"],
    ["Acquisition date", vehicle.acquisitionDate ? new Date(`${vehicle.acquisitionDate}T00:00:00Z`).toLocaleDateString("en-GB", { timeZone: "UTC" }) : "—"],
    ["Registered", vehicle.registeredDate],
    ["Capacity", vehicle.capacity || "—"],
    ...(vehicle.remarks ? [["Remarks", vehicle.remarks]] : []),
  ];
  return (
    <section className="card space-y-5 p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Vehicle details</h2>
          <p className="mt-1 text-xs text-muted">Master record and identification</p>
        </div>
        {canEdit && !editing && (
          <button type="button" className="btn-outline h-9 px-3 text-xs" onClick={() => setEditing(true)}>
            <Pencil className="size-3.5" aria-hidden /> Edit details
          </button>
        )}
      </div>
      {editing && canEdit ? <form action={action} className="space-y-4">
      <input type="hidden" name="vehicleId" value={vehicle.id} />
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="field-label">Category
          <select className="field-input" name="vehicleType" defaultValue={vehicle.vehicleType}>
            <option value="recovery_vehicle">Recovery vehicle</option><option value="car_carrier">Car carrier</option><option value="other">Other</option>
          </select>
          <FieldError state={state} name="vehicleType" />
        </label>
        <label className="field-label">Registration number
          <input className="field-input" name="registrationNumber" required defaultValue={vehicle.registrationNumber} maxLength={30} />
          <FieldError state={state} name="registrationNumber" />
        </label>
        <label className="field-label">Make<input className="field-input" name="make" required defaultValue={vehicle.make} maxLength={80} /></label>
        <label className="field-label">Model<input className="field-input" name="model" required defaultValue={vehicle.model} maxLength={80} /></label>
        <label className="field-label">Model year<input className="field-input" name="modelYear" defaultValue={vehicle.modelYear ?? ""} inputMode="numeric" pattern="[0-9]{4}" /></label>
        <label className="field-label">Chassis / VIN<input className="field-input" name="chassisNumber" defaultValue={vehicle.chassisNumber ?? ""} maxLength={80} /></label>
        <label className="field-label">Engine number<input className="field-input" name="engineNumber" defaultValue={vehicle.engineNumber ?? ""} maxLength={80} /></label>
        <label className="field-label">Acquisition date<input className="field-input" type="date" name="acquisitionDate" defaultValue={vehicle.acquisitionDate ?? ""} /></label>
        <label className="field-label">Capacity<input className="field-input" name="capacity" defaultValue={vehicle.capacity ?? ""} maxLength={80} /></label>
        <label className="field-label sm:col-span-2">Remarks<textarea className="field-input min-h-20" name="remarks" defaultValue={vehicle.remarks ?? ""} maxLength={1000} /></label>
      </div>
      {state.fieldErrors && <ul className="space-y-1 text-xs text-bad" role="alert">{Object.entries(state.fieldErrors).map(([field, message]) => <li key={field}>{message}</li>)}</ul>}
      <Feedback state={state} />
      <div className="flex justify-end gap-2">
        <button type="button" className="btn-ghost" onClick={() => setEditing(false)}><X className="size-4" aria-hidden /> Cancel</button>
        <button className="btn-primary" disabled={pending}><Check className="size-4" aria-hidden />{pending ? "Saving…" : "Save changes"}</button>
      </div>
      </form> : (
        <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
          {displayFields.map(([name, value]) => (
            <div key={name}><dt className="text-xs text-muted">{name}</dt><dd className="mt-1 whitespace-pre-wrap text-sm font-medium">{value}</dd></div>
          ))}
        </dl>
      )}
    </section>
  );
}

export function FleetDocumentForm({ vehicleId, documents }: { vehicleId: string; documents: { id: string; category: string; current: boolean }[] }) {
  const [state, action, pending] = useActionState(addFleetDocument, {});
  const [expanded, setExpanded] = useState(false);
  const toast = useToast();
  useEffect(() => {
    if (state.ok) {
      setExpanded(false);
      toast(state.message ?? "Document saved.");
    } else if (state.error) toast(state.error, "error");
    else if (state.fieldErrors) setExpanded(true);
  }, [state, toast]);
  const currentDocuments = documents.filter((document) => document.current);
  return (
    <form action={action} encType="multipart/form-data" className="card space-y-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Vehicle documents</h2>
          <p className="mt-1 text-sm text-muted">PDF, JPEG, or PNG; maximum 4 MB. Renewals preserve the previous record.</p>
        </div>
        <button type="button" className="btn-outline" onClick={() => setExpanded((open) => !open)}>
          {expanded ? <><X className="size-4" aria-hidden /> Cancel</> : <>Add or renew document</>}
        </button>
      </div>
      {expanded && <>
      <input type="hidden" name="vehicleId" value={vehicleId} />
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="field-label">Category
          <select className="field-input" name="category" defaultValue="registration">
            <option value="registration">Registration</option><option value="insurance">Insurance</option>
            <option value="fitness">Fitness certificate</option><option value="route_permit">Route permit</option><option value="other">Other</option>
          </select>
          <FieldError state={state} name="category" />
        </label>
        <label className="field-label">Document number
          <input className="field-input" name="documentNumber" maxLength={120} />
        </label>
        <label className="field-label">Issuing authority
          <input className="field-input" name="issuingAuthority" maxLength={120} />
        </label>
        <label className="field-label">Route / Province / Region
          <input className="field-input" name="jurisdiction" maxLength={160} />
        </label>
        <label className="field-label">Issue date
          <input className="field-input" type="date" name="issueDate" />
        </label>
        <label className="field-label">Effective date
          <input className="field-input" type="date" name="effectiveDate" />
        </label>
        <label className="field-label">Expiry date
          <input className="field-input" type="date" name="expiryDate" />
          <FieldError state={state} name="expiryDate" />
        </label>
        <label className="field-label">Replace previous record (optional)
          <select className="field-input" name="replacesId" defaultValue="">
            <option value="">New document record</option>
            {currentDocuments.map((document) => <option key={document.id} value={document.id}>{document.category.replaceAll("_", " ")}</option>)}
          </select>
        </label>
        <label className="field-label sm:col-span-2">Document file
          <input className="field-input" type="file" name="file" accept="application/pdf,image/jpeg,image/png" required />
          <FieldError state={state} name="file" />
        </label>
        <label className="field-label sm:col-span-2">Remarks
          <textarea className="field-input min-h-20" name="remarks" maxLength={1000} />
        </label>
      </div>
      <Feedback state={state} />
      <div className="flex justify-end">
        <button className="btn-primary" disabled={pending}><Check className="size-4" aria-hidden />{pending ? "Uploading…" : "Save document"}</button>
      </div>
      </>}
    </form>
  );
}
