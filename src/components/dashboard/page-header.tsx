import { Pill } from "@/components/ui/pill";

export function PageHeader({ name, scopeLabel, subtitle }: { name: string; scopeLabel: string; subtitle: string }) {
  const tz = process.env.APP_TIMEZONE || "Asia/Karachi";
  const now = new Date();
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: tz }).format(now)) % 24;
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const date = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: tz }).format(now);

  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-[1.7rem]">{greeting}, {name.split(" ")[0]}</h1>
        <p className="mt-1 text-sm text-muted">{subtitle}</p>
      </div>
      <div className="flex items-center gap-3 text-sm text-muted">
        <span>{date}</span>
        <Pill tone="brand" dot={false}>{scopeLabel}</Pill>
      </div>
    </div>
  );
}
