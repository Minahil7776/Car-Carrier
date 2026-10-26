import { type NextRequest } from "next/server";
import { ObjectId } from "mongodb";
import { getCurrentUser } from "@/lib/auth";
import { filesCollection } from "@/lib/signup-draft";

export const runtime = "nodejs";
const notFound = () => new Response("Not found", { status: 404 });

/** Verification documents are visible to the Super Administrator only (SRS 50.5). */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  // 404 rather than 403, so the endpoint doesn't reveal which ids exist.
  if (!user || user.scope !== "system" || user.access.level !== "allowed") return notFound();

  const { id } = await params;
  if (!ObjectId.isValid(id)) return notFound();
  const doc = await (await filesCollection()).findOne({ _id: new ObjectId(id), registrationId: { $ne: null } });
  if (!doc) return notFound();

  const body = new Uint8Array(doc.data.buffer.subarray(0, doc.data.position));
  const disposition = req.nextUrl.searchParams.get("download") ? "attachment" : "inline";
  return new Response(body, {
    headers: {
      "Content-Type": doc.mime, // from the verified file signature, never from the client
      "Content-Length": String(body.byteLength),
      "Content-Disposition": `${disposition}; filename*=UTF-8''${encodeURIComponent(doc.name)}`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}
