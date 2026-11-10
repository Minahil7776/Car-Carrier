"use client";

import { useState } from "react";
import { recordPayment } from "./actions";

type OfficeOption = { id: string; name: string; type: string };
type PlanOption = { id: string; name: string; periodLabel: string; periodDays: number; amount: number };

export function PaymentForm({
  offices,
  plans,
  defaultOffice,
  today,
}: {
  offices: OfficeOption[];
  plans: PlanOption[];
  defaultOffice?: string;
  today: string;
}) {
  const [planId, setPlanId] = useState("");
  const [periodStart, setPeriodStart] = useState("");
  const selectedPlan = plans.find((plan) => plan.id === planId);
  let periodEnd = "";
  if (selectedPlan && /^\d{4}-\d{2}-\d{2}$/.test(periodStart)) {
    const start = new Date(`${periodStart}T00:00:00.000Z`);
    if (!Number.isNaN(start.getTime()) && start.toISOString().slice(0, 10) === periodStart) {
      start.setUTCDate(start.getUTCDate() + selectedPlan.periodDays - 1);
      periodEnd = start.toISOString().slice(0, 10);
    }
  }

  const input = "input h-10 w-full";
  const label = "block space-y-1.5 text-sm font-medium";
  const button = "btn-primary h-10 px-4";

  return (
    <form action={recordPayment} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <label className={`${label} lg:col-span-2`}>Office<select name="officeId" required defaultValue={defaultOffice ?? ""} className={input}>
        <option value="" disabled>Select office</option>{offices.map((office) => <option key={office.id} value={office.id}>{office.name} ({office.type})</option>)}
      </select></label>
      <label className={`${label} lg:col-span-2`}>Active plan<select name="planId" required value={planId} onChange={(event) => setPlanId(event.target.value)} className={input}>
        <option value="" disabled>Select plan</option>{plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name} · Rs. {plan.amount.toLocaleString()} · {plan.periodLabel} ({plan.periodDays} days)</option>)}
      </select></label>
      <label className={label}>Receipt number<input name="receiptNumber" required maxLength={60} className={input} placeholder="SUB-2027-000145" /></label>
      <label className={label}>Amount (PKR)<input name="amount" type="number" min="0" step="0.01" required className={input} /></label>
      <label className={label}>Payment date<input name="paymentDate" type="date" required defaultValue={today} className={input} /></label>
      <label className={label}>Payment method<input name="method" required maxLength={60} className={input} placeholder="Bank transfer" /></label>
      <label className={label}>Subscription period from<input name="periodStart" type="date" required value={periodStart} onChange={(event) => setPeriodStart(event.target.value)} className={input} /></label>
      <label className={label}>Subscription period to (calculated)<input type="date" readOnly value={periodEnd} className={input} /></label>
      <label className={label}>Transaction / reference<input name="reference" maxLength={120} className={input} /></label>
      <label className={label}>Supporting receipt (PDF/JPG/PNG, max 4 MB)<input name="receipt" type="file" accept=".pdf,.jpg,.jpeg,.png" className="block w-full text-sm text-muted file:mr-3 file:rounded-control file:border-0 file:bg-raised file:px-3 file:py-2" /></label>
      <label className={`${label} lg:col-span-4`}>Remarks (optional)<textarea name="remarks" maxLength={500} rows={2} className="input h-auto resize-y py-2.5" /></label>
      <div className="lg:col-span-4"><button className={button}>Save payment</button></div>
    </form>
  );
}
