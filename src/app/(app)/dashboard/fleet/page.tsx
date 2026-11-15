import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ObjectId } from "mongodb";
import { can, getCurrentUser } from "@/lib/auth";
import { documentState, getFleetVehicles } from "@/lib/fleet-data";
import { getDb } from "@/lib/mongodb";
import type { OfficeDoc } from "@/lib/types";
import { Pill } from "@/components/ui/pill";
import { CreateFleetVehicleForm } from "./fleet-forms";

export const metadata: Metadata = { title: "Fleet" };
export const dynamic = "force-dynamic";

const categoryLabel = (category: string) => category.replaceAll("_", " ");

export default async function FleetPage({ searchParams }: { searchParams: Promise<{ compliance?: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.scope === "system" || !user.office || !user.headOffice || !can(user, "fleet.view")) redirect("/dashboard");
  if (user.access.level === "denied") redirect("/dashboard");
  const { compliance } = await searchParams;

  const branchId = user.scope === "branch" ? user.office.id : undefined;
  const allVehicles = await getFleetVehicles(user.headOffice.id, branchId);
  const selectedCompliance = ["missing", "expiring", "expired"].includes(compliance ?? "") ? compliance : "all";
  const requiredCategories = ["registration", "insurance", "fitness", "route_permit"];
  const vehicles = selectedCompliance === "all" ? allVehicles : allVehicles.filter((vehicle) => {
    const current = vehicle.documents.filter((document) => document.current);
    const states = current.map((document) => documentState(document));
    if (selectedCompliance === "missing") return requiredCategories.some((category) => !current.some((document) => document.category === category));
    if (selectedCompliance === "expiring") return states.includes("Expiring soon");
    return states.includes("Expired");
  });
  const db = await getDb();
  const offices = user.scope === "head" && can(user, "fleet.create")
    ? await db.collection<OfficeDoc>("offices").find({
      $or: [{ _id: new ObjectId(user.headOffice.id), type: "head" }, { type: "branch", parentId: new ObjectId(user.headOffice.id) }],
    }).sort({ type: 1, name: 1 }).toArray()
    : [];
  const officeOptions = offices.map((office) => ({ id: office._id.toString(), name: office.name, type: office.type }));

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-brand">Operations</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Fleet</h1>
        <p className="mt-1 text-sm text-muted">
          {user.scope === "head" ? `Vehicles controlled by ${user.headOffice.name} and its branches.` : `Recovery vehicles assigned to ${user.office.name}.`}
        </p>
      </header>

      {user.scope === "head" && can(user, "fleet.create") && user.access.level === "allowed" && (
        <CreateFleetVehicleForm offices={officeOptions} />
      )}

      <section className="card overflow-hidden">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold">Fleet vehicles</h2>
            <p className="mt-1 text-xs text-muted">{vehicles.length} record{vehicles.length === 1 ? "" : "s"} in your authorized scope</p>
          </div>
          <form method="get" className="flex items-center gap-2">
            <label htmlFor="compliance" className="text-xs text-muted">Document compliance</label>
            <select id="compliance" name="compliance" defaultValue={selectedCompliance} className="input h-9 w-auto min-w-36 py-0 text-xs">
              <option value="all">All vehicles</option><option value="missing">Missing</option><option value="expiring">Expiring soon</option><option value="expired">Expired</option>
            </select>
            <button className="btn-outline h-9 px-3 text-xs">Filter</button>
          </form>
        </div>
        {vehicles.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[780px] text-sm">
              <thead><tr className="border-b border-line bg-raised text-left text-xs text-muted">
                <th className="px-5 py-3 font-medium">Vehicle</th>
                <th className="px-3 py-3 font-medium">Category</th>
                <th className="px-3 py-3 font-medium">Assigned office</th>
                <th className="px-3 py-3 font-medium">Administrative</th>
                <th className="px-3 py-3 font-medium">Operational</th>
                <th className="px-4 py-3 text-right font-medium">Documents</th>
              </tr></thead>
              <tbody className="divide-y divide-line">
                {vehicles.map((vehicle) => {
                  const expiring = vehicle.documents.filter((doc) => doc.current && doc.expiryDate && doc.expiryDate.getTime() <= Date.now() + 30 * 86_400_000).length;
                  return (
                    <tr key={vehicle.id} className="hover:bg-raised/60">
                      <td className="px-5 py-3">
                        <Link className="font-medium text-brand hover:underline" href={`/dashboard/fleet/${vehicle.id}`}>{vehicle.registrationNumber}</Link>
                        <p className="mt-0.5 text-xs text-muted">{vehicle.fleetId} · {vehicle.make} {vehicle.model}</p>
                      </td>
                      <td className="px-3 py-3 capitalize">{categoryLabel(vehicle.vehicleType)}</td>
                      <td className="px-3 py-3">{vehicle.assignedOfficeName}</td>
                      <td className="px-3 py-3"><Pill tone={vehicle.administrativeStatus === "active" ? "ok" : vehicle.administrativeStatus === "retired" ? "bad" : "neutral"}>{vehicle.administrativeStatus}</Pill></td>
                      <td className="px-3 py-3 capitalize">{vehicle.operationalStatus.replaceAll("_", " ")}</td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-muted">{vehicle.documents.filter((doc) => doc.current).length} current</span>
                        {expiring > 0 && <span className="ml-2 text-warn">{expiring} due soon/expired</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="p-8 text-center text-sm text-muted">
            {user.scope === "branch" ? "No recovery vehicles are currently assigned to this branch." : "No vehicles have been registered in this head office fleet."}
          </p>
        )}
      </section>
    </div>
  );
}
