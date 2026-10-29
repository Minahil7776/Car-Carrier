import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getUnreadNotifications } from "@/lib/dashboard-data";
import { AppShell } from "@/components/shell/app-shell";
import { AccessBlocked } from "@/components/shell/access-blocked";
import { TriangleAlert } from "lucide-react";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/logout"); // stale cookie: clear it, then sign in again

  if (user.access.level === "denied") return <AccessBlocked reason={user.access.reason} />;

  const notifications = await getUnreadNotifications(user.id);

  return (
    <AppShell
      user={{ name: user.name, email: user.email, scope: user.scope, roleNames: user.roleNames, officeName: user.office?.name ?? null, officeCode: user.office?.code ?? null }}
      notifications={notifications}
    >
      {user.access.level === "restricted" && (
        <div role="status" className="mb-6 flex items-start gap-3 rounded-card border border-beacon/40 bg-beacon-soft px-4 py-3 text-sm text-warn">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p>{user.access.reason} Contact the system administrator to restore full access.</p>
        </div>
      )}
      {user.access.level === "allowed" && user.access.warning && (
        <div role="status" className="mb-6 flex items-start gap-3 rounded-card border border-beacon/40 bg-beacon-soft px-4 py-3 text-sm text-warn">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p>{user.access.warning}</p>
        </div>
      )}
      {children}
    </AppShell>
  );
}
