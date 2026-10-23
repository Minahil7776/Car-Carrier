import type { ActivityItem } from "@/lib/dashboard-data";
import { Avatar } from "@/components/ui/pill";
import { timeAgo } from "@/lib/utils";
import { Empty } from "./section";

export function ActivityFeed({ items }: { items: ActivityItem[] }) {
  if (!items.length) return <Empty title="No activity yet" body="Sign-ins, approvals and status changes will be recorded here." />;
  const now = Date.now();
  return (
    <ol className="space-y-4">
      {items.map((a) => (
        <li key={a.id} className="flex gap-3">
          <Avatar name={a.actor} size={30} className="mt-0.5" />
          <div className="min-w-0 flex-1">
            <p className="text-sm leading-snug">{a.summary}</p>
            <p className="mt-0.5 flex gap-2 text-xs text-muted"><span>{a.actor}</span><span className="text-faint">{timeAgo(a.at, now)}</span></p>
          </div>
        </li>
      ))}
    </ol>
  );
}
