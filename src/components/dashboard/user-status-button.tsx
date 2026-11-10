"use client";

import { useActionState, useEffect } from "react";
import { changeUserStatus, type UserFormState } from "@/app/(app)/dashboard/users/actions";
import { useToast } from "@/components/ui/toast";

export function UserStatusButton({ id, status }: { id: string; status: "active" | "suspended" }) {
  const toast = useToast();
  const [state, action, pending] = useActionState<UserFormState, FormData>(changeUserStatus, {});
  const nextStatus = status === "active" ? "suspended" : "active";

  useEffect(() => {
    if (state.error) toast(state.error, "error");
    else if (state.ok) toast(state.message ?? "Status updated.");
  }, [state, toast]);

  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={nextStatus} />
      <button type="submit" disabled={pending} className="btn-ghost h-8 px-2.5 text-xs">
        {pending ? "Saving" : status === "active" ? "Suspend" : "Reactivate"}
      </button>
    </form>
  );
}
