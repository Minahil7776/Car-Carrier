"use client";

import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { updateOrganization, type OrgFormState } from "@/app/(app)/dashboard/organizations/actions";
import { companySchema, fieldErrors } from "@/lib/signup-schema";
import { inputProps } from "@/components/ui/form-field";
import { useToast } from "@/components/ui/toast";
import { CompanyFields } from "@/components/company-fields";

const COMPANY_KEYS = Object.keys(companySchema.shape);

/** Edit the registered head-office details using the server-side company schema. */
export function OrganizationForm({ id, defaults = {}, cancelHref }: { id: string; defaults?: Record<string, string | null | undefined>; cancelHref: string }) {
  const [state, action, pending] = useActionState<OrgFormState, FormData>(updateOrganization, {});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const formRef = useRef<HTMLFormElement>(null);
  const toast = useToast();

  useEffect(() => {
    if (state.fieldErrors) focusFirst(state.fieldErrors);
    else if (state.error) toast(state.error, "error");
    else if (state.ok && state.message) toast(state.message);
  }, [state]); // eslint-disable-line react-hooks/exhaustive-deps

  function focusFirst(errs: Record<string, string>) {
    setErrors(errs);
    const first = Object.keys(errs)[0];
    setTimeout(() => (formRef.current?.elements.namedItem(first) as HTMLElement | null)?.focus?.(), 0);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    const fd = new FormData(formRef.current!);
    const r = companySchema.safeParse(Object.fromEntries(COMPANY_KEYS.map((k) => [k, String(fd.get(k) ?? "")])));
    if (!r.success) return focusFirst(fieldErrors(r.error.issues));
    setErrors({});
    if (id) fd.set("id", id);
    startTransition(() => action(fd));
  }

  const clearError = (e: React.FormEvent) => {
    const n = (e.target as HTMLInputElement).name;
    if (n && errors[n]) setErrors(({ [n]: _drop, ...rest }) => rest); // eslint-disable-line @typescript-eslint/no-unused-vars
  };
  const p = (k: string) => inputProps(errors, k);

  return (
    <form ref={formRef} onSubmit={onSubmit} onInput={clearError} noValidate className="space-y-5">
      <section className="card space-y-5 p-5 sm:p-6">
        <div>
          <h2 className="text-[15px] font-semibold">Company</h2>
          <p className="mt-0.5 text-sm text-muted">Details of the head office as registered.</p>
        </div>
        <CompanyFields errors={errors} defaults={defaults} />
      </section>

      <div className="flex flex-wrap items-center justify-end gap-3">
        <Link href={cancelHref} className="btn-ghost h-11">Cancel</Link>
        <button type="submit" disabled={pending} className="btn-primary h-11 px-6 text-[15px]">
          {pending ? <><Loader2 className="size-4 animate-spin" aria-hidden /> Saving</> : "Save changes"}
        </button>
      </div>
    </form>
  );
}
