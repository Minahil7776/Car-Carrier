import { cn } from "@/lib/utils";

export function Logo({ light = false, compact = false }: { light?: boolean; compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <svg viewBox="0 0 32 32" className="size-8 shrink-0" aria-hidden>
        <rect width="32" height="32" rx="8" className="fill-brand" />
        <path d="M7 20.5h18M9 20.5V15l3-4h8l3 4v5.5" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="12" cy="22.5" r="1.8" fill="rgb(var(--beacon))" />
        <circle cx="20" cy="22.5" r="1.8" fill="rgb(var(--beacon))" />
      </svg>
      {!compact && (
        <span className={cn("text-[17px] font-semibold tracking-tight", light ? "text-white" : "text-ink")}>Carrier Hub</span>
      )}
    </div>
  );
}
