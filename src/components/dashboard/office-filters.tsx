"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { OFFICE_SORTS, OFFICE_STATUSES } from "@/lib/office-schema";
import { officeStatusMeta } from "@/lib/utils";

/** Search, filter and sort live in the URL, so the server does the work and the page is shareable (SRS section 38). */
export function OfficeFilters({ cities, heads, placeholder }: { cities: string[]; heads?: { id: string; name: string }[]; placeholder: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const push = (patch: Record<string, string>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) (v ? next.set(k, v) : next.delete(k));
    next.delete("page"); // a new filter starts from page one
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  };

  useEffect(() => () => clearTimeout(timer.current), []);
  const onSearch = (v: string) => { setQ(v); clearTimeout(timer.current); timer.current = setTimeout(() => push({ q: v.trim() }), 350); };

  const select = "input h-10 w-full sm:w-auto sm:min-w-[9rem]";
  const active = ["q", "status", "city", "head", "sort"].some((k) => params.get(k));

  return (
    <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
      <div className="relative flex-1 sm:min-w-[16rem]">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" aria-hidden />
        <input value={q} onChange={(e) => onSearch(e.target.value)} placeholder={placeholder} aria-label={placeholder} className="input h-10 pl-9" />
      </div>
      <select aria-label="Status" value={params.get("status") ?? ""} onChange={(e) => push({ status: e.target.value })} className={select}>
        <option value="">All statuses</option>
        {OFFICE_STATUSES.map((s) => <option key={s} value={s}>{officeStatusMeta[s].label}</option>)}
      </select>
      <select aria-label="City" value={params.get("city") ?? ""} onChange={(e) => push({ city: e.target.value })} className={select}>
        <option value="">All cities</option>
        {cities.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
      {heads && (
        <select aria-label="Head office" value={params.get("head") ?? ""} onChange={(e) => push({ head: e.target.value })} className={select}>
          <option value="">All head offices</option>
          {heads.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
        </select>
      )}
      <select aria-label="Sort" value={params.get("sort") ?? "name"} onChange={(e) => push({ sort: e.target.value === "name" ? "" : e.target.value })} className={select}>
        {OFFICE_SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
      </select>
      {active && <button type="button" onClick={() => { setQ(""); router.replace(pathname); }} className="btn-ghost h-10">Clear</button>}
    </div>
  );
}
