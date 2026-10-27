import "server-only";
import { DOCUMENT_TYPES, UPLOAD_LIMITS } from "./signup-config";
import { sniffMime } from "./signup-draft";

const MB = UPLOAD_LIMITS.maxFileBytes / 1024 / 1024;

export type UploadResult =
  | { ok: true; docType: string; buf: Buffer; mime: string; name: string }
  | { ok: false; error: string; status: number };

/** Cheap check before the body is read: reject oversized requests outright. */
export function declaredTooLarge(req: Request) {
  return Number(req.headers.get("content-length") ?? 0) > UPLOAD_LIMITS.maxFileBytes + 64 * 1024;
}
export const tooLargeMessage = `This file is too large. The limit is ${MB} MB.`;

/** Shared by the public signup upload and the administrator's upload, so both enforce the same rules. */
export async function readUpload(form: FormData): Promise<UploadResult> {
  const docType = String(form.get("docType") ?? "");
  if (!DOCUMENT_TYPES.some((d) => d.key === docType)) return { ok: false, error: "Unknown document type.", status: 400 };

  const file = form.get("file");
  if (!(file instanceof File)) return { ok: false, error: "Choose a file to upload.", status: 400 };
  if (file.size === 0) return { ok: false, error: "This file is empty.", status: 400 };
  if (file.size > UPLOAD_LIMITS.maxFileBytes) return { ok: false, error: tooLargeMessage, status: 413 };

  const buf = Buffer.from(await file.arrayBuffer());
  const mime = sniffMime(buf); // judged by the file's real bytes, not its name or the browser's claim
  if (!mime) return { ok: false, error: `Only ${UPLOAD_LIMITS.label} files are accepted.`, status: 415 };

  const name = file.name.replace(/[\\/\u0000-\u001f]/g, "").slice(-120) || "document";
  return { ok: true, docType, buf, mime, name };
}
