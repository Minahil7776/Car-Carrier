"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Bell, Building2, ChevronsLeft, ClipboardCheck, ChevronsRight, GitBranch, LayoutDashboard, LogOut, Menu, ScrollText, Search, ShieldCheck, Users, X,
} from "lucide-react";
import { logout, markNotificationsRead } from "@/app/actions";
import { cn, timeAgo } from "@/lib/utils";
import { useDismiss } from "@/lib/use-dismiss";
import { Logo } from "@/components/ui/logo";
import { Avatar } from "@/components/ui/pill";
import { useToast } from "@/components/ui/toast";
import { ThemeToggle } from "./theme-toggle";
import { CommandPalette } from "./command-palette";

export interface ShellUser {
  name: string;
  email: string;
  scope: "system" | "head" | "branch";
  roleNames: string[];
  officeName: string | null;
  officeCode: string | null;
}
export interface ShellNotification { id: string; title: string; body: string; read: boolean; at: string }

type NavItem = { label: string; href: string; icon: React.ElementType; ready: boolean };

function navFor(scope: ShellUser["scope"]): NavItem[] {
  const dash: NavItem = { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, ready: true };
  if (scope === "system")
    return [dash,
      { label: "Registrations", href: "/dashboard/registrations", icon: ClipboardCheck, ready: true },
      { label: "Organizations", href: "/dashboard/organizations", icon: Building2, ready: false },
      { label: "Branches", href: "/dashboard/branches", icon: GitBranch, ready: false },
      { label: "Users", href: "/dashboard/users", icon: Users, ready: false },
      { label: "Roles", href: "/dashboard/roles", icon: ShieldCheck, ready: false },
      { label: "Audit logs", href: "/dashboard/audit", icon: ScrollText, ready: false }];
  if (scope === "head")
    return [dash,
      { label: "Branches", href: "/dashboard/branches", icon: GitBranch, ready: false },
      { label: "Users", href: "/dashboard/users", icon: Users, ready: false },
      { label: "Roles", href: "/dashboard/roles", icon: ShieldCheck, ready: false },
      { label: "Audit logs", href: "/dashboard/audit", icon: ScrollText, ready: false }];
  return [dash, { label: "Team", href: "/dashboard/users", icon: Users, ready: false }];
}

