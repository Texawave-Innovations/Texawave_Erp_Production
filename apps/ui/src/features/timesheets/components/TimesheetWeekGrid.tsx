"use client";

import { useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { businessToday } from "@texawave-erp/core";
import {
  Button,
  EmptyState,
  ErrorState,
  Input,
  Skeleton,
} from "@texawave-erp/ui-kit";
import { useDayReport } from "../hooks";
import type { DayWorkflowStatus, ReviewDaySummary } from "../types";
import {
  buildWeekGrid,
  cellStateLabel,
  isOpenable,
  shiftDate,
  weekStartOf,
} from "../week-grid";
import { formatMinutes } from "./MyTimesheetView";

// Literal class maps (never interpolated) so Tailwind keeps every class.
const STATE_BOX: Record<DayWorkflowStatus, string> = {
  DRAFT:
    "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-200",
  SUBMITTED:
    "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-200",
  APPROVED:
    "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200",
  REJECTED:
    "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200",
};
const STATE_DOT: Record<DayWorkflowStatus, string> = {
  DRAFT: "bg-slate-400",
  SUBMITTED: "bg-sky-500",
  APPROVED: "bg-emerald-500",
  REJECTED: "bg-amber-500",
};
const LEGEND: { status: DayWorkflowStatus; label: string }[] = [
  { status: "DRAFT", label: "Draft (not submitted)" },
  { status: "SUBMITTED", label: "Submitted" },
  { status: "APPROVED", label: "Approved" },
  { status: "REJECTED", label: "Returned" },
];

/** `2026-11-16` -> `Mon` / `16 Nov` (calendar date, no time zone shift). */
function dayHeading(date: string) {
  const d = new Date(`${date}T00:00:00Z`);
  return {
    weekday: d.toLocaleDateString("en-IN", {
      timeZone: "UTC",
      weekday: "short",
    }),
    short: d.toLocaleDateString("en-IN", {
      timeZone: "UTC",
      day: "numeric",
      month: "short",
    }),
    weekend: d.getUTCDay() === 0 || d.getUTCDay() === 6,
  };
}

function rangeLabel(start: string) {
  const fmt = (date: string, withYear: boolean) =>
    new Date(`${date}T00:00:00Z`).toLocaleDateString("en-IN", {
      timeZone: "UTC",
      day: "numeric",
      month: "short",
      ...(withYear ? { year: "numeric" } : {}),
    });
  return `${fmt(start, false)} – ${fmt(shiftDate(start, 6), true)}`;
}

function Cell({
  day,
  onOpen,
}: {
  day: ReviewDaySummary;
  onOpen: (day: ReviewDaySummary) => void;
}) {
  const state = cellStateLabel(day);
  const body = (
    <>
      <span className="flex items-center justify-between gap-1">
        <span className="text-sm font-bold">
          {formatMinutes(day.totalMinutes)}
        </span>
        {day.needsAttention ? (
          <AlertTriangle
            className="h-3.5 w-3.5 text-amber-600 dark:text-amber-300"
            aria-label="A timer on this day needs a look"
          />
        ) : null}
      </span>
      <span className="mt-0.5 flex items-center gap-1 text-[10px] font-semibold leading-tight">
        <span
          className={`h-1.5 w-1.5 shrink-0 rounded-full ${STATE_DOT[day.status]}`}
        />
        {state}
      </span>
      {day.customMinutes > 0 ? (
        <span className="mt-0.5 block text-[10px] opacity-80">
          incl. {formatMinutes(day.customMinutes)} other
        </span>
      ) : null}
    </>
  );
  const label = `${day.employee.name}, ${day.date}: ${formatMinutes(day.totalMinutes)}, ${state}`;
  const base = `block w-full rounded-lg border px-2 py-1.5 text-left ${STATE_BOX[day.status]}`;
  return isOpenable(day) ? (
    <button
      type="button"
      onClick={() => onOpen(day)}
      aria-label={label}
      title="Open this day"
      className={`${base} transition hover:ring-2 hover:ring-brand-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500`}
    >
      {body}
    </button>
  ) : (
    <div
      role="group"
      aria-label={label}
      title="Not submitted yet, so there is nothing to review"
      className={base}
    >
      {body}
    </div>
  );
}

/**
 * The week at a glance: people down the side, Monday to Sunday across, the
 * hours worked in each cell coloured by where that day is in review, with row
 * and column totals. Built from the API's day report (the same data, reach and
 * limits as the Report tab); a day with no work has no cell, and days after
 * today are blank because time can only be recorded for today or the past.
 * Submitted, approved and returned days open in the review dialog; a draft has
 * nothing to review yet.
 */
export function TimesheetWeekGrid({
  onOpen,
}: {
  onOpen: (day: ReviewDaySummary) => void;
}) {
  const today = businessToday();
  const thisWeek = weekStartOf(today);
  const [start, setStart] = useState(thisWeek);
  const end = shiftDate(start, 6);
  const { data, isLoading, isError, refetch } = useDayReport({
    from: start,
    to: end,
  });

  const grid = buildWeekGrid(start, data?.days ?? []);

  return (
    <section aria-label="Weekly timesheet grid" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="secondary"
          aria-label="Previous week"
          onClick={() => setStart(shiftDate(start, -7))}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h2 className="min-w-44 text-center text-base font-bold text-gray-900 dark:text-white">
          {rangeLabel(start)}
        </h2>
        <Button
          size="sm"
          variant="secondary"
          aria-label="Next week"
          onClick={() => setStart(shiftDate(start, 7))}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => setStart(thisWeek)}
          disabled={start === thisWeek}
        >
          <CalendarDays className="h-3.5 w-3.5" />
          This week
        </Button>
        <Input
          type="date"
          aria-label="Jump to the week of"
          value={start}
          onChange={(e) => {
            if (e.target.value) setStart(weekStartOf(e.target.value));
          }}
          className="w-44"
        />
      </div>

      <ul
        aria-label="Legend"
        className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-600 dark:text-gray-300"
      >
        {LEGEND.map((item) => (
          <li key={item.status} className="flex items-center gap-1.5">
            <span
              className={`h-2 w-2 rounded-full ${STATE_DOT[item.status]}`}
            />
            {item.label}
            {data ? (
              <span className="font-semibold">
                · {grid.stateCounts[item.status]}
              </span>
            ) : null}
          </li>
        ))}
        {grid.needsAttentionDays > 0 ? (
          <li className="flex items-center gap-1.5 text-amber-700 dark:text-amber-300">
            <AlertTriangle className="h-3.5 w-3.5" />
            {grid.needsAttentionDays} need a look
          </li>
        ) : null}
      </ul>

      {isLoading ? (
        <Skeleton className="h-48 w-full rounded-2xl" />
      ) : isError ? (
        <ErrorState
          title="Could not load the week"
          onRetry={() => void refetch()}
        />
      ) : grid.rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white py-6 dark:border-gray-800 dark:bg-gray-900">
          <EmptyState
            title="No work recorded this week"
            description="People appear here once they have time on a day of this week. Try another week."
          />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
          <table className="w-full min-w-[960px] border-collapse text-left text-sm">
            <thead className="border-b border-gray-200 text-xs font-bold uppercase tracking-wide text-gray-500 dark:border-gray-800 dark:text-gray-400">
              <tr>
                <th scope="col" className="px-4 py-3">
                  Employee
                </th>
                {grid.dates.map((date) => {
                  const h = dayHeading(date);
                  const isToday = date === today;
                  return (
                    <th
                      key={date}
                      scope="col"
                      className={`px-2 py-3 text-center ${
                        isToday ? "text-brand-700 dark:text-cyan-300" : ""
                      } ${h.weekend ? "bg-slate-50/70 dark:bg-slate-800/30" : ""}`}
                    >
                      <span className="block">{h.weekday}</span>
                      <span className="block text-[11px] font-semibold normal-case tracking-normal">
                        {h.short}
                        {isToday ? " · today" : ""}
                      </span>
                    </th>
                  );
                })}
                <th scope="col" className="px-4 py-3 text-right">
                  Week
                </th>
              </tr>
            </thead>
            <tbody>
              {grid.rows.map((row) => (
                <tr
                  key={row.employee.id}
                  className="border-b border-gray-100 last:border-0 dark:border-gray-800"
                >
                  <th scope="row" className="px-4 py-3 align-top font-normal">
                    <p className="font-semibold text-gray-900 dark:text-white">
                      {row.employee.name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {row.employee.code} · {row.employee.team}
                    </p>
                  </th>
                  {grid.dates.map((date) => {
                    const cell = row.cells[date];
                    const future = date > today;
                    const weekend = dayHeading(date).weekend;
                    return (
                      <td
                        key={date}
                        className={`px-1.5 py-2 align-top ${
                          weekend ? "bg-slate-50/70 dark:bg-slate-800/30" : ""
                        }`}
                      >
                        {cell ? (
                          <Cell day={cell} onOpen={onOpen} />
                        ) : (
                          <span
                            className="block py-2 text-center text-gray-300 dark:text-gray-600"
                            title={
                              future
                                ? "A future day: time cannot be recorded yet"
                                : "No work recorded"
                            }
                          >
                            –
                          </span>
                        )}
                      </td>
                    );
                  })}
                  <td className="px-4 py-3 text-right align-top">
                    <p className="font-bold text-gray-900 dark:text-white">
                      {formatMinutes(row.totalMinutes)}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {row.dayCount} {row.dayCount === 1 ? "day" : "days"}
                    </p>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t border-gray-200 bg-gray-50/60 text-xs font-bold dark:border-gray-800 dark:bg-gray-800/30">
              <tr>
                <th
                  scope="row"
                  className="px-4 py-3 text-left uppercase tracking-wide text-gray-500 dark:text-gray-400"
                >
                  Team total
                </th>
                {grid.dates.map((date) => (
                  <td
                    key={date}
                    className="px-2 py-3 text-center text-gray-900 dark:text-white"
                  >
                    {grid.dayTotals[date]
                      ? formatMinutes(grid.dayTotals[date]!)
                      : "–"}
                  </td>
                ))}
                <td className="px-4 py-3 text-right text-sm text-gray-900 dark:text-white">
                  {formatMinutes(grid.weekTotalMinutes)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </section>
  );
}
