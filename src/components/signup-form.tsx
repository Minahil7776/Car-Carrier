"use client";

import Link from "next/link";
import { startTransition, useActionState, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, ArrowLeft, ArrowRight, CheckCircle2, Eye, EyeOff, Loader2 } from "lucide-react";
import { signup, type SignupState } from "@/app/signup/actions";
import { DESIGNATIONS, MIN_DOCUMENTS, DOCUMENT_TYPES } from "@/lib/signup-config";
import { accountSchema, companySchema, fieldErrors } from "@/lib/signup-schema";
import { cn } from "@/lib/utils";
import { Field, SelectBox, inputProps } from "@/components/ui/form-field";
import { CompanyFields } from "./company-fields";
import { DocumentsStep, useDocumentUploads } from "./signup-documents";

const STEPS = ["Company", "Your account", "Documents"] as const;
const COMPANY_FIELDS = Object.keys(companySchema.shape);
const ACCOUNT_FIELDS = Object.keys(accountSchema.shape);

function strength(p: string) {
  let s = 0;
  if (p.length >= 8) s++;
  if (p.length >= 12) s++;
  if (/[A-Z]/.test(p) && /[a-z]/.test(p)) s++;
  if (/\d/.test(p) && /[^A-Za-z0-9]/.test(p)) s++;
  return Math.min(s, 4);
}

