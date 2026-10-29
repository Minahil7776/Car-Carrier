"use client";

import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { createBranch, updateBranch, type BranchFormState } from "@/app/(app)/dashboard/branches/actions";
import { BRANCH_EDIT_FIELDS, BRANCH_FIELDS, branchEditSchema, branchSchema, suggestBranchCode } from "@/lib/office-schema";
import { GEO, PROVINCES } from "@/lib/pakistan-geo";
import { fieldErrors } from "@/lib/signup-schema";
import { Field, SelectBox, inputProps } from "@/components/ui/form-field";
import { useToast } from "@/components/ui/toast";

type Defaults = Record<string, string | null | undefined>;

/** FR-BR-001. The head office is always taken from the signed-in head-office user. */
export function BranchForm({ mode, id, code, defaults = {}, cancelHref }: {
  mode: "create" | "edit"; id?: string; code?: string; defaults?: Defaults; cancelHref: string;
}) {
  const create = mode === "create";
  const [state, action, pending] = useActionState<BranchFormState, FormData>(create ? createBranch : updateBranch, {});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const formRef = useRef<HTMLFormElement>(null);
  const toast = useToast();

  const startProvince = defaults.province && GEO[defaults.province] ? defaults.province : "";
  const [province, setProvince] = useState(startProvince);
  const [city, setCity] = useState(startProvince && GEO[startProvince].includes(defaults.city ?? "") ? (defaults.city as string) : "");
  const [branchCode, setBranchCode] = useState(defaults.branchCode ?? "");
  const [codeTouched, setCodeTouched] = useState(false);
  const today = new Date().toISOString().slice(0, 10);

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
    const keys = create ? BRANCH_FIELDS : BRANCH_EDIT_FIELDS;
    const values = Object.fromEntries(keys.map((k) => [k, String(fd.get(k) ?? "")]));
    const r = (create ? branchSchema : branchEditSchema).safeParse(values);
    const errs = r.success ? {} : fieldErrors(r.error.issues);
    if (Object.keys(errs).length) return focusFirst(errs);
    setErrors({});
    if (id) fd.set("id", id);
    startTransition(() => action(fd));
  }

  const clearError = (e: React.FormEvent) => {
    const n = (e.target as HTMLInputElement).name;
    if (n && errors[n]) setErrors(({ [n]: _drop, ...rest }) => rest); // eslint-disable-line @typescript-eslint/no-unused-vars
  };
  const p = (k: string) => inputProps(errors, k);
  const d = (k: string) => defaults[k] ?? undefined;

  return (
    <form ref={formRef} onSubmit={onSubmit} onInput={clearError} noValidate className="space-y-5">
      <section className="card space-y-5 p-5 sm:p-6">
        <div>
          <h2 className="text-[15px] font-semibold">Branch</h2>
          <p className="mt-0.5 text-sm text-muted">{create ? "The branch is active as soon as you save. The system administrator is notified." : "Update the branch details. The identifier does not change."}</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="branchName" label="Branch name" error={errors.branchName}><input {...p("branchName")} defaultValue={d("branchName")} placeholder="Lahore Branch" /></Field>
          {create ? (
            <Field id="branchCode" label="Branch code" hint={`The identifier becomes BR-${branchCode || "LHR"}-001.`} error={errors.branchCode}>
              <input {...p("branchCode")} value={branchCode} maxLength={6} onChange={(e) => { setCodeTouched(true); setBranchCode(e.target.value.toUpperCase()); }} className={`${p("branchCode").className} font-mono uppercase`} placeholder="LHR" autoComplete="off" />
            </Field>
          ) : (
            <Field id="code" label="Branch identifier"><input id="code" value={code} readOnly className="input cursor-not-allowed bg-raised font-mono text-muted" /></Field>
          )}
        </div>

        <Field id="address" label="Address" error={errors.address}><input {...p("address")} defaultValue={d("address")} autoComplete="street-address" placeholder="Street, area" /></Field>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field id="country" label="Country"><input {...p("country")} value="Pakistan" readOnly className="input cursor-not-allowed bg-raised text-muted" /></Field>
          <Field id="province" label="Province" error={errors.province}>
            <SelectBox name="province" errors={errors} options={PROVINCES} placeholder="Select" value={province} onChange={(e) => { setProvince(e.target.value); setCity(""); }} />
          </Field>
          <Field id="city" label="City" error={errors.city}>
            <SelectBox name="city" errors={errors} options={GEO[province] ?? []} placeholder="Select" value={city} disabled={!province}
              onChange={(e) => { setCity(e.target.value); if (create && !codeTouched) setBranchCode(suggestBranchCode(e.target.value)); }} />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="contactPhone" label="Contact number" error={errors.contactPhone}><input {...p("contactPhone")} defaultValue={d("contactPhone")} type="tel" placeholder="042 35123456" /></Field>
          <Field id="email" label="Branch email" error={errors.email}><input {...p("email")} defaultValue={d("email")} type="email" placeholder="lahore@company.com" /></Field>
        </div>
      </section>

      <section className="card space-y-5 p-5 sm:p-6">
        <h2 className="text-[15px] font-semibold">Management</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="managerName" label="Branch manager" error={errors.managerName}><input {...p("managerName")} defaultValue={d("managerName")} autoComplete="off" /></Field>
          <Field id="openingDate" label="Opening date" error={errors.openingDate}><input {...p("openingDate")} defaultValue={d("openingDate") ?? today} type="date" /></Field>
          <Field id="managerEmail" label="Manager email" optional error={errors.managerEmail}><input {...p("managerEmail")} defaultValue={d("managerEmail")} type="email" autoComplete="off" /></Field>
          <Field id="managerPhone" label="Manager mobile" optional error={errors.managerPhone}><input {...p("managerPhone")} defaultValue={d("managerPhone")} type="tel" autoComplete="off" /></Field>
        </div>
        <Field id="notes" label="Other information" optional error={errors.notes}>
          <textarea {...p("notes")} defaultValue={d("notes")} rows={3} maxLength={500} className={`${p("notes").className} h-auto resize-none py-2.5`} />
        </Field>
      </section>

      <div className="flex flex-wrap items-center justify-end gap-3">
        <Link href={cancelHref} className="btn-ghost h-11">Cancel</Link>
        <button type="submit" disabled={pending} className="btn-primary h-11 px-6 text-[15px]">
          {pending ? <><Loader2 className="size-4 animate-spin" aria-hidden /> Saving</> : create ? "Create branch" : "Save changes"}
        </button>
      </div>
    </form>
  );
}
