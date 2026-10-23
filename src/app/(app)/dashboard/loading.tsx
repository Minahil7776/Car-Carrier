export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading dashboard">
      <div className="mb-7 space-y-2"><div className="skeleton h-8 w-64" /><div className="skeleton h-4 w-80" /></div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => <div key={i} className="card space-y-4 p-5"><div className="skeleton h-4 w-28" /><div className="skeleton h-8 w-16" /><div className="skeleton h-3 w-36" /></div>)}
      </div>
      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <div className="card h-72 p-5 lg:col-span-2"><div className="skeleton h-full w-full" /></div>
        <div className="card h-72 p-5"><div className="skeleton mx-auto size-36 rounded-full" /></div>
      </div>
    </div>
  );
}
