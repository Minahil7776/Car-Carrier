import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Download, ShieldCheck } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { formatDate, subscriptionMeta } from "@/lib/utils";
import { Pill } from "@/components/ui/pill";
import { Empty } from "@/components/dashboard/section";
import { getSubscriptionAdminData } from "@/lib/subscription-management";
import { changePlanStatus, grantExemption, recordPayment, revokeExemption, savePlan, updateGraceSettings } from "./actions";

export const metadata: Metadata = { title: "Subscriptions" };
export const dynamic = "force-dynamic";

const input = "input h-10 w-full";
const label = "block space-y-1.5 text-sm font-medium";
const button = "btn-primary h-10 px-4";
const outline = "btn-outline h-9 px-3 text-xs";

export default async function SubscriptionsPage({ searchParams }: { searchParams: Promise<{ message?: string; office?: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.scope !== "system") redirect("/dashboard");
  const [{ message, office }, data] = await Promise.all([searchParams, getSubscriptionAdminData()]);
  const today = new Date().toISOString().slice(0, 10);
  const defaultOffice = data.offices.some((entry) => entry.id === office) ? office : undefined;
  const selectedOffice = data.offices.find((entry) => entry.id === defaultOffice);
  const officePayments = defaultOffice ? data.payments.filter((payment) => payment.officeId === defaultOffice) : [];

  return (
    <div className="space-y-6">
      <div>
        <Link href="/dashboard/organizations" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink"><ArrowLeft className="size-4" aria-hidden /> Organizations</Link>
        <h1 className="text-2xl font-semibold tracking-tight">Subscriptions</h1>
        <p className="mt-1 text-sm text-muted">Configure plans and grace settings, record payments, grant exemptions, and review subscription reports.</p>
      </div>

      {message && <p role="status" className="rounded-card border border-ok/30 bg-ok-soft px-4 py-3 text-sm text-ok">{message}</p>}

      {selectedOffice && <section className="card overflow-hidden">
        <header className="px-5 pb-3 pt-5"><h2 className="text-[15px] font-semibold">Subscription history: {selectedOffice.name}</h2><p className="mt-0.5 text-sm text-muted">Payments recorded specifically against this office.</p></header>
        {officePayments.length ? <ul className="divide-y divide-line">
          {officePayments.map((payment) => <li key={payment.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
            <div className="min-w-0 flex-1"><p className="font-medium">{payment.receiptNumber} · {payment.planName}</p><p className="text-xs text-muted">{formatDate(payment.periodStart)} – {formatDate(payment.periodEnd)} · paid {formatDate(payment.paymentDate)} · {payment.method}</p></div>
            <span className="font-medium">Rs. {payment.amount.toLocaleString()}</span>
            {payment.hasReceipt && <a href={`/api/subscriptions/payments/${payment.id}/receipt`} className="text-sm font-medium text-brand hover:underline">Receipt</a>}
          </li>)}
        </ul> : <Empty title="No payment history yet" body="Payments recorded for this office will appear here." />}
      </section>}

      <section id="office-status" className="card overflow-hidden">
        <header className="flex items-start justify-between gap-4 px-5 pb-3 pt-5">
          <div><h2 className="text-[15px] font-semibold">Office subscription status</h2><p className="mt-0.5 text-sm text-muted">Head offices and branches, including expiry and exemption dates.</p></div>
          <ShieldCheck className="size-5 text-muted" aria-hidden />
        </header>
        {data.offices.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead><tr className="border-y border-line bg-raised text-left text-xs text-muted">
                <th className="px-5 py-2 font-medium">Office</th><th className="px-3 py-2 font-medium">Head office</th><th className="px-3 py-2 font-medium">Office status</th>
                <th className="px-3 py-2 font-medium">Subscription</th><th className="px-3 py-2 font-medium">Expiry</th><th className="px-3 py-2 font-medium">Exemption</th>
                <th className="px-5 py-2 text-right font-medium">Action</th>
              </tr></thead>
              <tbody className="divide-y divide-line">
                {data.offices.map((entry) => (
                  <tr key={entry.id}>
                    <td className="px-5 py-3"><p className="font-medium">{entry.name}</p><p className="font-mono text-xs text-faint">{entry.code}</p></td>
                    <td className="px-3 py-3 text-muted">{entry.headOfficeName}</td>
                    <td className="px-3 py-3 capitalize">{entry.status}</td>
                    <td className="px-3 py-3"><Pill tone={subscriptionMeta[entry.subscriptionStatus].tone}>{subscriptionMeta[entry.subscriptionStatus].label}</Pill></td>
                    <td className="px-3 py-3">{formatDate(entry.expiresAt)}</td>
                    <td className="px-3 py-3">{entry.exemptUntil ? `${formatDate(entry.exemptFrom)} – ${formatDate(entry.exemptUntil)}` : "—"}</td>
                    <td className="px-5 py-3 text-right"><Link className={outline} href={`/dashboard/subscriptions?office=${entry.id}#record-payment`}>Record payment</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <Empty title="No offices yet" body="Approved offices will appear in this report." />}
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <section id="plans" className="card space-y-4 p-5">
          <div><h2 className="text-[15px] font-semibold">Subscription plans</h2><p className="mt-0.5 text-sm text-muted">Plan periods and pricing are configurable; no period is hard-coded.</p></div>
          <form action={savePlan} className="grid gap-3 sm:grid-cols-2">
            <label className={label}>Plan name<input name="name" required maxLength={80} className={input} placeholder="Quarterly" /></label>
            <label className={label}>Period label<input name="periodLabel" required maxLength={50} className={input} placeholder="3 months" /></label>
            <label className={label}>Period length (days)<input name="periodDays" required type="number" min="1" max="3650" className={input} placeholder="90" /></label>
            <label className={label}>Fee (PKR)<input name="amount" required type="number" min="0" step="0.01" className={input} placeholder="75000" /></label>
            <label className={label}>Applies to<select name="officeType" className={input}><option value="both">Head offices and branches</option><option value="head">Head offices</option><option value="branch">Branches</option></select></label>
            <label className={label}>Effective from<input name="effectiveFrom" type="date" required defaultValue={today} className={input} /></label>
            <label className={`${label} sm:col-span-2`}>Commercial terms (optional)<textarea name="terms" maxLength={500} rows={2} className="input h-auto resize-y py-2.5" /></label>
            <div className="sm:col-span-2"><button className={button}>Add active plan</button></div>
          </form>
          <div className="overflow-x-auto border-t border-line pt-3">
            {data.plans.length ? <table className="w-full min-w-[440px] text-left text-sm">
              <thead><tr className="text-xs text-muted"><th className="py-2 font-medium">Plan</th><th className="py-2 font-medium">Fee / period</th><th className="py-2 font-medium">Effective</th><th className="py-2 font-medium">Status</th><th className="py-2" /></tr></thead>
              <tbody className="divide-y divide-line">
                {data.plans.map((plan) => <tr key={plan.id}>
                  <td className="py-2 pr-2"><p className="font-medium">{plan.name}</p><p className="text-xs text-muted">{plan.periodLabel} · {plan.periodDays} days · {plan.officeType}</p></td>
                  <td className="py-2 pr-2">Rs. {plan.amount.toLocaleString()}</td><td className="py-2 pr-2">{formatDate(plan.effectiveFrom)}</td>
                  <td className="py-2 pr-2"><Pill tone={plan.status === "active" ? "ok" : "neutral"}>{plan.status}</Pill></td>
                  <td className="py-2 text-right"><form action={changePlanStatus}><input type="hidden" name="id" value={plan.id} /><input type="hidden" name="status" value={plan.status === "active" ? "inactive" : "active"} /><button className={outline}>{plan.status === "active" ? "Deactivate" : "Activate"}</button></form></td>
                </tr>)}
              </tbody>
            </table> : <p className="py-3 text-sm text-muted">No plans configured yet.</p>}
          </div>
        </section>

        <section id="grace-period" className="card space-y-4 p-5">
          <div><h2 className="text-[15px] font-semibold">Grace period</h2><p className="mt-0.5 text-sm text-muted">Select the duration and interim access behavior after expiry.</p></div>
          <form action={updateGraceSettings} className="grid gap-3 sm:grid-cols-2">
            <label className={label}>Grace period (days)<input name="gracePeriodDays" type="number" min="0" max="365" required defaultValue={data.settings.gracePeriodDays} className={input} /></label>
            <label className={label}>During grace<select name="graceMode" defaultValue={data.settings.graceMode} className={input}>
              <option value="warning_only">Warning only</option><option value="full_access">Full access</option><option value="read_only">Read only</option><option value="limited">Limited access</option>
            </select></label>
            <div className="sm:col-span-2"><button className={button}>Save grace settings</button></div>
          </form>

          <div id="grant-exemption" className="border-t border-line pt-4">
            <h3 className="text-sm font-semibold">Grant subscription exemption</h3>
            <p className="mt-0.5 text-xs text-muted">Apply to one office or a head office and all its existing branches.</p>
            <form action={grantExemption} className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className={`${label} sm:col-span-2`}>Office<select name="officeId" required defaultValue={defaultOffice ?? ""} className={input}>
                <option value="" disabled>Select office</option>{data.offices.map((entry) => <option key={entry.id} value={entry.id}>{entry.name} ({entry.type})</option>)}
              </select></label>
              <label className={label}>Exemption scope<select name="scope" className={input}><option value="office">Selected office only</option><option value="organization">Head office and all branches</option></select></label>
              <label className={label}>Reason<input name="reason" required minLength={3} maxLength={120} className={input} placeholder="Promotional / special approval" /></label>
              <label className={label}>From<input name="from" type="date" required className={input} /></label>
              <label className={label}>Until<input name="until" type="date" required className={input} /></label>
              <label className={`${label} sm:col-span-2`}>Remarks (optional)<textarea name="remarks" maxLength={500} rows={2} className="input h-auto resize-y py-2.5" /></label>
              <div className="sm:col-span-2"><button className={button}>Grant exemption</button></div>
            </form>
          </div>
        </section>
      </div>

      <section id="record-payment" className="card space-y-4 p-5">
        <div><h2 className="text-[15px] font-semibold">Record subscription payment</h2><p className="mt-0.5 text-sm text-muted">Payments are recorded against the office that paid and extend that office’s validity through the subscription period.</p></div>
        <form action={recordPayment} encType="multipart/form-data" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className={`${label} lg:col-span-2`}>Office<select name="officeId" required defaultValue={defaultOffice ?? ""} className={input}>
            <option value="" disabled>Select office</option>{data.offices.map((entry) => <option key={entry.id} value={entry.id}>{entry.name} ({entry.type})</option>)}
          </select></label>
          <label className={`${label} lg:col-span-2`}>Active plan<select name="planId" required defaultValue="" className={input}>
            <option value="" disabled>Select plan</option>{data.plans.filter((plan) => plan.status === "active").map((plan) => <option key={plan.id} value={plan.id}>{plan.name} · Rs. {plan.amount.toLocaleString()} · {plan.periodLabel}</option>)}
          </select></label>
          <label className={label}>Receipt number<input name="receiptNumber" required maxLength={60} className={input} placeholder="SUB-2027-000145" /></label>
          <label className={label}>Amount (PKR)<input name="amount" type="number" min="0" step="0.01" required className={input} /></label>
          <label className={label}>Payment date<input name="paymentDate" type="date" required defaultValue={today} className={input} /></label>
          <label className={label}>Payment method<input name="method" required maxLength={60} className={input} placeholder="Bank transfer" /></label>
          <label className={label}>Subscription period from<input name="periodStart" type="date" required className={input} /></label>
          <label className={label}>Subscription period to<input name="periodEnd" type="date" required className={input} /></label>
          <label className={label}>Transaction / reference<input name="reference" maxLength={120} className={input} /></label>
          <label className={label}>Supporting receipt (PDF/JPG/PNG, max 4 MB)<input name="receipt" type="file" accept=".pdf,.jpg,.jpeg,.png" className="block w-full text-sm text-muted file:mr-3 file:rounded-control file:border-0 file:bg-raised file:px-3 file:py-2" /></label>
          <label className={`${label} lg:col-span-4`}>Remarks (optional)<textarea name="remarks" maxLength={500} rows={2} className="input h-auto resize-y py-2.5" /></label>
          <div className="lg:col-span-4"><button className={button}>Save payment</button></div>
        </form>
      </section>

      <section id="outstanding" className="card overflow-hidden">
        <header className="px-5 pb-3 pt-5"><h2 className="text-[15px] font-semibold">Outstanding subscription report</h2><p className="mt-0.5 text-sm text-muted">Offices with an expired or missing subscription.</p></header>
        {data.outstanding.length ? <ul className="divide-y divide-line">
          {data.outstanding.map((entry) => <li key={entry.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
            <div className="min-w-0 flex-1"><p className="font-medium">{entry.name}</p><p className="text-xs text-muted">{entry.headOfficeName} · expires {formatDate(entry.expiresAt)}</p></div>
            <Pill tone={subscriptionMeta[entry.subscriptionStatus].tone}>{subscriptionMeta[entry.subscriptionStatus].label}</Pill>
            <Link href={`/dashboard/subscriptions?office=${entry.id}#record-payment`} className={outline}>Record payment</Link>
          </li>)}
        </ul> : <Empty title="No outstanding offices" body="Every office has an active subscription or exemption." />}
      </section>

      <section id="payments" className="card overflow-hidden">
        <header className="flex items-start justify-between gap-4 px-5 pb-3 pt-5"><div><h2 className="text-[15px] font-semibold">Subscription collection report</h2><p className="mt-0.5 text-sm text-muted">Recent subscription payments with receipt and collector information.</p></div><a href="/api/subscriptions/payments/export" className="btn-ghost h-8 px-3 text-xs"><Download className="size-3.5" aria-hidden /> Export CSV</a></header>
        {data.payments.length ? <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead><tr className="border-y border-line bg-raised text-xs text-muted"><th className="px-5 py-2 font-medium">Receipt / office</th><th className="px-3 py-2 font-medium">Period</th><th className="px-3 py-2 font-medium">Amount</th><th className="px-3 py-2 font-medium">Payment date / method</th><th className="px-3 py-2 font-medium">Received by</th><th className="px-5 py-2 font-medium">Supporting receipt</th></tr></thead>
            <tbody className="divide-y divide-line">{data.payments.map((payment) => <tr key={payment.id}>
              <td className="px-5 py-3"><p className="font-medium">{payment.receiptNumber}</p><p className="text-xs text-muted">{payment.officeName} · {payment.officeCode}</p></td>
              <td className="px-3 py-3">{formatDate(payment.periodStart)} – {formatDate(payment.periodEnd)}<p className="text-xs text-muted">{payment.planName}</p></td>
              <td className="px-3 py-3">Rs. {payment.amount.toLocaleString()}</td>
              <td className="px-3 py-3">{formatDate(payment.paymentDate)}<p className="text-xs text-muted">{payment.method}{payment.reference ? ` · ${payment.reference}` : ""}</p></td>
              <td className="px-3 py-3">{payment.receivedBy}</td>
              <td className="px-5 py-3">{payment.hasReceipt ? <a href={`/api/subscriptions/payments/${payment.id}/receipt`} className="font-medium text-brand hover:underline">View receipt</a> : "—"}</td>
            </tr>)}</tbody>
          </table>
        </div> : <Empty title="No payments recorded" body="Recorded payments will appear here." />}
      </section>

      <section id="exemptions" className="card overflow-hidden">
        <header className="px-5 pb-3 pt-5"><h2 className="text-[15px] font-semibold">Exemption report</h2><p className="mt-0.5 text-sm text-muted">Exemption period, reason, grantor, and expiry.</p></header>
        {data.exemptions.length ? <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-left text-sm">
            <thead><tr className="border-y border-line bg-raised text-xs text-muted"><th className="px-5 py-2 font-medium">Office / scope</th><th className="px-3 py-2 font-medium">Period</th><th className="px-3 py-2 font-medium">Reason / remarks</th><th className="px-3 py-2 font-medium">Granted by</th><th className="px-3 py-2 font-medium">Status</th><th className="px-5 py-2" /></tr></thead>
            <tbody className="divide-y divide-line">{data.exemptions.map((exemption) => <tr key={exemption.id}>
              <td className="px-5 py-3"><p className="font-medium">{exemption.officeName}</p><p className="text-xs capitalize text-muted">{exemption.scope}</p></td>
              <td className="px-3 py-3">{formatDate(exemption.from)} – {formatDate(exemption.until)}</td>
              <td className="px-3 py-3"><p>{exemption.reason}</p>{exemption.remarks && <p className="text-xs text-muted">{exemption.remarks}</p>}</td>
              <td className="px-3 py-3">{exemption.grantedBy}<p className="text-xs text-muted">{formatDate(exemption.grantedAt)}</p></td>
              <td className="px-3 py-3"><Pill tone={exemption.status === "active" ? "ok" : exemption.status === "scheduled" ? "beacon" : "neutral"}>{exemption.status}</Pill></td>
              <td className="px-5 py-3 text-right">{["active", "scheduled"].includes(exemption.status) && <form action={revokeExemption}><input type="hidden" name="id" value={exemption.id} /><button className={outline}>Revoke</button></form>}</td>
            </tr>)}</tbody>
          </table>
        </div> : <Empty title="No exemptions recorded" body="Granted exemptions will appear here." />}
      </section>
    </div>
  );
}
