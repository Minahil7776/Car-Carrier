import { cn } from "@/lib/utils";

export function Section({ title, description, action, children, className, flush = false }: { title: string; description?: string; action?: React.ReactNode; children: React.ReactNode; className?: string; flush?: boolean }) {
  return (
    <section className={cn("card flex flex-col", className)}>
      <header className="flex items-start justify-between gap-4 px-5 pb-3 pt-5">
        <div>
          <h2 className="text-[15px] font-semibold">{title}</h2>
          {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
        </div>
        {action}
      </header>
      <div className={cn("flex-1", flush ? "" : "px-5 pb-5")}>{children}</div>
    </section>
  );
}

export function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div className="grid place-items-center px-6 py-10 text-center">
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-1 max-w-xs text-sm text-muted">{body}</p>
    </div>
  );
}
