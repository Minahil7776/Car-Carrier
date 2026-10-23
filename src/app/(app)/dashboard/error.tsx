"use client";

import { RefreshCw } from "lucide-react";

export default function DashboardError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="card mx-auto mt-10 max-w-md p-8 text-center">
      <h1 className="text-lg font-semibold">The dashboard didn&apos;t load</h1>
      <p className="mt-2 text-sm text-muted">This is usually a database connection issue. Check that MONGODB_URI is correct and the cluster allows your IP address, then try again.</p>
      <button onClick={reset} className="btn-primary mx-auto mt-6"><RefreshCw className="size-4" aria-hidden /> Try again</button>
    </div>
  );
}
