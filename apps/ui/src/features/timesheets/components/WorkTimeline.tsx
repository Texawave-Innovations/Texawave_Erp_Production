"use client";

import { useMemo, useState } from "react";
import { businessToday } from "@texawave-erp/core";
import {
  Skeleton,
  SpringGlideSegmentedControl,
  type SegmentOption,
} from "@texawave-erp/ui-kit";
import {
  buildDayTimeline,
  sharedAxis,
  type DayStatusMark,
  type DayTimeline,
  type TimelineSegment,
} from "../day-timeline";
import { useMyDays } from "../hooks";
import type { MyTimesheetDay } from "../types";
import { weekDates, weekStartOf } from "../week-grid";
import { formatMinutes, formatShortDate } from "./format";

// Literal class lists (never interpolated) so Tailwind keeps every class.
// Brand blues and cyan only (CLAUDE.md: no violet/purple/indigo).
const WORK_CLASSES = [
  "bg-brand-500",
  "bg-cyan-500",
  "bg-sky-700",
  "bg-brand-800",
  "bg-cyan-700",
  "bg-sky-400",
];
const PERMISSION_CLASS = "bg-warning-400";
const NO_TASK_CLASS = "bg-gray-300 dark:bg-gray-600";
const PAUSED_CLASS = "bg-sky-200 dark:bg-sky-900";
/** Gaps are striped so they never read as recorded time. */
const GAP_STRIPES = {
  backgroundImage:
    "repeating-linear-gradient(135deg, rgba(255,255,255,0.45) 0 4px, transparent 4px 8px)",
};

/** HR's day status on the bar: a full-day band (half day: a chip). */
const DAY_STATUS: Record<
  DayStatusMark,
  { label: string; note: string; className: string }
> = {
  HOLIDAY: {
    label: "Holiday",
    note: "Company holiday, no work expected",
    className:
      "bg-cyan-50 text-cyan-800 ring-1 ring-inset ring-cyan-200 dark:bg-cyan-950/50 dark:text-cyan-200 dark:ring-cyan-900",
  },
  WEEKLY_OFF: {
    label: "Weekly off",
    note: "Weekly off, no work expected",
    className:
      "bg-slate-200/70 text-slate-600 ring-1 ring-inset ring-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700",
  },
  ON_LEAVE: {
    label: "On leave",
    note: "Approved leave, no work expected",
    className:
      "bg-sky-50 text-sky-800 ring-1 ring-inset ring-sky-200 dark:bg-sky-950/50 dark:text-sky-200 dark:ring-sky-900",
  },
  ABSENT: {
    label: "Absent",
    note: "Marked absent by HR",
    className:
      "bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:ring-rose-900",
  },
  HALF_DAY: {
    label: "Half day",
    note: "Half day",
    className:
      "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900",
  },
};

/** A full day the bar covers with a band (everything but half day). */
function fullDayStatus(t: DayTimeline): DayStatusMark | null {
  return t.dayStatus !== null && t.dayStatus !== "HALF_DAY"
    ? t.dayStatus
    : null;
}

function segmentClass(s: TimelineSegment): string {
  if (s.kind === "permission") return PERMISSION_CLASS;
  if (s.kind === "paused") return PAUSED_CLASS;
  if (s.kind === "no_task") return NO_TASK_CLASS;
  return WORK_CLASSES[s.colorIndex % WORK_CLASSES.length] ?? WORK_CLASSES[0]!;
}

/** Minutes after midnight -> `10:30 AM`. */
function clockOf(minutes: number): string {
  const h24 = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${h24 < 12 ? "AM" : "PM"}`;
}

/** Minutes after midnight -> `10 AM` (axis ticks). */
function hourOf(minutes: number): string {
  const h24 = Math.floor(minutes / 60) % 24;
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12} ${h24 < 12 ? "AM" : "PM"}`;
}

