"use client";

import { SectionCard } from "@texawave-erp/ui-kit";
import { useMyPoints } from "../hooks";
import { formatDate } from "../format";
import type { PointsAward } from "../types";

/** 150 -> "2h 30m", 45 -> "45m", 120 -> "2h". */
function duration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/** How an award came about, in words: "ETA 2h · took 2h 30m (30m over)". Awards
 * made before time-based points existed carry no breakdown. */
function explain(a: PointsAward): string {
  if (a.rule === null || a.etaMinutes === null || a.workedMinutes === null) {
    return "Fixed task points";
  }
  if (a.etaMinutes === 0) return "No ETA was set";
  const took = `ETA ${duration(a.etaMinutes)} · took ${duration(a.workedMinutes)}`;
  if (a.bonusPoints && a.bonusPoints > 0) {
    return `${took} · on time, +${a.bonusPoints} bonus`;
  }
  if (a.overrunMinutes && a.overrunMinutes > 0) {
    return `${took} (${duration(a.overrunMinutes)} over)`;
  }
  return took;
}

/** The employee's recent reward points and how each was worked out. Renders
 * nothing until there is an award, so it never adds an empty block. */
export function MyPointsPanel() {
  const awards = useMyPoints();
  const rows = awards.data?.slice(0, 5) ?? [];
  if (rows.length === 0) return null;
  const total = awards.data?.reduce((sum, a) => sum + a.points, 0) ?? 0;

  return (
    <SectionCard
      title="My reward points"
      description={`${total} points in your latest ${awards.data?.length ?? 0} awards. Points are measured against each task's ETA.`}
    >
      <ul className="flex flex-col divide-y divide-gray-100 dark:divide-gray-800">
        {rows.map((a) => (
          <li
            key={a.id}
            className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
          >
            <div className="min-w-0">
              <p className="truncate text-theme-sm font-semibold text-gray-900 dark:text-white/90">
                {a.taskTitle}
              </p>
              <p className="text-theme-xs text-gray-500 dark:text-gray-400">
                {explain(a)} · {formatDate(a.awardedAt)}
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-amber-50 px-2.5 py-1 text-theme-xs font-bold text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
              +{a.points} pts
            </span>
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}
