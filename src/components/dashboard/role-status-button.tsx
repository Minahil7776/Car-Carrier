"use client";

import { useActionState, useEffect } from "react";
import { changeRoleStatus, type RoleFormState } from "@/app/(app)/dashboard/roles/actions";
import { useToast } from "@/components/ui/toast";

export function RoleStatusButton({ roleKey, status }: { roleKey: string; status: "active" | "inactive" }) {
  const toast = useToast();
  const [state, action, pending] = useActionState<RoleFormState, FormData>(changeRoleStatus, {});
  const nextStatus = status === "active" ? "inactive" : "active";

  useEffect(() => {
    if (state.error) toast(state.error, "error");
    else if (state.ok) toast(state.message ?? "Status updated.");
  }, [state, toast]);

  return (
    <form action={action}>
      <input type="hidden" name="key" value={roleKey} />
      <input type="hidden" name="status" value={nextStatus} />
      <button type="submit" disabled={pending} className="btn-ghost h-8 px-2.5 text-xs">
        {pending ? "Saving" : status === "active" ? "Deactivate" : "Reactivate"}
      </button>
    </form>
  );
}
