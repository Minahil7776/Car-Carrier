"use client";

import { useActionState, useEffect, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { saveDocumentTypes, type DocumentTypesState } from "@/app/(app)/dashboard/registrations/document-types/actions";
import type { DocumentType } from "@/lib/signup-config";
import { useToast } from "@/components/ui/toast";

export function DocumentTypeSettings({ initialTypes }: { initialTypes: DocumentType[] }) {
  const [types, setTypes] = useState(initialTypes);
  const [state, action, pending] = useActionState<DocumentTypesState, FormData>(saveDocumentTypes, {});
  const toast = useToast();

  useEffect(() => {
    if (state.error) toast(state.error, "error");
    else if (state.ok) toast("Registration document types saved.");
  }, [state]); // eslint-disable-line react-hooks/exhaustive-deps

  const update = (index: number, patch: Partial<DocumentType>) =>
    setTypes((current) => current.map((type, i) => i === index ? { ...type, ...patch } : type));
  const add = () => {
    let n = types.length + 1;
    let key = `custom_document_${n}`;
    while (types.some((type) => type.key === key)) key = `custom_document_${++n}`;
    setTypes((current) => [...current, { key, label: "", hint: "", required: false }]);
  };

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="documentTypes" value={JSON.stringify(types)} />
      <div className="space-y-3">
        {types.map((type, index) => (
          <section key={index} className="card grid gap-3 p-4 sm:grid-cols-[1fr_1fr_1.2fr_auto] sm:items-end">
            <label className="space-y-1.5 text-sm font-medium">
              <span>Document label</span>
              <input value={type.label} onChange={(e) => update(index, { label: e.target.value })} maxLength={80} required className="input h-10" />
            </label>
            <label className="space-y-1.5 text-sm font-medium">
              <span>Key</span>
              <input value={type.key} onChange={(e) => update(index, { key: e.target.value.toLowerCase() })} maxLength={40} required pattern="[a-z0-9][a-z0-9_-]{1,39}" className="input h-10 font-mono text-xs" />
            </label>
            <label className="space-y-1.5 text-sm font-medium">
              <span>Applicant hint (optional)</span>
              <input value={type.hint ?? ""} onChange={(e) => update(index, { hint: e.target.value })} maxLength={160} className="input h-10" />
            </label>
            <div className="flex items-center justify-between gap-4 sm:justify-end">
              <label className="flex items-center gap-2 whitespace-nowrap text-sm">
                <input type="checkbox" checked={type.required} onChange={(e) => update(index, { required: e.target.checked })} />
                Required
              </label>
              <button type="button" aria-label={`Remove ${type.label || "document type"}`} onClick={() => setTypes((current) => current.filter((_, i) => i !== index))} className="btn-ghost size-10 px-0 text-bad">
                <Trash2 className="size-4" aria-hidden />
              </button>
            </div>
          </section>
        ))}
      </div>

      <div className="flex flex-wrap justify-between gap-3">
        <button type="button" onClick={add} disabled={types.length >= 30} className="btn-outline h-10"><Plus className="size-4" aria-hidden /> Add document type</button>
        <button type="submit" disabled={pending} className="btn-primary h-10 px-5">
          {pending ? <><Loader2 className="size-4 animate-spin" aria-hidden /> Saving</> : "Save document types"}
        </button>
      </div>
    </form>
  );
}
