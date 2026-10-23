"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export interface Slice { key: string; label: string; value: number; color: string }

export function StatusDonut({ slices, centerLabel }: { slices: Slice[]; centerLabel: string }) {
  const [active, setActive] = useState<string | null>(null);
  const total = slices.reduce((n, s) => n + s.value, 0);
  const R = 42, C = 2 * Math.PI * R;
  let offset = 0;

  if (total === 0) return <p className="py-10 text-center text-sm text-muted">No offices yet.</p>;

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row lg:flex-col xl:flex-row">
      <div className="relative size-36 shrink-0">
        <svg viewBox="0 0 100 100" className="size-full -rotate-90" role="img" aria-label={slices.map((s) => `${s.label}: ${s.value}`).join(", ")}>
          <circle cx="50" cy="50" r={R} fill="none" stroke="rgb(var(--line))" strokeWidth="11" />
          {slices.filter((s) => s.value > 0).map((s) => {
            const len = (s.value / total) * C;
            const el = (
              <circle key={s.key} cx="50" cy="50" r={R} fill="none" stroke={s.color} strokeWidth={active === s.key ? 14 : 11}
                strokeDasharray={`${Math.max(len - 1.5, 0)} ${C}`} strokeDashoffset={-offset}
                className="transition-[stroke-width] duration-150" style={{ opacity: active && active !== s.key ? 0.35 : 1 }}
                onMouseEnter={() => setActive(s.key)} onMouseLeave={() => setActive(null)} />
            );
            offset += len;
            return el;
          })}
        </svg>
        <div className="absolute inset-0 grid place-items-center text-center">
          <div>
            <p className="text-2xl font-semibold leading-none">{active ? slices.find((s) => s.key === active)?.value : total}</p>
            <p className="mt-1 text-xs text-muted">{active ? slices.find((s) => s.key === active)?.label : centerLabel}</p>
          </div>
        </div>
      </div>
      <ul className="w-full space-y-1.5 text-sm">
        {slices.map((s) => (
          <li key={s.key}>
            <button onMouseEnter={() => setActive(s.key)} onMouseLeave={() => setActive(null)} onFocus={() => setActive(s.key)} onBlur={() => setActive(null)} className={cn("flex w-full items-center gap-2.5 rounded-md px-2 py-1 text-left transition-colors", active === s.key && "bg-raised")}>
              <span className="size-2.5 rounded-full" style={{ background: s.color }} aria-hidden />
              <span className="flex-1 text-muted">{s.label}</span>
              <span className="font-medium">{s.value}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
