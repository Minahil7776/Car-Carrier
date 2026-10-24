"use client";

import { useActionState, useEffect, useState } from "react";
import { CheckCircle2, FileQuestion, Loader2, XCircle } from "lucide-react";
import { reviewRegistration, type ReviewState } from "@/app/(app)/dashboard/registrations/actions";
import type { RegistrationStatus } from "@/lib/types";
import { cn, formatDate, registrationMeta } from "@/lib/utils";
import { Pill } from "@/components/ui/pill";
import { useToast } from "@/components/ui/toast";

type Choice = "approve" | "info" | "reject";
const OPEN: RegistrationStatus[] = ["pending", "under_review", "info_required"];

export function ReviewPanel({ id, kind, status, reviewedAt, reviewRemarks }: { id: string; kind: "head" | "branch"; status: RegistrationStatus; reviewedAt: string | null; reviewRemarks: string | null }) {
  const [state, action, pending] = useActionState<ReviewState, FormData>(reviewRegistration, {});
  const [choice, setChoice] = useState<Choice>("approve");
  const toast = useToast();

  useEffect(() => {
    if (state.ok && state.message) toast(state.message);
    else if (state.error) toast(state.error, "error");
  }, [state]); // eslint-disable-line react-hooks/exhaustive-deps

  // Once decided, the same panel turns into a read-only outcome.
  if (!OPEN.includes(status)) {
    const meta = registrationMeta[status];
    return (
      <div className="card p-5">
        <h2 className="text-[15px] font-semibold">Decision</h2>
        <div className="mt-3"><Pill tone={meta.tone}>{meta.label}</Pill></div>
        <p className="mt-3 text-sm text-muted">{reviewedAt ? `Decided on ${formatDate(reviewedAt)}.` : "This request has been decided."}</p>
        {reviewRemarks && <p className="mt-3 rounded-lg bg-raised px-3 py-2 text-sm">{reviewRemarks}</p>}
      </div>
    );
  }

  const options: { v: Choice; label: string; desc: string; icon: React.ElementType; tint: string }[] = [
    { v: "approve", label: "Approve", desc: kind === "head" ? "Creates the company and its administrator." : "Creates the branch under its head office.", icon: CheckCircle2, tint: "text-ok" },
    { v: "info", label: "Request documents", desc: "Keeps it open and notes what is missing.", icon: FileQuestion, tint: "text-warn" },
    { v: "reject", label: "Reject", desc: "Closes the request. They can't sign in.", icon: XCircle, tint: "text-bad" },
  ];
  const needsRemarks = choice !== "approve";
  const submitLabel = choice === "approve" ? "Approve registration" : choice === "info" ? "Request documents" : "Reject registration";

  return (
    <form action={action} className="card space-y-4 p-5">
      <h2 className="text-[15px] font-semibold">Your decision</h2>
      <input type="hidden" name="id" value={id} />

      <fieldset className="space-y-2">
        <legend className="sr-only">Decision</legend>
        {options.map((o) => {
          const Icon = o.icon;
          return (
            <label key={o.v} className="block cursor-pointer">
              <input type="radio" name="decision" value={o.v} checked={choice === o.v} onChange={() => setChoice(o.v)} className="peer sr-only" />
              <span className={cn("flex items-start gap-3 rounded-control border border-line p-3 transition-colors hover:bg-raised peer-checked:border-brand peer-checked:bg-brand-soft/50 peer-focus-visible:ring-2 peer-focus-visible:ring-brand")}>
                <Icon className={cn("mt-0.5 size-[18px] shrink-0", o.tint)} aria-hidden />
                <span><span className="block text-sm font-medium">{o.label}</span><span className="block text-xs text-muted">{o.desc}</span></span>
              </span>
            </label>
          );
        })}
      </fieldset>

      {choice === "approve" && kind === "head" && (
        <div className="space-y-1.5">
          <label htmlFor="trialDays" className="text-sm font-medium">Trial subscription</label>
          <select id="trialDays" name="trialDays" defaultValue="30" className="input h-10">
            <option value="30">30 days</option><option value="60">60 days</option><option value="90">90 days</option>
          </select>
          <p className="text-xs text-muted">Their access stays fully open during this period.</p>
        </div>
      )}

      <div className="space-y-1.5">
        <label htmlFor="remarks" className="flex justify-between text-sm font-medium">
          {choice === "reject" ? "Reason for rejecting" : choice === "info" ? "What is missing?" : "Remarks"}
          {!needsRemarks && <span className="text-xs font-normal text-faint">Optional</span>}
        </label>
        <textarea id="remarks" name="remarks" rows={3} maxLength={500} required={needsRemarks} placeholder={choice === "info" ? "e.g. Upload the NTN certificate" : choice === "reject" ? "e.g. Company details could not be verified" : "Add a note for the record"} className="input h-auto resize-none py-2.5" />
      </div>

      {state.error && <p role="alert" className="rounded-control bg-bad-soft px-3 py-2 text-sm text-bad">{state.error}</p>}

      <button type="submit" disabled={pending} className={cn("btn h-11 w-full text-[15px] text-white disabled:opacity-60", choice === "reject" ? "bg-bad hover:opacity-90" : "bg-brand hover:bg-brand-strong dark:text-canvas")}>
        {pending ? <><Loader2 className="size-4 animate-spin" aria-hidden /> Saving</> : submitLabel}
      </button>
    </form>
  );
}