export function SignupForm({ uploadToken }: { uploadToken: string }) {
  const [state, action, pending] = useActionState<SignupState, FormData>(signup, {});
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [show, setShow] = useState(false);
  const [pw, setPw] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const uploads = useDocumentUploads({
    url: "/api/signup/documents",
    token: uploadToken,
    deleteUrl: (id) => `/api/signup/documents?id=${id}&token=${encodeURIComponent(uploadToken)}`,
  });
  const score = useMemo(() => strength(pw), [pw]);

  // Server-side errors land beside the right field and take the user back to the right step.
  useEffect(() => {
    if (state.fieldErrors) showErrors(state.fieldErrors);
  }, [state]); // eslint-disable-line react-hooks/exhaustive-deps

  // The documents banner is stale as soon as the user changes anything in the list.
  useEffect(() => { setErrors(({ documents: _drop, ...rest }) => rest); }, [uploads.docs]); // eslint-disable-line @typescript-eslint/no-unused-vars

  const stepOf = (k: string): 1 | 2 | 3 => (COMPANY_FIELDS.includes(k) ? 1 : ACCOUNT_FIELDS.includes(k) ? 2 : 3);

  function showErrors(errs: Record<string, string>) {
    setErrors(errs);
    const first = Object.keys(errs)[0];
    if (!first) return;
    setStep(stepOf(first));
    setTimeout(() => (formRef.current?.elements.namedItem(first) as HTMLElement | null)?.focus?.(), 0);
  }

  // Disabled inputs (City before a province is chosen) are absent from FormData, so default them to "".
  const values = () => {
    const o = Object.fromEntries(new FormData(formRef.current!)) as Record<string, string>;
    for (const k of [...COMPANY_FIELDS, ...ACCOUNT_FIELDS]) o[k] ??= "";
    return o;
  };

  function validateStep(n: 1 | 2): boolean {
    const r = (n === 1 ? companySchema : accountSchema).safeParse(values());
    if (r.success) return true;
    showErrors(fieldErrors(r.error.issues));
    return false;
  }

  const next = () => { if (step === 1 && validateStep(1)) { setErrors({}); setStep(2); } else if (step === 2 && validateStep(2)) { setErrors({}); setStep(3); } };

  function submit() {
    if (!validateStep(1) || !validateStep(2)) return;
    if (uploads.uploading) return showErrors({ documents: "Please wait for your uploads to finish." });
    if (uploads.failed) return showErrors({ documents: "A document failed to upload. Retry it or remove it, then submit." });
    const missing = DOCUMENT_TYPES.filter((t) => t.required && !uploads.docs[t.key]);
    if (missing.length) return showErrors({ documents: `Please upload: ${missing.map((t) => t.label).join(", ")}.` });
    if (uploads.doneCount < MIN_DOCUMENTS) return showErrors({ documents: `Upload at least ${MIN_DOCUMENTS} document to continue.` });

    setErrors({});
    const fd = new FormData(formRef.current!);
    fd.set("token", uploadToken);
    fd.set("fileIds", JSON.stringify(uploads.submitted()));
    startTransition(() => action(fd)); // no automatic form reset, so nothing the user typed is ever lost
  }

  const onSubmit = (e: React.FormEvent) => { e.preventDefault(); if (pending) return; step < 3 ? next() : submit(); };
  const clearError = (e: React.FormEvent) => {
    const n = (e.target as HTMLInputElement).name;
    if (n && errors[n]) setErrors(({ [n]: _drop, ...rest }) => rest); // eslint-disable-line @typescript-eslint/no-unused-vars
  };

  if (state.ok) {
    return (
      <div className="animate-rise text-center">
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-ok-soft text-ok"><CheckCircle2 className="size-7" aria-hidden /></span>
        <h2 className="mt-5 text-2xl font-semibold tracking-tight">Request received</h2>
        <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
          We&apos;ll review your details and documents. You can sign in with <span className="font-medium text-ink">{state.submittedEmail}</span> once the request is approved.
        </p>
        <Link href="/login" className="btn-primary mt-8 inline-flex px-6">Back to sign in</Link>
      </div>
    );
  }

  const p = (k: string) => inputProps(errors, k);
  const select = (k: string, options: readonly string[], placeholder?: string) => <SelectBox name={k} errors={errors} options={options} placeholder={placeholder} />;

  return (
    <form ref={formRef} onSubmit={onSubmit} onInput={clearError} noValidate className="space-y-5">
      <ol className="mb-2 flex items-center gap-2 text-sm" aria-label="Progress">
        {STEPS.map((t, i) => {
          const n = i + 1, done = step > n, on = step === n;
          return (
            <li key={t} className="flex flex-1 items-center gap-2 last:flex-none" aria-current={on ? "step" : undefined}>
              <span className={cn("grid size-6 shrink-0 place-items-center rounded-full text-xs font-semibold", done || on ? "bg-brand text-white dark:text-canvas" : "bg-line text-muted")}>{done ? "✓" : n}</span>
              <span className={cn("hidden font-medium sm:inline", on ? "text-ink" : "text-muted")}>{t}</span>
              {i < STEPS.length - 1 && <span className={cn("h-px flex-1", step > n ? "bg-brand" : "bg-line")} aria-hidden />}
            </li>
          );
        })}
      </ol>

      {state.error && (
        <div role="alert" className="flex items-start gap-2.5 rounded-control border border-bad/30 bg-bad-soft px-3.5 py-3 text-sm text-bad">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden /><p>{state.error}</p>
        </div>
      )}

      {/* Every step stays mounted, so values and uploads survive moving back and forth. */}
      <div className={cn("space-y-4", step !== 1 && "hidden")}>
        <CompanyFields errors={errors} />
        <button type="button" onClick={next} className="btn-primary h-11 w-full text-[15px]">Continue <ArrowRight className="size-4" aria-hidden /></button>
      </div>

      <div className={cn("space-y-4", step !== 2 && "hidden")}>
        <Field id="contactName" label="Full name" error={errors.contactName}><input {...p("contactName")} autoComplete="name" placeholder="Sana Malik" /></Field>
        <Field id="designation" label="Designation" error={errors.designation}>{select("designation", DESIGNATIONS, "Select your designation")}</Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="email" label="Work email" error={errors.email}><input {...p("email")} type="email" autoComplete="username" placeholder="name@company.com" /></Field>
          <Field id="phone" label="Mobile number" error={errors.phone}><input {...p("phone")} type="tel" autoComplete="tel" placeholder="0300 1234567" /></Field>
        </div>
        <Field id="password" label="Password" error={errors.password}>
          <div className="relative">
            <input {...p("password")} type={show ? "text" : "password"} autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="At least 8 characters" className={cn(p("password").className, "pr-11")} />
            <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide password" : "Show password"} aria-pressed={show} className="absolute right-1.5 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-md text-faint hover:bg-raised hover:text-ink">
              {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          <div className="flex items-center gap-1.5 pt-1" aria-hidden>
            {[1, 2, 3, 4].map((i) => <span key={i} className={cn("h-1 flex-1 rounded-full transition-colors", score < i ? "bg-line" : score <= 1 ? "bg-bad" : score === 2 ? "bg-beacon" : "bg-ok")} />)}
          </div>
          <p className="text-xs text-muted">{pw ? ["Too weak", "Weak", "Fair", "Good", "Strong"][score] : "Use letters and numbers. A longer phrase is stronger."}</p>
        </Field>
        <Field id="confirm" label="Confirm password" error={errors.confirm}>
          <input {...p("confirm")} type={show ? "text" : "password"} autoComplete="new-password" placeholder="Re-enter your password" />
        </Field>
        <div className="flex gap-3 pt-1">
          <button type="button" onClick={() => setStep(1)} className="btn-outline h-11 px-4" aria-label="Back to company details"><ArrowLeft className="size-4" aria-hidden /></button>
          <button type="button" onClick={next} className="btn-primary h-11 flex-1 text-[15px]">Continue <ArrowRight className="size-4" aria-hidden /></button>
        </div>
      </div>

      <div className={cn("space-y-4", step !== 3 && "hidden")}>
        <DocumentsStep uploads={uploads} error={errors.documents} />

        {/* Honeypot */}
        <input name="website" tabIndex={-1} autoComplete="off" aria-hidden className="absolute -left-[9999px] size-0 opacity-0" />

        <div className="flex gap-3 pt-1">
          <button type="button" onClick={() => setStep(2)} className="btn-outline h-11 px-4" aria-label="Back to account details"><ArrowLeft className="size-4" aria-hidden /></button>
          <button type="submit" disabled={pending || uploads.uploading} className="btn-primary h-11 flex-1 text-[15px]">
            {pending ? (<><Loader2 className="size-4 animate-spin" aria-hidden /> Sending request</>) : uploads.uploading ? "Uploading documents" : "Submit registration"}
          </button>
        </div>
      </div>
    </form>
  );
}
