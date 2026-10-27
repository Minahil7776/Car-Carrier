"use client";

import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { Loader2, Pencil } from "lucide-react";
import { updateRegistration, type EditState } from "@/app/(app)/dashboard/registrations/actions";
import type { RegDetail } from "@/lib/registration-data";
import { DESIGNATIONS } from "@/lib/signup-config";
import { adminEditSchema, fieldErrors } from "@/lib/signup-schema";
import { Field, SelectBox, inputProps } from "@/components/ui/form-field";
import { useToast } from "@/components/ui/toast";
import { CompanyFields } from "@/components/company-fields";
import { Section } from "./section";
import { useEditGuard } from "./edit-guard";

function Item({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className={`mt-0.5 break-words text-sm font-medium ${mono ? "font-mono" : ""}`}>{value || <span className="font-normal text-faint">Not provided</span>}</dd>
    </div>
  );
}

/** Company and applicant details. The administrator can edit them while the request is still open. */
export function RegistrationDetails({ data, editable }: { data: RegDetail; editable: boolean }) {
  const { editing, setEditing } = useEditGuard();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [state, action, pending] = useActionState<EditState, FormData>(updateRegistration, {});
  const formRef = useRef<HTMLFormElement>(null);
  const toast = useToast();

  useEffect(() => {
    if (state.ok) { toast(state.message ?? "Saved."); setEditing(false); setErrors({}); }
    else if (state.error) toast(state.error, "error");
    else if (state.fieldErrors) focusFirst(state.fieldErrors);
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
    const values = Object.fromEntries(Object.keys(adminEditSchema.shape).map((k) => [k, String(fd.get(k) ?? "")]));
    const r = adminEditSchema.safeParse(values);
    if (!r.success) return focusFirst(fieldErrors(r.error.issues));
    setErrors({});
    fd.set("id", data.id);
    startTransition(() => action(fd));
  }

  const clearError = (e: React.FormEvent) => {
    const n = (e.target as HTMLInputElement).name;
    if (n && errors[n]) setErrors(({ [n]: _drop, ...rest }) => rest); // eslint-disable-line @typescript-eslint/no-unused-vars
  };

  if (!editing) {
    const edit = editable ? (
      <button type="button" onClick={() => setEditing(true)} className="btn-outline h-8 px-3 text-xs"><Pencil className="size-3.5" aria-hidden /> Edit details</button>
    ) : undefined;
    return (
      <>
        <Section title="Company" description={editable ? "Called the applicant? Update anything that changed." : undefined} action={edit}>
          <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
            <Item label="Company name" value={data.officeName} />
            <Item label="Registered legal name" value={data.legalName} />
            <Item label="Office type" value={data.officeType === "head" ? "Head Office" : data.officeType} />
            <Item label="NTN" value={data.ntn} mono />
            <Item label="Sales tax number" value={data.salesTaxNumber} mono />
            <Item label="Company registration number" value={data.companyRegNumber} mono />
            <Item label="Registered address" value={data.registeredAddress} />
            <Item label="Operational address" value={data.operationalAddress} />
            <Item label="City" value={data.city} />
            <Item label="Province" value={data.province} />
            <Item label="Country" value={data.country} />
            <Item label="Office phone" value={data.officePhone} />
            <Item label="Office email" value={data.officeEmail} />
            <Item label="Website" value={data.officeWebsite} />
          </dl>
        </Section>
        <Section title="Applicant" description="Becomes the administrator when approved">
          <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
            <Item label="Full name" value={data.applicantName} />
            <Item label="Designation" value={data.designation} />
            <Item label="Mobile" value={data.applicantPhone} />
            <Item label="Email" value={data.applicantEmail} />
          </dl>
        </Section>
      </>
    );
  }

  const p = (k: string) => inputProps(errors, k);
  return (
    <form ref={formRef} onSubmit={onSubmit} onInput={clearError} noValidate className="card space-y-6 p-5">
      <div>
        <h2 className="text-[15px] font-semibold">Edit details</h2>
        <p className="mt-0.5 text-sm text-muted">Changes are saved on the request and recorded in its history.</p>
      </div>

      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-muted">Company</h3>
        <CompanyFields errors={errors} defaults={{
          officeName: data.officeName, legalName: data.legalName, officeType: data.officeType, ntn: data.ntn, salesTaxNumber: data.salesTaxNumber,
          companyRegNumber: data.companyRegNumber, registeredAddress: data.registeredAddress, operationalAddress: data.operationalAddress,
          province: data.province, city: data.city, officePhone: data.officePhone, officeEmail: data.officeEmail, officeWebsite: data.officeWebsite,
        }} />
      </div>

      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-muted">Applicant</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="contactName" label="Full name" error={errors.contactName}><input {...p("contactName")} defaultValue={data.applicantName} /></Field>
          <Field id="designation" label="Designation" error={errors.designation}>
            <SelectBox name="designation" errors={errors} options={DESIGNATIONS} placeholder="Select" defaultValue={data.designation ?? ""} />
          </Field>
          <Field id="email" label="Email" error={errors.email}><input {...p("email")} type="email" defaultValue={data.applicantEmail} /></Field>
          <Field id="phone" label="Mobile number" error={errors.phone}><input {...p("phone")} type="tel" defaultValue={data.applicantPhone ?? ""} /></Field>
        </div>
      </div>

      <Field id="note" label="Note about this change" optional hint="For example: confirmed by phone with the owner. Saved in the history.">
        <textarea id="note" name="note" rows={2} maxLength={300} className="input h-auto resize-none py-2.5" />
      </Field>

      <div className="flex justify-end gap-3">
        <button type="button" onClick={() => { setEditing(false); setErrors({}); }} className="btn-outline h-10 px-5">Cancel</button>
        <button type="submit" disabled={pending} className="btn-primary h-10 px-5">
          {pending ? <><Loader2 className="size-4 animate-spin" aria-hidden /> Saving</> : "Save changes"}
        </button>
      </div>
    </form>
  );
}
