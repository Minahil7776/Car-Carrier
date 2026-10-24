import Link from "next/link";
import { cn } from "@/lib/utils";

export function StatCard({ href, label, value, note, icon: Icon, attention = false }: { href?: string; label: string; value: number | string; note?: string; icon: React.ElementType; attention?: boolean }) {
  const card = (
    <div className={cn("card relative h-full overflow-hidden p-4 sm:p-5", attention && "border-beacon/50")}>
      {attention && <span className="absolute inset-x-0 top-0 h-[3px] bg-beacon" aria-hidden />}
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm leading-tight text-muted">{label}</p>
        <span className={cn("hidden size-9 shrink-0 place-items-center rounded-lg sm:grid", attention ? "bg-beacon-soft text-warn" : "bg-brand-soft text-brand-strong")}>
          <Icon className="size-[18px]" aria-hidden />
        </span>
      </div>
      <p className="mt-3 truncate text-[1.75rem] font-semibold leading-none tracking-tight sm:text-[2rem]">{value}</p>
      {note && <p className="mt-2 text-xs text-muted">{note}</p>}
    </div>
  );
  return href ? <Link href={href} className="block rounded-card transition-shadow hover:shadow-pop">{card}</Link> : card;
}
