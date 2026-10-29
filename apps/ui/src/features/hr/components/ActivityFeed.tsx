"use client";

import type { ActivityItem } from "../dashboard/metrics";
import { useRegionalFormatter } from "@/features/settings/preferences/hooks";

export interface ActivityFeedProps {
  items: ActivityItem[];
}

/**
 * Reusable Activity Feed for recent HR operational actions (tickets, expense claims).
 */
export function ActivityFeed({ items }: ActivityFeedProps) {
  const { formatDateTime } = useRegionalFormatter();
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
    <ul className="divide-y divide-gray-100 dark:divide-[#1C2029]">
      {items.map((item) => (
        <li
          key={item.id}
          className="group flex items-start gap-3 py-3 transition-colors hover:bg-gray-50/50 rounded-lg px-2 dark:hover:bg-[#161B26]"
        >
          <span
            className={`mt-0.5 shrink-0 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
              item.kind === "ticket"
                ? "bg-warning-50 text-warning-700 dark:bg-amber-950/40 dark:text-amber-300 border border-warning-200/50 dark:border-amber-700/30"
                : "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-cyan-300 border border-blue-200/50 dark:border-cyan-800/40"
            }`}
          >
            {item.kind}
          </span>

          <div className="min-w-0 flex-1">
            <p className="truncate text-theme-xs font-semibold text-gray-900 group-hover:text-brand-700 dark:text-white/90 dark:group-hover:text-cyan-400 transition-colors">
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
            {formatDateTime(item.timestamp)}
          </time>
        </li>
      ))}
    </ul>
  );
}