export function AppShell({ user, notifications, children }: { user: ShellUser; notifications: ShellNotification[]; children: React.ReactNode }) {
  const pathname = usePathname();
  const nav = navFor(user.scope);
  const [collapsed, setCollapsed] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [palette, setPalette] = useState(false);

  useEffect(() => { try { setCollapsed(localStorage.getItem("ch-rail") === "1"); } catch {} }, []);
  useEffect(() => setDrawer(false), [pathname]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setPalette((p) => !p); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const toggleRail = () => setCollapsed((c) => { try { localStorage.setItem("ch-rail", c ? "0" : "1"); } catch {} return !c; });

  const sidebar = (mini: boolean) => (
    <div className="flex h-full flex-col bg-rail text-rail-text">
      <div className={cn("flex h-16 items-center", mini ? "justify-center" : "justify-between px-5")}>
        <Logo light compact={mini} />
        {drawer && <button onClick={() => setDrawer(false)} aria-label="Close menu" className="text-rail-text hover:text-white"><X className="size-5" /></button>}
      </div>

      {!mini && (
        <div className="mx-3 mb-3 rounded-lg bg-white/5 px-3 py-2.5">
          <p className="truncate text-sm font-medium text-white">{user.officeName ?? "All organizations"}</p>
          <p className="mt-0.5 truncate font-mono text-xs text-rail-text">{user.officeCode ?? "System level"}</p>
        </div>
      )}

      <nav aria-label="Main" className="flex-1 space-y-0.5 px-3">
        {nav.map((item) => {
          const Icon = item.icon;
          const active = item.ready && (item.href === "/dashboard" ? pathname === item.href : pathname.startsWith(item.href));
          const base = cn("group relative flex h-10 items-center gap-3 rounded-lg text-sm font-medium", mini ? "justify-center" : "px-3");
          if (!item.ready)
            return (
              <div key={item.href} title={`${item.label} (coming soon)`} aria-disabled className={cn(base, "cursor-not-allowed text-rail-text/45")}>
                <Icon className="size-[18px] shrink-0" aria-hidden />
                {!mini && <><span className="flex-1">{item.label}</span><span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] font-medium text-rail-text/70">Soon</span></>}
              </div>
            );
          return (
            <Link key={item.href} href={item.href} title={mini ? item.label : undefined} aria-current={active ? "page" : undefined} className={cn(base, active ? "bg-rail-hover text-white" : "hover:bg-rail-hover/70 hover:text-white")}>
              {active && <span className="absolute -left-3 top-2 h-6 w-[3px] rounded-r bg-beacon" aria-hidden />}
              <Icon className="size-[18px] shrink-0" aria-hidden />
              {!mini && item.label}
            </Link>
          );
        })}
      </nav>

      <div className={cn("border-t border-white/10 p-3", mini && "flex flex-col items-center gap-2")}>
        <div className={cn("flex items-center gap-3", mini && "flex-col")}>
          <Avatar name={user.name} size={34} />
          {!mini && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white">{user.name}</p>
              <p className="truncate text-xs">{user.roleNames[0] ?? "No role assigned"}{user.roleNames.length > 1 ? ` +${user.roleNames.length - 1}` : ""}</p>
            </div>
          )}
          <form action={logout}>
            <button aria-label="Sign out" title="Sign out" className="grid size-8 place-items-center rounded-md hover:bg-white/10 hover:text-white"><LogOut className="size-4" /></button>
          </form>
        </div>
        <button onClick={toggleRail} aria-label={mini ? "Expand sidebar" : "Collapse sidebar"} className="mt-3 hidden h-8 w-full items-center justify-center gap-2 rounded-md text-xs hover:bg-white/10 hover:text-white lg:flex">
          {mini ? <ChevronsRight className="size-4" /> : <><ChevronsLeft className="size-4" /> Collapse</>}
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh">
      <aside className={cn("fixed inset-y-0 left-0 z-40 hidden transition-[width] duration-200 lg:block", collapsed ? "w-[72px]" : "w-[256px]")}>{sidebar(collapsed)}</aside>

      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-rail/60" onClick={() => setDrawer(false)} />
          <aside className="absolute inset-y-0 left-0 w-[272px] animate-pop">{sidebar(false)}</aside>
        </div>
      )}

      <div className={cn("transition-[padding] duration-200", collapsed ? "lg:pl-[72px]" : "lg:pl-[256px]")}>
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-line bg-canvas/85 px-4 backdrop-blur sm:px-8">
          <button onClick={() => setDrawer(true)} aria-label="Open menu" className="grid size-9 place-items-center rounded-control text-muted hover:bg-raised lg:hidden"><Menu className="size-5" /></button>
          <nav aria-label="Breadcrumb" className="hidden min-w-0 items-center gap-2 text-sm sm:flex">
            <span className="truncate text-muted">{user.officeName ?? "System"}</span>
            <span className="text-faint" aria-hidden>/</span>
            <span className="font-medium">{nav.find((n) => n.ready && (n.href === "/dashboard" ? pathname === n.href : pathname.startsWith(n.href)))?.label ?? "Dashboard"}</span>
          </nav>
          <div className="flex-1" />
          <button onClick={() => setPalette(true)} className="hidden h-9 w-64 items-center gap-2 rounded-control border border-line bg-surface px-3 text-sm text-faint transition-colors hover:border-faint md:flex">
            <Search className="size-4" aria-hidden /> <span className="flex-1 whitespace-nowrap text-left">Search</span>
            <kbd className="rounded border border-line px-1.5 py-0.5 text-[11px]">Ctrl K</kbd>
          </button>
          <button onClick={() => setPalette(true)} aria-label="Search" className="grid size-9 place-items-center rounded-control text-muted hover:bg-raised md:hidden"><Search className="size-[18px]" /></button>
          <Notifications items={notifications} />
          <ThemeToggle />
        </header>
        <div className="px-4 py-6 sm:px-8 sm:py-8">{children}</div>
      </div>

      <CommandPalette open={palette} onClose={() => setPalette(false)} nav={nav} />
    </div>
  );
}

function Notifications({ items }: { items: ShellNotification[] }) {
  const [open, setOpen] = useState(false);
  const [list, setList] = useState(items);
  const ref = useRef<HTMLDivElement>(null);
  const toast = useToast();
  const close = useCallback(() => setOpen(false), []);
  useDismiss(ref, open, close);
  const unread = list.filter((n) => !n.read).length;

  const markAll = async () => {
    setList((l) => l.map((n) => ({ ...n, read: true })));
    await markNotificationsRead();
    toast("All notifications marked as read");
  };

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)} aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`} aria-expanded={open} className="relative grid size-9 place-items-center rounded-control text-muted transition-colors hover:bg-raised hover:text-ink">
        <Bell className="size-[18px]" />
        {unread > 0 && <span className="absolute right-2 top-2 size-2 rounded-full bg-beacon ring-2 ring-canvas" />}
      </button>
      {open && (
        <div className="absolute right-0 top-11 z-50 w-[22rem] max-w-[calc(100vw-2rem)] animate-pop overflow-hidden rounded-card border border-line bg-surface shadow-pop">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <h2 className="text-sm font-semibold">Notifications</h2>
            {unread > 0 && <button onClick={markAll} className="text-xs font-medium text-brand hover:underline">Mark all as read</button>}
          </div>
          <ul className="scroll-thin max-h-80 divide-y divide-line overflow-y-auto">
            {list.length === 0 && <li className="px-4 py-10 text-center text-sm text-muted">You&apos;re all caught up. New registrations and status changes will show here.</li>}
            {list.map((n) => (
              <li key={n.id} className="flex gap-3 px-4 py-3">
                <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.read ? "bg-transparent" : "bg-beacon")} aria-hidden />
                <div className="min-w-0">
                  <p className="text-sm font-medium">{n.title}</p>
                  <p className="text-sm text-muted">{n.body}</p>
                  <p className="mt-1 text-xs text-faint">{timeAgo(n.at)}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
