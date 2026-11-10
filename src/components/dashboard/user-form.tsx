"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { createUser, updateUser, type UserFormState } from "@/app/(app)/dashboard/users/actions";
import { useToast } from "@/components/ui/toast";
import type { ManagedOffice, ManagedRole } from "@/lib/user-management";

export function UserForm({
  mode,
  userId,
  offices,
  roles,
  defaults,
  canEditRoles = true,
}: {
  mode: "create" | "edit";
  userId?: string;
  offices: ManagedOffice[];
  roles: ManagedRole[];
  defaults?: { name: string; email: string; officeId: string; roleKeys: string[] };
  canEditRoles?: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [state, action, pending] = useActionState<UserFormState, FormData>(mode === "create" ? createUser : updateUser, {});
  const [officeId, setOfficeId] = useState(defaults?.officeId ?? offices[0]?.id ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const office = offices.find((item) => item.id === officeId);
  const eligibleRoles = useMemo(
    () => roles.filter((role) => role.scope === office?.type && (!role.isCustom || role.headOfficeId === office.headOfficeId)),
    [office, roles],
  );
  const inactiveRoles = eligibleRoles.filter((role) => role.status === "inactive" && defaults?.roleKeys.includes(role.key));

  useEffect(() => {
    if (state.fieldErrors) {
      setErrors(state.fieldErrors);
      toast(Object.values(state.fieldErrors)[0] ?? "Check the highlighted fields.", "error");
    } else if (state.error) {
      toast(state.error, "error");
    } else if (state.ok) {
      toast(state.message ?? "Saved.");
      router.push("/dashboard/users");
      router.refresh();
    }
  }, [router, state, toast]);

  function changeOffice(value: string) {
    setOfficeId(value);
    setErrors((current) => ({ ...current, roleKeys: "" }));
  }

  return (
    <form action={action} className="space-y-5">
      {mode === "edit" && <input type="hidden" name="id" value={userId} />}
      <section className="card space-y-5 p-5 sm:p-6">
        <div>
          <h2 className="text-[15px] font-semibold">Account details</h2>
          <p className="mt-1 text-sm text-muted">Each account belongs to one office. Role assignment does not change its organizational scope.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium">
            Full name
            <input name="name" required minLength={2} maxLength={100} defaultValue={defaults?.name} autoComplete="name" className="input mt-1.5" />
            {errors.name && <span className="mt-1 block text-xs text-bad">{errors.name}</span>}
          </label>
          <label className="block text-sm font-medium">
            Email address
            {mode === "create" ? (
              <input name="email" type="email" required maxLength={254} autoComplete="email" placeholder="name@company.com" className="input mt-1.5" />
            ) : (
              <>
                <input type="email" value={defaults?.email ?? ""} readOnly className="input mt-1.5 cursor-not-allowed bg-raised text-muted" />
                <span className="mt-1 block text-xs font-normal text-muted">Login email cannot be changed here.</span>
              </>
            )}
            {errors.email && <span className="mt-1 block text-xs text-bad">{errors.email}</span>}
          </label>
        </div>
        <label className="block text-sm font-medium">
          Office
          {mode === "create" ? (
            <select name="officeId" required value={officeId} onChange={(event) => changeOffice(event.target.value)} className="input mt-1.5">
              <option value="">Select an office</option>
              {offices.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} · {item.type === "head" ? "Head office" : item.headOfficeName}
                </option>
              ))}
            </select>
          ) : (
            <>
              <input type="hidden" name="officeId" value={defaults?.officeId ?? ""} />
              <input value={office ? `${office.name} · ${office.type === "head" ? "Head office" : office.headOfficeName}` : "Office"} readOnly className="input mt-1.5 cursor-not-allowed bg-raised text-muted" />
            </>
          )}
          {errors.officeId && <span className="mt-1 block text-xs text-bad">{errors.officeId}</span>}
        </label>
        {mode === "create" && (
          <label className="block text-sm font-medium">
            Temporary password
            <input name="password" type="password" required minLength={12} maxLength={128} autoComplete="new-password" className="input mt-1.5" />
            <span className="mt-1 block text-xs font-normal text-muted">Use at least 12 characters. Share it with the user securely.</span>
            {errors.password && <span className="mt-1 block text-xs text-bad">{errors.password}</span>}
          </label>
        )}
      </section>

      <section className="card space-y-4 p-5 sm:p-6">
        <div>
          <h2 className="text-[15px] font-semibold">Assigned roles</h2>
          <p className="mt-1 text-sm text-muted">Select one or more active roles. Their permissions are combined for this user.</p>
        </div>
        {!canEditRoles ? (
          <p className="text-sm text-muted">Your own role assignments cannot be changed.</p>
        ) : eligibleRoles.length ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {eligibleRoles.filter((role) => role.status === "active").map((role) => (
              <label key={role.key} className="flex cursor-pointer items-start gap-3 rounded-control border border-line p-3 hover:bg-raised">
                <input type="checkbox" name="roleKeys" value={role.key} defaultChecked={defaults?.roleKeys.includes(role.key)} className="mt-1 size-4 accent-brand" />
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{role.name}</span>
                  {role.description && <span className="mt-0.5 block text-xs text-muted">{role.description}</span>}
                  {role.isCustom && <span className="mt-1 block text-xs text-brand">Custom role</span>}
                </span>
              </label>
            ))}
            {inactiveRoles.map((role) => (
              <label key={role.key} className="flex cursor-not-allowed items-start gap-3 rounded-control border border-line bg-raised p-3 text-muted">
                <input type="checkbox" checked disabled className="mt-1 size-4" readOnly />
                <span className="text-sm">{role.name}<span className="ml-2 text-xs">Inactive; retained until reactivated</span></span>
              </label>
            ))}
          </div>
        ) : (
          <p className="rounded-control border border-line bg-raised p-4 text-sm text-muted">There are no active roles available for this office yet.</p>
        )}
        {errors.roleKeys && <p className="text-sm text-bad">{errors.roleKeys}</p>}
      </section>

      <div className="flex flex-wrap justify-end gap-3">
        <Link href="/dashboard/users" className="btn-ghost h-11">Cancel</Link>
        <button type="submit" disabled={pending || !offices.length || (!eligibleRoles.length && canEditRoles)} className="btn-primary h-11 px-6">
          {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
          {pending ? "Saving" : mode === "create" ? "Create user" : "Save changes"}
        </button>
      </div>
    </form>
  );
}
