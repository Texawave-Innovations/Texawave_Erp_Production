"use client";

export type WeekdayLabel = "Mon" | "Tue" | "Wed" | "Thu" | "Fri";

export interface WeekdayAbsence {
  day: WeekdayLabel;
  absences: number;
}

export interface AbsenceHeatmapProps {
  days: WeekdayAbsence[];
}

const HEATMAP_TONE = {
  none: "bg-gray-100 text-gray-500 border border-transparent dark:bg-white/[0.04] dark:text-gray-400",
  low: "bg-brand-50 text-brand-700 border border-brand-200/60 dark:bg-brand-500/15 dark:text-brand-400 dark:border-brand-500/30",
  mid: "bg-warning-50 text-warning-700 border border-warning-200/60 dark:bg-warning-500/15 dark:text-warning-400 dark:border-warning-500/30",
  high: "bg-error-500 text-white shadow-theme-xs dark:bg-error-500",
} as const;

/**
 * Weekday Absence Pattern Visualizer.
 * Renders weekday cards with calculated visual intensity, accessible list, and footnotes.
 */
export function AbsenceHeatmap({ days }: AbsenceHeatmapProps) {
  const maxAbsence = Math.max(...days.map((d) => d.absences), 1);

  return (
    <div className="flex flex-col gap-4">
      <ul
        className="grid grid-cols-5 gap-2.5 sm:gap-3"
        aria-label="Absences per weekday, last three working weeks"
      >
        {days.map((d) => {
          const intensity = d.absences / maxAbsence;
          const tone =
            d.absences === 0
              ? HEATMAP_TONE.none
              : intensity < 0.4
                ? HEATMAP_TONE.low
                : intensity < 0.75
                  ? HEATMAP_TONE.mid
                  : HEATMAP_TONE.high;

          return (
            <li key={d.day} className="flex flex-col items-center gap-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                {d.day}
              </span>
              <div
                className={`group flex h-16 w-full flex-col items-center justify-center rounded-xl transition-all duration-200 hover:scale-[1.02] ${tone}`}
              >
                <span className="text-theme-sm font-bold tracking-tight">
                  {d.absences}
                </span>
                <span className="text-[9px] uppercase font-semibold tracking-wider opacity-85">
                  absent
                </span>
              </div>
            </li>
          );
        })}
      </ul>

      <p className="border-t border-gray-100 pt-3 text-[11px] text-gray-500 dark:border-gray-800 dark:text-gray-400">
        Last 3 working weeks, including today (today is partial until attendance
        is complete).
      </p>
    </div>
  );
}
