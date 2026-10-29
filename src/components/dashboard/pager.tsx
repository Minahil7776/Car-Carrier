import Link from "next/link";

export function Pager({ page, pages, total, basePath, params }: { page: number; pages: number; total: number; basePath: string; params: Record<string, string | undefined> }) {
  const href = (p: number) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][]);
    if (p > 1) qs.set("page", String(p));
    const s = qs.toString();
    return s ? `${basePath}?${s}` : basePath;
  };
  return (
    <div className="flex items-center justify-between border-t border-line px-5 py-3 text-sm text-muted">
      <span>{total} {total === 1 ? "result" : "results"}</span>
      {pages > 1 && (
        <nav aria-label="Pagination" className="flex items-center gap-3">
          {page > 1 ? <Link href={href(page - 1)} className="font-medium text-brand hover:underline">Previous</Link> : <span className="text-faint">Previous</span>}
          <span>Page {page} of {pages}</span>
          {page < pages ? <Link href={href(page + 1)} className="font-medium text-brand hover:underline">Next</Link> : <span className="text-faint">Next</span>}
        </nav>
      )}
    </div>
  );
}
