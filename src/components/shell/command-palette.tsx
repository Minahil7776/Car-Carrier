"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CornerDownLeft, LogOut, Moon, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { logout } from "@/app/actions";
import { toggleTheme } from "./theme-toggle";
import { useToast } from "@/components/ui/toast";

interface Command { id: string; label: string; hint?: string; icon: React.ElementType; group: string; run: () => void }

export function CommandPalette({ open, onClose, nav }: { open: boolean; onClose: () => void; nav: { label: string; href: string; icon: React.ElementType; ready: boolean }[] }) {
  const router = useRouter();
  const toast = useToast();
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  const commands = useMemo<Command[]>(() => [
    ...nav.filter((n) => n.ready).map((n) => ({ id: n.href, label: `Go to ${n.label}`, icon: n.icon, group: "Navigate", run: () => router.push(n.href) })),
    { id: "theme", label: "Switch light / dark theme", icon: Moon, group: "Preferences", run: () => { const dark = toggleTheme(); toast(dark ? "Dark theme on" : "Light theme on", "info"); } },
    { id: "logout", label: "Sign out", icon: LogOut, group: "Account", run: () => { void logout(); } },
  ], [nav, router, toast]);

  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? commands.filter((c) => c.label.toLowerCase().includes(s)) : commands;
  }, [q, commands]);

  useEffect(() => { if (open) { setQ(""); setActive(0); setTimeout(() => input.current?.focus(), 0); } }, [open]);
  useEffect(() => setActive(0), [q]);

  if (!open) return null;

  const run = (c?: Command) => { if (!c) return; onClose(); c.run(); };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); run(results[active]); }
    else if (e.key === "Escape") onClose();
  };

  let lastGroup = "";
  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center bg-rail/50 px-4 pt-[14vh] backdrop-blur-[2px]" onMouseDown={onClose}>
      <div role="dialog" aria-modal="true" aria-label="Command palette" onMouseDown={(e) => e.stopPropagation()} onKeyDown={onKey} className="w-full max-w-lg animate-pop overflow-hidden rounded-card border border-line bg-surface shadow-pop">
        <div className="flex items-center gap-3 border-b border-line px-4">
          <Search className="size-4 text-faint" aria-hidden />
          <input ref={input} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search pages and actions" aria-label="Search commands" className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-faint" />
          <kbd className="rounded border border-line px-1.5 py-0.5 text-[11px] text-faint">Esc</kbd>
        </div>
        <ul role="listbox" className="scroll-thin max-h-72 overflow-y-auto p-2">
          {results.length === 0 && <li className="px-3 py-8 text-center text-sm text-muted">Nothing matches &ldquo;{q}&rdquo;. Try a page name like Dashboard.</li>}
          {results.map((c, i) => {
            const header = c.group !== lastGroup ? c.group : null;
            lastGroup = c.group;
            const Icon = c.icon;
            return (
              <li key={c.id} role="presentation">
                {header && <p className="px-3 pb-1 pt-2 text-xs font-medium text-faint">{header}</p>}
                <button role="option" aria-selected={i === active} onMouseMove={() => setActive(i)} onClick={() => run(c)} className={cn("flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm", i === active ? "bg-brand-soft text-brand-strong" : "text-ink")}>
                  <Icon className="size-4 shrink-0" aria-hidden />
                  <span className="flex-1">{c.label}</span>
                  {i === active && <CornerDownLeft className="size-3.5 opacity-60" aria-hidden />}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

