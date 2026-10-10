"use client";

import { SEGMENT_FILL } from "./DonutChart";
import type { GlanceEvent } from "../dashboard/metrics";

export interface GlanceSectionProps {
  events: GlanceEvent[];
}

/**
 * Reusable "Today at a glance" schedule & milestone widget.
 * Shows leaves today, upcoming holidays, and work anniversaries.
 */
export function GlanceSection({ events }: GlanceSectionProps) {
  return (
    <div className="flex flex-col gap-4">
      {events.length === 0 ? (
        <div className="py-10 text-center">
          <p className="text-theme-xs font-semibold text-gray-500 dark:text-gray-400">
            Nothing scheduled today
          </p>
          <p className="mt-1 text-[11px] text-gray-400 dark:text-gray-500">
            Approved leaves, upcoming holidays, and team milestones will appear
            here.
          </p>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {events.map((evt) => (
            <li
              key={evt.id}
              className="group flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50/60 p-3 transition-all duration-150 hover:border-gray-200 hover:bg-white dark:border-gray-800 dark:bg-white/2 dark:hover:border-gray-700 dark:hover:bg-gray-800/40"
            >
              <span
                className={`h-2.5 w-2.5 shrink-0 rounded-full transition-transform group-hover:scale-125 ${
                  SEGMENT_FILL[
                    evt.type === "leave"
                      ? "warning"
                      : evt.type === "holiday"
                        ? "chart1"
                        : "brand"
                  ]
                }`}
                aria-hidden="true"
              />

              <div className="min-w-0 flex-1">
                <p className="truncate text-theme-xs font-bold text-gray-900 group-hover:text-brand-700 dark:text-white/90 dark:group-hover:text-brand-400 transition-colors">
                  {evt.name}
                </p>
                <p className="truncate text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                  {evt.detail}
                </p>
              </div>

              <span className="shrink-0 rounded bg-gray-100 px-2 py-0.5 text-[10px] font-bold capitalize text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                {evt.type}
              </span>
            </li>
          ))}
        </ul>
      )}

      <p className="border-t border-gray-100 pt-3 text-[11px] text-gray-500 dark:border-gray-800 dark:text-gray-400">
        Birthdays are not shown: date of birth is held on the restricted
        employee profile.
      </p>
    </div>
  );
}
