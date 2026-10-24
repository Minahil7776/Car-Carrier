"use client";

import Link from "next/link";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, ArrowLeft, ArrowRight, CheckCircle2, Eye, EyeOff, Loader2 } from "lucide-react";
import { signup, type SignupState } from "@/app/signup/actions";
import { cn } from "@/lib/utils";

const STEP1 = ["companyName", "legalName", "ntn", "city"];

function Field({ id, label, hint, error, optional, children }: { id: string; label: string; hint?: string; error?: string; optional?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="flex items-baseline justify-between text-sm font-medium">
        {label}
        {optional && <span className="text-xs font-normal text-faint">Optional</span>}
      </label>
      {children}
      {error ? <p id={`${id}-err`} className="text-xs text-bad">{error}</p> : hint ? <p className="text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

function strength(p: string) {
  let s = 0;
  if (p.length >= 8) s++;
  if (p.length >= 12) s++;
  if (/[A-Z]/.test(p) && /[a-z]/.test(p)) s++;
  if (/\d/.test(p) && /[^A-Za-z0-9]/.test(p)) s++;
  return Math.min(s, 4);
}

export function SignupForm() {
  const [state, action, pending] = useActionState<SignupState, FormData>(signup, {});
  const [step, setStep] = useState<1 | 2>(1);
  const [show, setShow] = useState(false);
  const [pw, setPw] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const v = state.values ?? {};
  const fe = state.fieldErrors ?? {};
  const score = useMemo(() => strength(pw), [pw]);

  // If the server rejected a company field, bring the user back to step 1.
  useEffect(() => { if (STEP1.some((k) => fe[k])) setStep(1); }, [state]); // eslint-disable-line react-hooks/exhaustive-deps

  const next = () => {
    const inputs = STEP1.map((k) => formRef.current?.elements.namedItem(k) as HTMLInputElement | null);
    for (const i of inputs) if (i && !i.reportValidity()) return;
    setStep(2);
  };

  if (state.ok) {
    return (
      <div className="animate-rise text-center">
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-ok-soft text-ok"><CheckCircle2 className="size-7" aria-hidden /></span>
        <h2 className="mt-5 text-2xl font-semibold tracking-tight">Request received</h2>
        <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
          We&apos;ll review your details. You can sign in with <span className="font-medium text-ink">{state.submittedEmail}</span> once the request is approved.
        </p>
        <Link href="/login" className="btn-primary mt-8 inline-flex px-6">Back to sign in</Link>
      </div>
    );
  }

  const inputCls = (k: string) => cn("input", fe[k] && "border-bad focus:border-bad focus:ring-bad/25");

  return (
    <form ref={formRef} action={action} noValidate={false} className="space-y-5">
      <ol className="mb-2 flex items-center gap-3 text-sm" aria-label="Progress">
        {["Company", "Your account"].map((t, i) => {
          const n = i + 1;
          const done = step > n, on = step === n;
          return (
            <li key={t} className="flex flex-1 items-center gap-2.5" aria-current={on ? "step" : undefined}>
              <span className={cn("grid size-6 shrink-0 place-items-center rounded-full text-xs font-semibold", done || on ? "bg-brand text-white dark:text-canvas" : "bg-line text-muted")}>{done ? "✓" : n}</span>
              <span className={cn("font-medium", on ? "text-ink" : "text-muted")}>{t}</span>
              {i === 0 && <span className={cn("h-px flex-1", step > 1 ? "bg-brand" : "bg-line")} aria-hidden />}
            </li>
          );
        })}
      </ol>

      {state.error && (
        <div role="alert" className="flex items-start gap-2.5 rounded-control border border-bad/30 bg-bad-soft px-3.5 py-3 text-sm text-bad">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden /><p>{state.error}</p>
        </div>
      )}

      {/* Both steps stay in the DOM so every value is submitted together. */}
      <div className={cn("space-y-4", step !== 1 && "hidden")}>
        <Field id="companyName" label="Company name" error={fe.companyName}>
          <input id="companyName" name="companyName" required defaultValue={v.companyName} placeholder="ABC Car Carriers" autoComplete="organization" className={inputCls("companyName")} />
        </Field>
        <Field id="legalName" label="Registered legal name" optional error={fe.legalName}>
          <input id="legalName" name="legalName" defaultValue={v.legalName} placeholder="ABC Car Carriers (Pvt) Ltd" className={inputCls("legalName")} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="city" label="Head office city" error={fe.city}>
            <input id="city" name="city" required defaultValue={v.city} placeholder="Lahore" autoComplete="address-level2" className={inputCls("city")} />
          </Field>
          <Field id="ntn" label="NTN" optional hint="Used to verify your company." error={fe.ntn}>
            <input id="ntn" name="ntn" defaultValue={v.ntn} inputMode="numeric" placeholder="1234567-8" className={inputCls("ntn")} />
          </Field>
        </div>
        <button type="button" onClick={next} className="btn-primary h-11 w-full text-[15px]">Continue <ArrowRight className="size-4" aria-hidden /></button>
      </div>

      <div className={cn("space-y-4", step !== 2 && "hidden")}>
        <Field id="contactName" label="Your full name" error={fe.contactName}>
          <input id="contactName" name="contactName" required defaultValue={v.contactName} autoComplete="name" placeholder="Sana Malik" className={inputCls("contactName")} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="email" label="Work email" error={fe.email}>
            <input id="email" name="email" type="email" required defaultValue={v.email} autoComplete="username" placeholder="name@company.com" className={inputCls("email")} />
          </Field>
          <Field id="phone" label="Mobile number" error={fe.phone}>
            <input id="phone" name="phone" type="tel" required defaultValue={v.phone} autoComplete="tel" placeholder="0300 1234567" className={inputCls("phone")} />
          </Field>
        </div>
        <Field id="password" label="Password" error={fe.password}>
          <div className="relative">
            <input id="password" name="password" type={show ? "text" : "password"} required minLength={8} autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="At least 8 characters" className={cn(inputCls("password"), "pr-11")} />
            <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide password" : "Show password"} aria-pressed={show} className="absolute right-1.5 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-md text-faint hover:bg-raised hover:text-ink">
              {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          <div className="flex items-center gap-1.5 pt-1" aria-hidden>
            {[1, 2, 3, 4].map((i) => (
              <span key={i} className={cn("h-1 flex-1 rounded-full transition-colors", score < i ? "bg-line" : score <= 1 ? "bg-bad" : score === 2 ? "bg-beacon" : "bg-ok")} />
            ))}
          </div>
          <p className="text-xs text-muted">{pw ? ["Too weak", "Weak", "Fair", "Good", "Strong"][score] : "Use letters and numbers. A longer phrase is stronger."}</p>
        </Field>
        <Field id="confirm" label="Confirm password" error={fe.confirm}>
          <input id="confirm" name="confirm" type={show ? "text" : "password"} required autoComplete="new-password" placeholder="Re-enter your password" className={inputCls("confirm")} />
        </Field>

        {/* Honeypot */}
        <input name="website" tabIndex={-1} autoComplete="off" aria-hidden className="absolute -left-[9999px] size-0 opacity-0" />

        <div className="flex gap-3 pt-1">
          <button type="button" onClick={() => setStep(1)} className="btn-outline h-11 px-4" aria-label="Back to company details"><ArrowLeft className="size-4" aria-hidden /></button>
          <button type="submit" disabled={pending} className="btn-primary h-11 flex-1 text-[15px]">
            {pending ? (<><Loader2 className="size-4 animate-spin" aria-hidden /> Sending request</>) : "Submit registration"}
          </button>
        </div>
      </div>
    </form>
  );
}
