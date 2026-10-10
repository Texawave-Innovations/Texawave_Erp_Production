"use client";

import { SEGMENT_FILL, type SegmentTone } from "./DonutChart";

export interface LegendItem {
  label: string;
  value: number;
  tone: SegmentTone;
  detail?: string;
}

export interface LegendProps {
  items: LegendItem[];
  className?: string;
}

/**
 * Reusable Chart Legend with percentage calculation and micro-interaction states.
 */
export function Legend({ items, className = "" }: LegendProps) {
  const total = items.reduce((sum, i) => sum + i.value, 0);

  return (
    <ul className={`min-w-0 flex-1 space-y-2 ${className}`}>
      {items.map((item) => {
        const pct = total > 0 ? Math.round((item.value / total) * 100) : 0;

        return (
          <li
            key={item.label}
            className="group flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50/70 px-3 py-2.5 transition-all duration-150 hover:border-gray-200 hover:bg-white dark:border-gray-800 dark:bg-white/2 dark:hover:border-gray-700 dark:hover:bg-gray-800/50"
          >
            <span
              className={`h-2.5 w-2.5 shrink-0 rounded-full transition-transform group-hover:scale-125 ${SEGMENT_FILL[item.tone]}`}
              aria-hidden="true"
            />

            <span className="min-w-0 flex-1">
              <span className="block text-theme-xs font-semibold text-gray-800 dark:text-white/90 truncate">
                {item.label}
              </span>
              {item.detail ? (
                <span className="block text-[11px] text-gray-500 dark:text-gray-400 truncate">
                  {item.detail}
                </span>
              ) : null}
            </span>

            <span className="text-theme-xs font-bold text-gray-900 dark:text-white/90 shrink-0">
              {item.value}
              <span className="ml-1 text-[11px] font-normal text-gray-400 dark:text-gray-500">
                ({pct}%)
              </span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
