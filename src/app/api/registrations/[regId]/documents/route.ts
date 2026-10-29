import { NextResponse, type NextRequest } from "next/server";
import { Binary, ObjectId } from "mongodb";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";
import { writeAudit } from "@/lib/audit";
import { docLabel } from "@/lib/signup-config";
import { getRegistrationDocumentTypes } from "@/lib/registration-documents";
import { filesCollection } from "@/lib/signup-draft";
import { declaredTooLarge, readUpload, tooLargeMessage } from "@/lib/upload-validate";

export const runtime = "nodejs";
const OPEN = ["pending", "under_review", "info_required"];
const fail = (error: string, status: number) => NextResponse.json({ error }, { status, headers: { "Cache-Control": "no-store" } });

interface StoredDoc { fileId: ObjectId; docType: string; name: string; size: number; mime: string }

/** Only the Super Administrator, and only while the request is still open. */
async function gate(regId: string) {
  const user = await getCurrentUser();
  if (!user || user.scope !== "system" || user.access.level !== "allowed") return { err: fail("Not found.", 404) };
  if (!ObjectId.isValid(regId)) return { err: fail("Not found.", 404) };
  const db = await getDb();
  const reg = await db.collection("registrations").findOne({ _id: new ObjectId(regId) });
  if (!reg) return { err: fail("Not found.", 404) };
  if (!OPEN.includes(reg.status)) return { err: fail("This request has already been decided, so its documents can no longer be changed.", 409) };
  return { user, db, reg };
}

const historyEntry = (by: string, action: string, remarks: string) => ({ at: new Date(), by, action, remarks });

export async function POST(req: NextRequest, { params }: { params: Promise<{ regId: string }> }) {
  const { regId } = await params;
  if (declaredTooLarge(req)) return fail(tooLargeMessage, 413);

  const g = await gate(regId);
  if (g.err) return g.err;
  const { user, db, reg } = g;

  let form: FormData;
  try { form = await req.formData(); } catch { return fail("The upload could not be read. Please try again.", 400); }
  const documentTypes = await getRegistrationDocumentTypes();
  const up = await readUpload(form, documentTypes);
  if (!up.ok) return fail(up.error, up.status);

  try {
    const files = await filesCollection();
    const regs = db.collection("registrations");
    const existing: StoredDoc[] = reg.documents ?? [];
    const replaced = existing.find((d) => d.docType === up.docType);

    const fileId = new ObjectId();
    await files.insertOne({ _id: fileId, draftId: `admin-${regId}`, registrationId: reg._id, docType: up.docType, name: up.name, mime: up.mime, size: up.buf.length, data: new Binary(up.buf), createdAt: new Date() });

    const documents = [...existing.filter((d) => d.docType !== up.docType), { fileId, docType: up.docType, name: up.name, size: up.buf.length, mime: up.mime }];
    const res = await regs.updateOne(
      { _id: reg._id, status: { $in: OPEN } },
      {
        $set: { documents, documentsCount: documents.length, ...(reg.status === "pending" ? { status: "under_review" } : {}) },
        $push: { history: historyEntry(user.name, "document_added", `${replaced ? "Replaced" : "Added"} ${docLabel(up.docType, documentTypes)}: ${up.name}`) },
      } as never,
    );
    if (!res.modifiedCount) { await files.deleteOne({ _id: fileId }); return fail("This request has just been decided, so the document was not saved.", 409); }

    if (replaced) await files.deleteOne({ _id: replaced.fileId });
    await writeAudit({ userId: new ObjectId(user.id), userName: user.name, headOfficeId: null, officeId: null, action: "registration.document", summary: `${replaced ? "Replaced" : "Added"} ${docLabel(up.docType, documentTypes)} on ${reg.officeName}`, entity: "registration", entityId: regId });
    return NextResponse.json({ file: { id: fileId.toString(), docType: up.docType, name: up.name, size: up.buf.length } }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("admin document upload failed", err);
    return fail("We couldn't save this file. Please try again.", 500);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ regId: string }> }) {
  const { regId } = await params;
  const fileId = req.nextUrl.searchParams.get("fileId") ?? "";
  if (!ObjectId.isValid(fileId)) return fail("Unknown file.", 400);

  const g = await gate(regId);
  if (g.err) return g.err;
  const { user, db, reg } = g;
  const documentTypes = await getRegistrationDocumentTypes();

  const existing: StoredDoc[] = reg.documents ?? [];
  const target = existing.find((d) => d.fileId.toString() === fileId);
  if (!target) return fail("This document is no longer on the request.", 404);

  try {
    const documents = existing.filter((d) => d.fileId.toString() !== fileId);
    const res = await db.collection("registrations").updateOne(
      { _id: reg._id, status: { $in: OPEN } },
      { $set: { documents, documentsCount: documents.length }, $push: { history: historyEntry(user.name, "document_removed", `Removed ${docLabel(target.docType, documentTypes)}: ${target.name}`) } } as never,
    );
    if (!res.modifiedCount) return fail("This request has just been decided, so nothing was changed.", 409);
    await (await filesCollection()).deleteOne({ _id: new ObjectId(fileId), registrationId: reg._id });
    await writeAudit({ userId: new ObjectId(user.id), userName: user.name, headOfficeId: null, officeId: null, action: "registration.document", summary: `Removed ${docLabel(target.docType, documentTypes)} from ${reg.officeName}`, entity: "registration", entityId: regId });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("admin document remove failed", err);
    return fail("Couldn't remove the document. Please try again.", 500);
  }
}
