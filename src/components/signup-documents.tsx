"use client";

import { useCallback, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, Eye, FileText, Loader2, RefreshCw, Replace, Trash2, Upload } from "lucide-react";
import { DOCUMENT_TYPES, MIN_DOCUMENTS, UPLOAD_LIMITS } from "@/lib/signup-config";
import { cn } from "@/lib/utils";

export interface DocEntry {
  status: "uploading" | "done" | "error" | "removing";
  name: string;
  size: number;
  file?: File; // kept so a failed upload can be retried without picking the file again
  progress: number;
  id?: string;
  error?: string;
}

/** Where documents go. The applicant uploads drafts with a token; the administrator edits a saved registration. */
export interface UploadTarget {
  url: string;
  token?: string;
  deleteUrl: (id: string) => string;
  viewUrl?: (id: string) => string; // for files already on the server
  awaitRemove?: boolean; // wait for the server before the row disappears
  initial?: Record<string, { id: string; name: string; size: number }>;
  onChanged?: () => void;
}

const MB = UPLOAD_LIMITS.maxFileBytes / 1024 / 1024;
export const fmtSize = (b: number) => (b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`);

function checkFile(f: File) {
  if (f.size === 0) return "This file is empty.";
  if (f.size > UPLOAD_LIMITS.maxFileBytes) return `This file is ${fmtSize(f.size)}. The limit is ${MB} MB.`;
  if (!/\.(pdf|jpe?g|png)$/i.test(f.name) && !["application/pdf", "image/jpeg", "image/png"].includes(f.type)) return `Only ${UPLOAD_LIMITS.label} files are accepted.`;
  return null;
}

/** Upload state lives in the form so moving between steps never re-uploads anything. */
export function useDocumentUploads(target: UploadTarget) {
  const t = useRef(target);
  t.current = target;
  const [docs, setDocs] = useState<Record<string, DocEntry>>(() =>
    Object.fromEntries(Object.entries(target.initial ?? {}).map(([k, v]) => [k, { status: "done" as const, name: v.name, size: v.size, id: v.id, progress: 100 }])),
  );
  const docsRef = useRef(docs);
  docsRef.current = docs;
  const xhrs = useRef<Record<string, XMLHttpRequest>>({});
  const gen = useRef<Record<string, number>>({}); // ignores late callbacks from a replaced or removed upload

  const patch = (key: string, p: Partial<DocEntry>) => setDocs((d) => (d[key] ? { ...d, [key]: { ...d[key], ...p } } : d));
  const drop = (key: string) => setDocs((d) => { const n = { ...d }; delete n[key]; return n; });

  const upload = useCallback((key: string, file: File) => {
    const problem = checkFile(file);
    xhrs.current[key]?.abort();
    const mine = (gen.current[key] = (gen.current[key] ?? 0) + 1);
    const base = { name: file.name, size: file.size, file, progress: 0 };
    if (problem) { setDocs((d) => ({ ...d, [key]: { ...base, status: "error", error: problem } })); return; }

    setDocs((d) => ({ ...d, [key]: { ...base, status: "uploading" } }));
    const fd = new FormData();
    if (t.current.token) fd.append("token", t.current.token);
    fd.append("docType", key); fd.append("file", file);

    const xhr = new XMLHttpRequest();
    xhrs.current[key] = xhr;
    xhr.open("POST", t.current.url);
    xhr.timeout = 90_000;
    const live = () => gen.current[key] === mine;
    xhr.upload.onprogress = (e) => { if (live() && e.lengthComputable) patch(key, { progress: Math.round((e.loaded / e.total) * 100) }); };
    xhr.onload = () => {
      if (!live()) return;
      let body: { file?: { id: string }; error?: string } = {};
      try { body = JSON.parse(xhr.responseText); } catch { /* non-JSON error page */ }
      if (xhr.status >= 200 && xhr.status < 300 && body.file) { patch(key, { status: "done", progress: 100, id: body.file.id, error: undefined }); t.current.onChanged?.(); }
      else patch(key, { status: "error", error: body.error ?? "Upload failed. Please try again." });
    };
    xhr.onerror = () => live() && patch(key, { status: "error", error: "Network problem. Check your connection and retry." });
    xhr.ontimeout = () => live() && patch(key, { status: "error", error: "The upload took too long. Check your connection and retry." });
    xhr.send(fd);
  }, []);

  const retry = (key: string) => { const e = docsRef.current[key]; if (e?.file) upload(key, e.file); };

  const remove = async (key: string) => {
    const e = docsRef.current[key];
    const tg = t.current;
    gen.current[key] = (gen.current[key] ?? 0) + 1;
    xhrs.current[key]?.abort();

    if (e?.id && tg.awaitRemove) {
      patch(key, { status: "removing", error: undefined });
      try {
        const res = await fetch(tg.deleteUrl(e.id), { method: "DELETE" });
        if (!res.ok) throw new Error();
      } catch {
        patch(key, { status: "done", error: "Couldn't remove this document. Please try again." });
        return;
      }
      drop(key);
      tg.onChanged?.();
      return;
    }
    drop(key);
    // Best effort for drafts: anything left behind is deleted by the server after 24 hours and is never submitted.
    if (e?.id) fetch(tg.deleteUrl(e.id), { method: "DELETE" }).catch(() => {});
  };

  const list = Object.values(docs);
  return {
    docs, upload, retry, remove,
    viewUrl: (id: string) => t.current.viewUrl?.(id),
    uploading: list.some((d) => d.status === "uploading" || d.status === "removing"),
    failed: list.some((d) => d.status === "error"),
    doneCount: list.filter((d) => d.status === "done").length,
    submitted: () => Object.entries(docs).filter(([, d]) => d.status === "done" && d.id).map(([docType, d]) => ({ docType, id: d.id! })),
  };
}

type Uploads = ReturnType<typeof useDocumentUploads>;

export function DocumentsStep({ uploads, error, intro = true }: { uploads: Uploads; error?: string; intro?: boolean }) {
  const required = DOCUMENT_TYPES.filter((d) => d.required).length;
  return (
    <div className="space-y-4">
      {intro && (
        <div>
          <p className="text-sm text-muted">
            {UPLOAD_LIMITS.label}, up to {MB} MB each.{" "}
            {required ? `Documents marked Required must be uploaded. ` : ""}
            {MIN_DOCUMENTS > 0 && `Add at least ${MIN_DOCUMENTS}.`}
          </p>
          <p className="mt-1 text-xs text-faint">{uploads.doneCount} uploaded</p>
        </div>
      )}

      {error && <p id="documents-err" role="alert" className="rounded-control bg-bad-soft px-3 py-2 text-sm text-bad">{error}</p>}

      <ul className="divide-y divide-line rounded-control border border-line">
        {DOCUMENT_TYPES.map((t) => <Row key={t.key} type={t} entry={uploads.docs[t.key]} uploads={uploads} />)}
      </ul>
    </div>
  );
}

function Row({ type, entry, uploads }: { type: (typeof DOCUMENT_TYPES)[number]; entry?: DocEntry; uploads: Uploads }) {
  const input = useRef<HTMLInputElement>(null);
  const pick = () => input.current?.click();
  const busy = entry?.status === "uploading" || entry?.status === "removing";
  // A file rejected locally (wrong type or too large) can't succeed on retry; the user must pick another file.
  const canRetry = entry?.status === "error" && entry.file && checkFile(entry.file) === null;
  const serverUrl = entry?.id ? uploads.viewUrl(entry.id) : undefined;
  const view = () => {
    if (entry?.file) window.open(URL.createObjectURL(entry.file), "_blank", "noopener");
    else if (serverUrl) window.open(serverUrl, "_blank", "noopener");
  };

  return (
    <li className="p-3.5">
      <input ref={input} type="file" accept={UPLOAD_LIMITS.accept} className="sr-only" tabIndex={-1} aria-label={`Choose file for ${type.label}`}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) uploads.upload(type.key, f); e.target.value = ""; }} />

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
            {type.label}
            {type.required && <span className="rounded bg-beacon-soft px-1.5 py-0.5 text-[11px] font-medium text-warn">Required</span>}
          </p>
          {type.hint && !entry && <p className="text-xs text-muted">{type.hint}</p>}
        </div>
        {!entry && <button type="button" onClick={pick} className="btn-outline h-8 shrink-0 px-3 text-xs"><Upload className="size-3.5" aria-hidden /> Choose file</button>}
      </div>

      {entry && (
        <div className="mt-2.5 rounded-control bg-raised p-2.5">
          <div className="flex items-center gap-2.5">
            <FileText className="size-4 shrink-0 text-faint" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm">{entry.name}</p>
              <p className="text-xs text-muted">{entry.status === "removing" ? "Removing" : fmtSize(entry.size)}</p>
            </div>
            {busy && <Loader2 className="size-4 animate-spin text-brand" aria-label={entry.status === "removing" ? "Removing" : "Uploading"} />}
            {entry.status === "done" && <CheckCircle2 className="size-4 text-ok" aria-label="Uploaded" />}
            {entry.status === "error" && <AlertCircle className="size-4 text-bad" aria-label="Failed" />}
          </div>

          {entry.status === "uploading" && (
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuenow={entry.progress} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-full bg-brand transition-[width]" style={{ width: `${entry.progress}%` }} />
            </div>
          )}
          {entry.error && <p role="alert" className="mt-1.5 text-xs text-bad">{entry.error}</p>}

          <div className={cn("mt-2 flex flex-wrap gap-1", busy && "pointer-events-none opacity-60")}>
            {canRetry && <Action onClick={() => uploads.retry(type.key)} icon={RefreshCw}>Retry</Action>}
            {(entry.file || serverUrl) && <Action onClick={view} icon={Eye}>View</Action>}
            <Action onClick={pick} icon={Replace}>Replace</Action>
            <Action onClick={() => uploads.remove(type.key)} icon={Trash2} danger>Remove</Action>
          </div>
        </div>
      )}
    </li>
  );
}

function Action({ children, onClick, icon: Icon, danger }: { children: React.ReactNode; onClick: () => void; icon: React.ElementType; danger?: boolean }) {
  return (
    <button type="button" onClick={onClick} className={cn("inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-xs font-medium hover:bg-line/60", danger ? "text-bad" : "text-muted hover:text-ink")}>
      <Icon className="size-3.5" aria-hidden /> {children}
    </button>
  );
}
