"use client";

import type { ComponentType } from "react";
import Link from "next/link";
import { Users, CheckCircle2, Calendar, Banknote } from "lucide-react";

export interface ActivityItem {
  id: string;
  title: string;
  description: string;
  timeAgo: string;
  icon: ComponentType<{ className?: string }>;
  tone: "blue" | "emerald" | "amber" | "cyan";
}

const DEFAULT_ACTIVITIES: ActivityItem[] = [
  {
    id: "act-1",
    title: "New employee registered",
    description: "Arun Kumar joined Production department",
    timeAgo: "2 mins ago",
    icon: Users,
    tone: "blue",
  },
  {
    id: "act-2",
    title: "Leave request approved",
    description: "Priya's leave request has been approved",
    timeAgo: "15 mins ago",
    icon: CheckCircle2,
    tone: "emerald",
  },
  {
    id: "act-3",
    title: "Attendance updated",
    description: "Today's attendance has been synchronized",
    timeAgo: "1 hour ago",
    icon: Calendar,
    tone: "amber",
  },
  {
    id: "act-4",
    title: "Payroll processed",
    description: "Salary for August 2026 has been processed",
    timeAgo: "3 hours ago",
    icon: Banknote,
    tone: "cyan",
  },
];

const TONE_BADGE: Record<string, string> = {
  blue: "bg-blue-100/80 text-blue-600 dark:bg-blue-950 dark:text-blue-400",
  emerald:
    "bg-emerald-100/80 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400",
  amber: "bg-amber-100/80 text-amber-600 dark:bg-amber-950 dark:text-amber-400",
  cyan: "bg-cyan-100/80 text-cyan-600 dark:bg-cyan-950 dark:text-cyan-400",
};

export interface RecentActivitiesCardProps {
  activities?: ActivityItem[];
  className?: string;
}

export function RecentActivitiesCard({
  activities = DEFAULT_ACTIVITIES,
  className = "",
}: RecentActivitiesCardProps) {
  return (
    <div
      className={`overflow-hidden rounded-2xl border border-sky-200/80 bg-white card-light-shadow hover:border-sky-300 dark:border-sky-900/60 dark:bg-gray-900 ${className}`}
    >
      {/* Light Sky & Cloud Tinted Header Bar */}
      <div className="flex items-center justify-between border-b border-sky-200/70 bg-linear-to-r from-sky-50/90 via-[#f0f8ff] to-sky-50/60 px-5 py-3.5 dark:border-sky-900/60 dark:from-sky-950/40 dark:via-gray-900 dark:to-sky-950/20">
        <h3 className="text-sm font-bold text-[#0a3271] dark:text-sky-100">
          Recent Activities
        </h3>

        <Link
          href="/hr/employees"
          className="text-xs font-semibold text-brand-600 hover:text-brand-700 hover:underline dark:text-cyan-400"
        >
          View All
        </Link>
      </div>

      <div className="p-5">
        {/* Activity List */}
        {activities.length === 0 ? (
          <div className="flex h-52 flex-col items-center justify-center text-center px-4">
            <p className="text-xs font-semibold text-slate-500 dark:text-gray-400">
              No recent activity
            </p>
            <p className="mt-1 text-[11px] text-slate-400 dark:text-gray-500">
              Operational activities will appear here automatically.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-gray-800/80">
            {activities.map((item) => {
              const Icon = item.icon;
              const badgeClass = TONE_BADGE[item.tone] || TONE_BADGE.blue;

              return (
                <div
                  key={item.id}
                  className="flex items-start gap-3 py-3 first:pt-1 last:pb-1"
                >
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${badgeClass}`}
                  >
                    <Icon className="h-4.5 w-4.5" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-xs font-bold text-slate-800 dark:text-gray-200 truncate">
                        {item.title}
                      </h4>
                      <span className="text-[11px] font-medium text-slate-400 dark:text-gray-500 shrink-0">
                        {item.timeAgo}
                      </span>
                    </div>
                    <p className="text-[11px] font-medium text-slate-500 dark:text-gray-400 truncate mt-0.5">
                      {item.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
