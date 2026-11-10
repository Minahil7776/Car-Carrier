"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { createRole, updateRole, type RoleFormState } from "@/app/(app)/dashboard/roles/actions";
import { PERMISSION_GROUPS } from "@/lib/permissions";
import { useToast } from "@/components/ui/toast";

export interface RoleOfficeOption {
  id: string;
  name: string;
  code: string;
}

export function RoleForm({
  mode,
  offices,
  defaults,
}: {
  mode: "create" | "edit";
  offices: RoleOfficeOption[];
  defaults?: {
    key: string;
    name: string;
    description: string;
    scope: "head" | "branch";
    officeId: string;
    permissions: string[];
  };
}) {
  const router = useRouter();
  const toast = useToast();
  const [state, action, pending] = useActionState<RoleFormState, FormData>(mode === "create" ? createRole : updateRole, {});
  const [selectedPermissions, setSelectedPermissions] = useState(new Set(defaults?.permissions ?? ["dashboard.view"]));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [scope, setScope] = useState<"head" | "branch">(defaults?.scope ?? "branch");

  useEffect(() => {
    if (state.fieldErrors) {
      setErrors(state.fieldErrors);
      toast(Object.values(state.fieldErrors)[0] ?? "Check the highlighted fields.", "error");
    } else if (state.error) {
      toast(state.error, "error");
    } else if (state.ok) {
      toast(state.message ?? "Saved.");
      router.push("/dashboard/roles");
      router.refresh();
    }
  }, [router, state, toast]);

  function togglePermission(key: string) {
    setSelectedPermissions((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <form action={action} className="space-y-5">
      {mode === "edit" && defaults && <input type="hidden" name="key" value={defaults.key} />}
      <section className="card space-y-5 p-5 sm:p-6">
        <div>
          <h2 className="text-[15px] font-semibold">Role details</h2>
          <p className="mt-1 text-sm text-muted">A role can be assigned only to users in its office scope.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium">
            Role name
            <input name="name" required minLength={2} maxLength={80} defaultValue={defaults?.name} className="input mt-1.5" />
            {errors.name && <span className="mt-1 block text-xs text-bad">{errors.name}</span>}
          </label>
          <label className="block text-sm font-medium">
            Organization
            {mode === "edit" && defaults && <input type="hidden" name="officeId" value={defaults.officeId} />}
            <select name={mode === "create" ? "officeId" : undefined} required defaultValue={defaults?.officeId ?? offices[0]?.id ?? ""} disabled={mode === "edit"} className="input mt-1.5">
              {offices.map((office) => <option key={office.id} value={office.id}>{office.name} · {office.code}</option>)}
            </select>
            {errors.officeId && <span className="mt-1 block text-xs text-bad">{errors.officeId}</span>}
          </label>
        </div>
        <label className="block text-sm font-medium">
          Description
          <textarea name="description" rows={3} maxLength={300} defaultValue={defaults?.description} className="input mt-1.5 h-auto resize-y py-2.5" placeholder="Describe the responsibilities of this role." />
          {errors.description && <span className="mt-1 block text-xs text-bad">{errors.description}</span>}
        </label>
        <fieldset>
          <legend className="text-sm font-medium">Organizational scope</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {(["head", "branch"] as const).map((value) => (
              <label key={value} className={`flex cursor-pointer items-start gap-3 rounded-control border p-3 ${scope === value ? "border-brand bg-brand-soft/50" : "border-line hover:bg-raised"}`}>
                <input type="radio" name="scope" value={value} checked={scope === value} onChange={() => setScope(value)} disabled={mode === "edit"} className="mt-1 size-4 accent-brand" />
                <span>
                  <span className="block text-sm font-medium">{value === "head" ? "Head office" : "Branch office"}</span>
                  <span className="mt-0.5 block text-xs text-muted">{value === "head" ? "For users attached to the head office." : "For users attached to a branch."}</span>
                </span>
              </label>
            ))}
          </div>
          {errors.scope && <p className="mt-1 text-xs text-bad">{errors.scope}</p>}
        </fieldset>
      </section>

      <section className="card space-y-4 p-5 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-[15px] font-semibold">Permissions</h2>
            <p className="mt-1 text-sm text-muted">Choose the actions all users with this role can perform.</p>
          </div>
          <span className="text-xs text-muted">{selectedPermissions.size} selected</span>
        </div>
        {PERMISSION_GROUPS.map((group) => (
          <fieldset key={group.label} className="border-t border-line pt-4 first:border-0 first:pt-0">
            <legend className="mb-3 text-sm font-semibold">{group.label}</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {group.permissions.map((permission) => (
                <label key={permission.key} className="flex cursor-pointer items-center gap-2.5 rounded-control px-2 py-2 text-sm hover:bg-raised">
                  <input type="checkbox" name="permissions" value={permission.key} checked={selectedPermissions.has(permission.key)} onChange={() => togglePermission(permission.key)} className="size-4 accent-brand" />
                  {permission.label}
                </label>
              ))}
            </div>
          </fieldset>
        ))}
        {errors.permissions && <p className="text-sm text-bad">{errors.permissions}</p>}
      </section>

      <div className="flex flex-wrap justify-end gap-3">
        <Link href="/dashboard/roles" className="btn-ghost h-11">Cancel</Link>
        <button type="submit" disabled={pending || !offices.length || !selectedPermissions.size} className="btn-primary h-11 px-6">
          {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
          {pending ? "Saving" : mode === "create" ? "Create role" : "Save changes"}
        </button>
      </div>
    </form>
  );
}
