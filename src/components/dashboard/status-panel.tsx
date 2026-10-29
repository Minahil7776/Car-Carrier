"use client";

import { useActionState, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { updateOfficeStatus, type StatusState } from "@/app/(app)/dashboard/status-actions";
import { STATUS_ACTION_COPY, STATUS_TRANSITIONS } from "@/lib/office-schema";
import type { OfficeStatus } from "@/lib/types";
import { cn, officeStatusMeta } from "@/lib/utils";
import { Pill } from "@/components/ui/pill";
import { useToast } from "@/components/ui/toast";

/** Suspend / block / close / reactivate with a mandatory reason (FR-ORG-007). Shown to the Super Administrator only. */
export function StatusPanel({ officeId, name, status, statusReason, kind }: { officeId: string; name: string; status: OfficeStatus; statusReason: string | null; kind: "head" | "branch" }) {
  const [state, action, pending] = useActionState<StatusState, FormData>(updateOfficeStatus, {});
  const [choice, setChoice] = useState<OfficeStatus | null>(null);
  const toast = useToast();
  const meta = officeStatusMeta[status];
  const options = STATUS_TRANSITIONS[status].filter((s) => s !== "pending");

  useEffect(() => {
    if (state.ok && state.message) { toast(state.message); setChoice(null); }
    else if (state.error) toast(state.error, "error");
  }, [state]); // eslint-disable-line react-hooks/exhaustive-deps

  const label = (s: OfficeStatus) => (s === "active" ? "Reactivate" : STATUS_ACTION_COPY[s].button);

  return (
    <div className="card space-y-4 p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[15px] font-semibold">Status</h2>
        <Pill tone={meta.tone}>{meta.label}</Pill>
      </div>
      {statusReason && status !== "active" && <p className="rounded-lg bg-raised px-3 py-2 text-sm"><span className="text-muted">Reason: </span>{statusReason}</p>}
      {kind === "head" && status !== "active" && (
        <p className="rounded-lg bg-beacon-soft px-3 py-2 text-xs text-warn">While this head office is {status}, its branches and their users can't sign in either.</p>
      )}

      {options.length === 0 ? (
        <p className="text-sm text-muted">No changes available.</p>
      ) : (
        <form action={action} className="space-y-3">
          <input type="hidden" name="id" value={officeId} />
          <input type="hidden" name="to" value={choice ?? ""} />
          <div className="flex flex-wrap gap-2">
            {options.map((s) => (
              <button key={s} type="button" onClick={() => setChoice(s === choice ? null : s)} aria-pressed={choice === s}
                className={cn("btn h-9 border text-sm", choice === s ? (s === "active" ? "border-ok bg-ok-soft text-ok" : s === "suspended" ? "border-warn bg-warn-soft text-warn" : "border-bad bg-bad-soft text-bad") : "border-line bg-surface hover:bg-raised")}>
                {label(s)}
              </button>
            ))}
          </div>

          {choice && (
            <div className="space-y-3">
              <p className="text-xs text-muted">{STATUS_ACTION_COPY[choice].help}</p>
              <div className="space-y-1.5">
                <label htmlFor={`reason-${officeId}`} className="text-sm font-medium">Reason</label>
                <textarea id={`reason-${officeId}`} name="reason" rows={3} maxLength={300} required placeholder={choice === "active" ? "e.g. Issue resolved" : "e.g. Compliance review in progress"} className="input h-auto resize-none py-2.5" />
              </div>
              <button type="submit" disabled={pending} className={cn("btn h-10 w-full text-white", choice === "active" ? "bg-brand hover:bg-brand-strong dark:text-canvas" : "bg-bad hover:opacity-90")}>
                {pending ? <><Loader2 className="size-4 animate-spin" aria-hidden /> Saving</> : `${label(choice)} ${name}`}
              </button>
            </div>
          )}
        </form>
      )}
    </div>
  );
}
