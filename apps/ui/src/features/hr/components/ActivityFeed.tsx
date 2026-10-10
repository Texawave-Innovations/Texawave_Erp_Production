"use client";

import type { ActivityItem } from "../dashboard/metrics";

export interface ActivityFeedProps {
  items: ActivityItem[];
}

/**
 * Reusable Activity Feed for recent HR operational actions (tickets, expense claims).
 */
export function ActivityFeed({ items }: ActivityFeedProps) {
  if (items.length === 0) {
    return (
      <div className="py-10 text-center">
        <p className="text-theme-xs font-semibold text-gray-500 dark:text-gray-400">
          No recent activity
        </p>
        <p className="mt-1 text-[11px] text-gray-400 dark:text-gray-500">
          Operational tickets and expense claims will appear here once
          submitted.
        </p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-gray-100 dark:divide-gray-800">
      {items.map((item) => (
        <li
          key={item.id}
          className="group flex items-start gap-3 py-3 transition-colors hover:bg-gray-50/50 rounded-lg px-2 dark:hover:bg-white/2"
        >
          <span
            className={`mt-0.5 shrink-0 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
              item.kind === "ticket"
                ? "bg-warning-50 text-warning-700 dark:bg-warning-500/15 dark:text-warning-400 border border-warning-200/50 dark:border-warning-500/20"
                : "bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-400 border border-brand-200/50 dark:border-brand-500/20"
            }`}
          >
            {item.kind}
          </span>

          <div className="min-w-0 flex-1">
            <p className="truncate text-theme-xs font-semibold text-gray-900 group-hover:text-brand-700 dark:text-white/90 dark:group-hover:text-brand-400 transition-colors">
              {item.title}
            </p>
            <p className="truncate text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
              {item.detail}
            </p>
          </div>

          <time
            dateTime={new Date(item.timestamp).toISOString()}
            className="shrink-0 text-[11px] font-medium text-gray-400 dark:text-gray-500"
          >
            {new Date(item.timestamp).toLocaleString("en-IN", {
              day: "2-digit",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
              timeZone: "Asia/Kolkata",
            })}
          </time>
        </li>
      ))}
    </ul>
  );
}