function segmentText(s: TimelineSegment): string {
  const span = `${clockOf(s.start)} – ${s.running ? "now" : clockOf(s.end)}`;
  const what = s.kind === "work" ? s.detail : `${s.label} (${s.detail})`;
  return `${what}: ${span}, ${formatMinutes(Math.max(s.end - s.start, 0))}`;
}

/**
 * The bar itself: the day between `axisStart` and `axisEnd` (IST), work in a
 * colour per task, the permission window in amber, paused (light blue) and
 * no-active-task (grey) gaps striped, the punches as markers and, today, a
 * "now" line with the rest of the day faded. Purely visual — the same facts are in the label and
 * in the legend below.
 */
export function TimelineBar({
  timeline,
  axisStart,
  axisEnd,
  compact = false,
  showTicks = true,
}: {
  timeline: DayTimeline;
  axisStart: number;
  axisEnd: number;
  compact?: boolean;
  showTicks?: boolean;
}) {
  const span = Math.max(axisEnd - axisStart, 1);
  const pct = (m: number) =>
    `${(Math.min(Math.max(m - axisStart, 0), span) / span) * 100}%`;
  const width = (s: TimelineSegment) =>
    `${(Math.max(Math.min(s.end, axisEnd) - Math.max(s.start, axisStart), 0) / span) * 100}%`;
  const hours: number[] = [];
  const step = span > 12 * 60 || compact ? 120 : 60;
  for (let m = axisStart; m <= axisEnd; m += step) hours.push(m);

  const band = fullDayStatus(timeline);
  const statusText =
    timeline.dayStatus !== null
      ? `${DAY_STATUS[timeline.dayStatus].note}. `
      : "";
  const description =
    statusText +
    (timeline.segments.length === 0
      ? "Nothing recorded"
      : timeline.segments.map(segmentText).join("; "));

  return (
    <div className="w-full">
      <div
        className={`relative w-full overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-800 ${compact ? "h-5" : "h-9"}`}
        role="img"
        aria-label={`Timeline: ${description}`}
      >
        {/* Hour gridlines */}
        {hours.map((m) => (
          <span
            key={`grid-${m}`}
            aria-hidden
            className="absolute inset-y-0 w-px bg-gray-200 dark:bg-gray-700"
            style={{ left: pct(m) }}
          />
        ))}
        {band !== null ? (
          // The whole day; any work recorded on it is drawn on top.
          <span
            aria-hidden
            title={DAY_STATUS[band].note}
            className={`absolute inset-0 flex items-center justify-center rounded-lg font-bold ${compact ? "text-[10px]" : "text-xs"} ${DAY_STATUS[band].className}`}
          >
            {DAY_STATUS[band].label}
          </span>
        ) : timeline.dayStatus === "HALF_DAY" ? (
          <span
            aria-hidden
            title={DAY_STATUS.HALF_DAY.note}
            className={`absolute right-1 top-1/2 -translate-y-1/2 rounded px-1.5 text-[10px] font-bold ${DAY_STATUS.HALF_DAY.className}`}
          >
            {DAY_STATUS.HALF_DAY.label}
          </span>
        ) : null}
        {timeline.segments.map((s, i) => (
          <span
            key={`${s.kind}-${s.start}-${i}`}
            title={segmentText(s)}
            className={`absolute inset-y-0.5 flex items-center overflow-hidden rounded-md px-1.5 ${segmentClass(s)} ${s.running ? "motion-safe:animate-pulse" : ""}`}
            style={{
              left: pct(s.start),
              width: width(s),
              ...(s.kind === "paused" || s.kind === "no_task"
                ? GAP_STRIPES
                : {}),
            }}
          >
            {!compact ? (
              <span
                className={`truncate text-[10px] font-bold ${s.kind === "work" ? "text-white" : "text-gray-800 dark:text-gray-100"}`}
              >
                {s.label} · {formatMinutes(Math.max(s.end - s.start, 0))}
              </span>
            ) : null}
          </span>
        ))}
        {timeline.checkIn !== null ? (
          <span
            aria-hidden
            title={`Checked in ${clockOf(timeline.checkIn)}`}
            className="absolute inset-y-0 w-0.5 bg-success-600"
            style={{ left: pct(timeline.checkIn) }}
          />
        ) : null}
        {timeline.checkOut !== null ? (
          <span
            aria-hidden
            title={`Checked out ${clockOf(timeline.checkOut)}`}
            className="absolute inset-y-0 w-0.5 bg-rose-600"
            style={{ left: pct(timeline.checkOut) }}
          />
        ) : null}
        {timeline.now !== null && timeline.now < axisEnd ? (
          <>
            {/* The rest of today has not happened yet. */}
            <span
              aria-hidden
              className="absolute inset-y-0 right-0 bg-white/60 dark:bg-gray-900/60"
              style={{ left: pct(timeline.now) }}
            />
            <span
              aria-hidden
              title={`Now ${clockOf(timeline.now)}`}
              className="absolute inset-y-0 border-l-2 border-dashed border-brand-600 dark:border-brand-400"
              style={{ left: pct(timeline.now) }}
            />
          </>
        ) : null}
      </div>
      {showTicks ? (
        <div className="relative mt-1 h-4 w-full text-[10px] text-gray-400 dark:text-gray-500">
          {hours.map((m, i) => (
            <span
              key={`tick-${m}`}
              className={`absolute whitespace-nowrap ${i === 0 ? "" : i === hours.length - 1 ? "-translate-x-full" : "-translate-x-1/2"}`}
              style={{ left: pct(m) }}
            >
              {hourOf(m)}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function LegendDot({
  className,
  style,
}: {
  className: string;
  style?: object;
}) {
  return (
    <span
      aria-hidden
      className={`inline-block h-2.5 w-2.5 rounded-sm ${className}`}
      style={style}
    />
  );
}

/** What the colours mean, with the minutes of each. */
function TimelineLegend({ timeline }: { timeline: DayTimeline }) {
  // One entry per row (colour), so two tasks with the same title stay apart.
  const tasks = new Map<
    number,
    { label: string; detail: string; minutes: number }
  >();
  for (const s of timeline.segments) {
    if (s.kind !== "work") continue;
    const entry = tasks.get(s.colorIndex) ?? {
      label: s.label,
      detail: s.detail,
      minutes: 0,
    };
    entry.minutes += Math.max(s.end - s.start, 0);
    tasks.set(s.colorIndex, entry);
  }
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-gray-600 dark:text-gray-300">
      {[...tasks].map(([colorIndex, t]) => (
        <li
          key={colorIndex}
          className="flex min-w-0 items-center gap-1.5"
          title={t.detail}
        >
          <LegendDot
            className={
              WORK_CLASSES[colorIndex % WORK_CLASSES.length] ?? WORK_CLASSES[0]!
            }
          />
          <span className="max-w-[16rem] truncate font-semibold">
            {t.label}
          </span>
          <span>{formatMinutes(t.minutes)}</span>
        </li>
      ))}
      {timeline.permissionMinutes > 0 ? (
        <li className="flex items-center gap-1.5">
          <LegendDot className={PERMISSION_CLASS} />
          <span className="font-semibold">Permission</span>
          <span>{formatMinutes(timeline.permissionMinutes)}</span>
        </li>
      ) : null}
      {timeline.pausedMinutes > 0 ? (
        <li
          className="flex items-center gap-1.5"
          title="A task was paused and no other task was running"
        >
          <LegendDot className={PAUSED_CLASS} style={GAP_STRIPES} />
          <span className="font-semibold">Paused</span>
          <span>{formatMinutes(timeline.pausedMinutes)}</span>
        </li>
      ) : null}
      {timeline.noTaskMinutes > 0 ? (
        <li
          className="flex items-center gap-1.5"
          title="No task timer was running"
        >
          <LegendDot className={NO_TASK_CLASS} style={GAP_STRIPES} />
          <span className="font-semibold">No active task</span>
          <span>{formatMinutes(timeline.noTaskMinutes)}</span>
        </li>
      ) : null}
      {timeline.checkIn !== null ? (
        <li className="flex items-center gap-1.5">
          <LegendDot className="bg-success-600" />
          <span>In {clockOf(timeline.checkIn)}</span>
        </li>
      ) : null}
      <li className="flex items-center gap-1.5">
        <LegendDot className="bg-rose-600" />
        <span>
          {timeline.checkOut !== null
            ? `Out ${clockOf(timeline.checkOut)}`
            : timeline.checkIn !== null
              ? "Not checked out"
              : "No punches"}
        </span>
      </li>
      {timeline.now !== null ? (
        <li className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="inline-block h-3 border-l-2 border-dashed border-brand-600 dark:border-brand-400"
          />
          <span>Now {clockOf(timeline.now)}</span>
        </li>
      ) : null}
      {timeline.untimedMinutes > 0 ? (
        <li className="text-gray-400 dark:text-gray-500">
          + {formatMinutes(timeline.untimedMinutes)} logged without clock times
        </li>
      ) : null}
    </ul>
  );
}

/** `Worked 5h of 8h` under the bar. */
function DayFigures({ timeline }: { timeline: DayTimeline }) {
  return (
    <p className="text-xs text-gray-500 dark:text-gray-400">
      {timeline.dayStatus !== null ? (
        <span
          className={`mr-2 rounded-md px-1.5 py-0.5 text-[11px] font-bold ${DAY_STATUS[timeline.dayStatus].className}`}
        >
          {DAY_STATUS[timeline.dayStatus].label}
        </span>
      ) : null}
      <span className="font-bold text-gray-900 dark:text-white">
        {formatMinutes(timeline.workMinutes + timeline.untimedMinutes)}
      </span>{" "}
      worked
      {timeline.targetMinutes !== null
        ? ` of ${formatMinutes(timeline.targetMinutes)} target`
        : ""}
      {timeline.permissionMinutes > 0
        ? ` · ${formatMinutes(timeline.permissionMinutes)} permission`
        : ""}
      {timeline.pausedMinutes > 0
        ? ` · ${formatMinutes(timeline.pausedMinutes)} paused`
        : ""}
      {timeline.noTaskMinutes > 0
        ? ` · ${formatMinutes(timeline.noTaskMinutes)} with no active task`
        : ""}
    </p>
  );
}

type TimelineMode = "day" | "week";
const MODES: readonly SegmentOption<TimelineMode>[] = [
  { id: "day", label: "Day" },
  { id: "week", label: "Week" },
];

/**
 * Log Work's timeline card: the selected day as one bar, or its week as a
 * worksheet (one bar per day on a shared time scale). A week day opens in the
 * day view.
 */
export function WorkTimelineCard({
  day,
  onOpenDay,
}: {
  day: MyTimesheetDay;
  onOpenDay: (date: string) => void;
}) {
  const [mode, setMode] = useState<TimelineMode>("day");
  const timeline = useMemo(() => buildDayTimeline(day, new Date()), [day]);

  return (
    <section
      aria-labelledby="ts-timeline"
      className="rounded-2xl border border-gray-200/80 bg-white p-4 dark:border-gray-800 dark:bg-gray-900"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3
            id="ts-timeline"
            className="text-sm font-bold text-gray-900 dark:text-white"
          >
            Timeline
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Check-in to check-out in IST: time on each task, paused tasks,
            permissions and time with no active task.
          </p>
        </div>
        <SpringGlideSegmentedControl
          options={MODES}
          value={mode}
          onChange={setMode}
          ariaLabel="Timeline range"
        />
      </div>
      {mode === "day" ? (
        <div className="flex flex-col gap-3">
          <TimelineBar
            timeline={timeline}
            axisStart={timeline.axisStart}
            axisEnd={timeline.axisEnd}
          />
          <DayFigures timeline={timeline} />
          <TimelineLegend timeline={timeline} />
        </div>
      ) : (
        <WeekWorksheet date={day.date} onOpenDay={onOpenDay} />
      )}
    </section>
  );
}

function WeekWorksheet({
  date,
  onOpenDay,
}: {
  date: string;
  onOpenDay: (date: string) => void;
}) {
  const today = businessToday();
  // Future days are loaded too: a planned holiday, weekly off or leave is
  // already known (nothing else is shown ahead of the day).
  const dates = weekDates(weekStartOf(date));
  const queries = useMyDays(dates);
  const now = new Date();
  const loaded = new Map<string, DayTimeline>();
  queries.forEach((q, i) => {
    const d = dates[i];
    if (d && q.data) loaded.set(d, buildDayTimeline(q.data, now));
  });
  const axis = sharedAxis([...loaded.values()]);

  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-col gap-2">
        {dates.map((d) => {
          const timeline = loaded.get(d);
          const future = d > today;
          const loading = !timeline;
          const showBar =
            timeline !== undefined && (!future || timeline.dayStatus !== null);
          return (
            <li
              key={d}
              className="grid grid-cols-[6.5rem_1fr_4.5rem] items-center gap-3"
            >
              <button
                type="button"
                onClick={() => onOpenDay(d)}
                disabled={future}
                className={`text-left text-xs font-semibold ${d === date ? "text-brand-600 dark:text-brand-400" : "text-gray-700 dark:text-gray-200"} hover:underline disabled:cursor-not-allowed disabled:text-gray-400 disabled:no-underline`}
                aria-label={`Open ${formatShortDate(d)} in the day view`}
              >
                {new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", {
                  weekday: "short",
                  timeZone: "UTC",
                })}{" "}
                {formatShortDate(d)}
              </button>
              {loading ? (
                <Skeleton className="h-5 w-full rounded-lg" />
              ) : showBar ? (
                <TimelineBar
                  timeline={timeline}
                  axisStart={axis.start}
                  axisEnd={axis.end}
                  compact
                  showTicks={false}
                />
              ) : (
                <div className="h-5 w-full rounded-lg border border-dashed border-gray-200 dark:border-gray-700" />
              )}
              <span className="text-right text-xs font-bold text-gray-900 dark:text-white">
                {timeline && !future
                  ? formatMinutes(
                      timeline.workMinutes + timeline.untimedMinutes,
                    )
                  : "—"}
              </span>
            </li>
          );
        })}
      </ul>
      {/* One time scale under the whole week. */}
      <div className="grid grid-cols-[6.5rem_1fr_4.5rem] gap-3">
        <span />
        <TimelineHours axisStart={axis.start} axisEnd={axis.end} />
        <span />
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        Week total{" "}
        <span className="font-bold text-gray-900 dark:text-white">
          {formatMinutes(
            [...loaded.values()].reduce(
              (n, t) => n + t.workMinutes + t.untimedMinutes,
              0,
            ),
          )}
        </span>
        . Choose a day to open it.
      </p>
    </div>
  );
}

function TimelineHours({
  axisStart,
  axisEnd,
}: {
  axisStart: number;
  axisEnd: number;
}) {
  const span = Math.max(axisEnd - axisStart, 1);
  const hours: number[] = [];
  for (let m = axisStart; m <= axisEnd; m += 120) hours.push(m);
  return (
    <div className="relative h-4 w-full text-[10px] text-gray-400 dark:text-gray-500">
      {hours.map((m, i) => (
        <span
          key={m}
          className={`absolute whitespace-nowrap ${i === 0 ? "" : i === hours.length - 1 ? "-translate-x-full" : "-translate-x-1/2"}`}
          style={{ left: `${((m - axisStart) / span) * 100}%` }}
        >
          {hourOf(m)}
        </span>
      ))}
    </div>
  );
}
