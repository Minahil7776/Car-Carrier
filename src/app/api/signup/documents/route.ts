import { NextResponse, type NextRequest } from "next/server";
import { Binary, ObjectId } from "mongodb";
import { UPLOAD_LIMITS } from "@/lib/signup-config";
import { filesCollection, verifyDraftToken } from "@/lib/signup-draft";
import { declaredTooLarge, readUpload, tooLargeMessage } from "@/lib/upload-validate";
import { getRegistrationDocumentTypes } from "@/lib/registration-documents";

export const runtime = "nodejs";
const fail = (error: string, status: number) => NextResponse.json({ error }, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(req: NextRequest) {
  if (declaredTooLarge(req)) return fail(tooLargeMessage, 413);

  let form: FormData;
  try { form = await req.formData(); } catch { return fail("The upload could not be read. Please try again.", 400); }

  const draftId = await verifyDraftToken(String(form.get("token") ?? ""));
  if (!draftId) return fail("Your upload session expired. Refresh the page to start again.", 401);

  const up = await readUpload(form, await getRegistrationDocumentTypes());
  if (!up.ok) return fail(up.error, up.status);
  const { docType, buf, mime, name } = up;

  try {
    const col = await filesCollection();
    // One file per document type: uploading again replaces the earlier draft file.
    await col.deleteMany({ draftId, docType, registrationId: null });
    const _id = new ObjectId();
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
