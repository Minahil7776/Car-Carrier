import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";
import type { SubscriptionPayment } from "@/lib/subscription-management";
import type { OfficeDoc } from "@/lib/types";

const csv = (value: string | number) => {
  const safe = String(value).replace(/^[=+\-@\t\r]/, "'$&");
  return `"${safe.replace(/"/g, '""')}"`;
};

export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.scope !== "system" || user.access.level !== "allowed") return new Response("Not found", { status: 404 });
  const db = await getDb();
  const [payments, offices] = await Promise.all([
    db.collection<SubscriptionPayment>("subscription_payments").find({}).sort({ paymentDate: -1 }).toArray(),
    db.collection<OfficeDoc>("offices").find({ type: "head" }, { projection: { name: 1 } }).toArray(),
  ]);
  const heads = new Map(offices.map((office) => [office._id.toString(), office.name]));
  const header = ["Receipt number", "Office", "Head office", "Period start", "Period end", "Plan", "Amount PKR", "Payment date", "Method", "Reference", "Received by", "Status"];
  const rows = payments.map((payment) => [
    payment.receiptNumber, payment.officeName, heads.get(payment.headOfficeId.toString()) ?? "—", payment.periodStart.toISOString().slice(0, 10),
    payment.periodEnd.toISOString().slice(0, 10), payment.planName, payment.amount, payment.paymentDate.toISOString().slice(0, 10),
    payment.method, payment.reference, payment.receivedBy, payment.status,
  ]);
  const body = [header, ...rows].map((row) => row.map(csv).join(",")).join("\r\n");
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="subscription-collection.csv"',
      "Cache-Control": "private, no-store",
    },
  });
}
