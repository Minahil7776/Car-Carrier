import { NextResponse, type NextRequest } from "next/server";
import { Binary, ObjectId } from "mongodb";
import { DOCUMENT_TYPES, UPLOAD_LIMITS } from "@/lib/signup-config";
import { filesCollection, sniffMime, verifyDraftToken } from "@/lib/signup-draft";

export const runtime = "nodejs";
const MB = UPLOAD_LIMITS.maxFileBytes / 1024 / 1024;
const fail = (error: string, status: number) => NextResponse.json({ error }, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(req: NextRequest) {
  // Reject oversized requests before reading the body.
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > UPLOAD_LIMITS.maxFileBytes + 64 * 1024) return fail(`This file is too large. The limit is ${MB} MB.`, 413);

  let form: FormData;
  try { form = await req.formData(); } catch { return fail("The upload could not be read. Please try again.", 400); }

  const draftId = await verifyDraftToken(String(form.get("token") ?? ""));
  if (!draftId) return fail("Your upload session expired. Refresh the page to start again.", 401);

  const docType = String(form.get("docType") ?? "");
  if (!DOCUMENT_TYPES.some((d) => d.key === docType)) return fail("Unknown document type.", 400);

  const file = form.get("file");
  if (!(file instanceof File)) return fail("Choose a file to upload.", 400);
  if (file.size === 0) return fail("This file is empty.", 400);
  if (file.size > UPLOAD_LIMITS.maxFileBytes) return fail(`This file is too large. The limit is ${MB} MB.`, 413);

  const buf = Buffer.from(await file.arrayBuffer());
  const mime = sniffMime(buf);
  if (!mime) return fail(`Only ${UPLOAD_LIMITS.label} files are accepted.`, 415);

  try {
    const col = await filesCollection();
    // One file per document type: uploading again replaces the earlier draft file.
    await col.deleteMany({ draftId, docType, registrationId: null });
    const _id = new ObjectId();
    const name = file.name.replace(/[\\/\u0000-\u001f]/g, "").slice(-120) || "document";
    await col.insertOne({
      _id, draftId, registrationId: null, docType, name, mime, size: buf.length,
      data: new Binary(buf), createdAt: new Date(), expiresAt: new Date(Date.now() + UPLOAD_LIMITS.draftHours * 3_600_000),
    });
    return NextResponse.json({ file: { id: _id.toString(), docType, name, size: buf.length } }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("document upload failed", err);
    return fail("We couldn't save this file. Please try again.", 500);
  }
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id") ?? "";
  const draftId = await verifyDraftToken(req.nextUrl.searchParams.get("token"));
  if (!draftId) return fail("Your upload session expired.", 401);
  if (!ObjectId.isValid(id)) return fail("Unknown file.", 400);
  try {
    // Only drafts of this session can be deleted, never a file already attached to a registration.
    await (await filesCollection()).deleteOne({ _id: new ObjectId(id), draftId, registrationId: null });
    return NextResponse.json({ ok: true });
  } catch {
    return fail("Couldn't remove the file. Please try again.", 500);
  }
}
