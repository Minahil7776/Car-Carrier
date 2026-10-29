import { ObjectId } from "mongodb";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";
import type { SubscriptionPayment } from "@/lib/subscription-management";

const notFound = () => new Response("Not found", { status: 404 });

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.scope !== "system" || user.access.level !== "allowed") return notFound();

  const { id } = await params;
  if (!ObjectId.isValid(id)) return notFound();
  const payment = await (await getDb()).collection<SubscriptionPayment>("subscription_payments").findOne({ _id: new ObjectId(id) });
  if (!payment?.receipt) return notFound();

  const body = new Uint8Array(payment.receipt.data.buffer.subarray(0, payment.receipt.data.position));
  return new Response(body, {
    headers: {
      "Content-Type": payment.receipt.mime,
      "Content-Length": String(body.byteLength),
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(payment.receipt.name)}`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}
