import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export function Field({ id, label, hint, error, optional, children }: { id: string; label: string; hint?: string; error?: string; optional?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="flex items-baseline justify-between text-sm font-medium">
        {label}
        {optional && <span className="text-xs font-normal text-faint">Optional</span>}
      </label>
      {children}
      {error ? <p id={`${id}-err`} className="text-xs text-bad">{error}</p> : hint ? <p className="text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

export function inputProps(errors: Record<string, string>, k: string) {
  return {
    id: k,
    name: k,
    className: cn("input", errors[k] && "border-bad focus:border-bad focus:ring-bad/25"),
    "aria-invalid": errors[k] ? (true as const) : undefined,
    "aria-describedby": errors[k] ? `${k}-err` : undefined,
  };
}

type Option = string | { value: string; label: string };
export function SelectBox({ name, errors, options, placeholder, ...rest }: { name: string; errors: Record<string, string>; options: readonly Option[]; placeholder?: string } & React.SelectHTMLAttributes<HTMLSelectElement>) {
  const base = inputProps(errors, name);
  return (
    <div className="relative">
      <select {...base} {...rest} className={cn(base.className, "appearance-none pr-9", rest.className)}>
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => (typeof o === "string" ? <option key={o} value={o}>{o}</option> : <option key={o.value} value={o.value}>{o.label}</option>))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-faint" aria-hidden />
    </div>
  );
}
