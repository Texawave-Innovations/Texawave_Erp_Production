"use client";

import { Fragment } from "react";
import { Clock, LogIn, LogOut, X } from "lucide-react";
import type { AttendanceDayView } from "@/features/hr/attendance/types";
import {
  DAY_TYPE_STYLE,
  breakMs,
  dayTypeOf,
  msToHM,
  time12,
  workedMs,
  type DayKind,
} from "../attendance-utils";

const KIND_BANNER: Partial<Record<DayKind, { label: string; cls: string }>> = {
  absent: {
    label: "Absent",
    cls: "bg-red-100 text-red-800 border-red-300 dark:bg-red-900/40 dark:text-red-300 dark:border-red-800",
  },
  half: {
    label: "Half Day",
    cls: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-800",
  },
  leave: {
    label: "Leave",
    cls: "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-800",
  },
  holiday: {
    label: "Holiday",
    cls: "bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-900/40 dark:text-purple-300 dark:border-purple-800",
  },
  weekoff: {
    label: "Week Off",
    cls: "bg-gray-100 text-gray-700 border-gray-300 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700",
  },
};

/**
 * Slide-in day detail (legacy MyAttendance.tsx DayDetailPanel): every
 * check-in / check-out pair with its duration, the break between sessions,
 * and a bottom summary — day status, first check-in, last check-out, break
 * time and total hours. (Punch locations are not shown: this ERP's check-in
 * API records no GPS position.)
 */
export function DayDetailPanel({
  dateStr,
  row,
  kind,
  now,
  onClose,
}: {
  dateStr: string;
  row: AttendanceDayView | null;
  kind: DayKind;
  now: number;
  onClose: () => void;
}) {
  const sessions = row?.sessions ?? [];
  const worked = workedMs(row, now);
  const brk = breakMs(sessions);
  const firstIn = sessions[0] ? time12(sessions[0].checkInAt) : "—";
  const lastClosed = [...sessions].reverse().find((s) => s.checkOutAt);
  const lastOut = lastClosed?.checkOutAt ? time12(lastClosed.checkOutAt) : "—";
  const date = new Date(`${dateStr}T00:00:00`);
  const isPast = dateStr < new Intl.DateTimeFormat("en-CA").format(new Date());
  const banner = KIND_BANNER[kind];
  const dayType = dayTypeOf(worked);

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/20"
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`Attendance on ${dateStr}`}
        className="fixed right-0 top-0 z-50 flex h-full w-full max-w-[440px] flex-col border-l border-gray-200 bg-white shadow-2xl sm:w-[30%] sm:min-w-[350px] dark:border-gray-800 dark:bg-gray-900"
      >
        <div className="flex items-start justify-between border-b border-gray-200 px-5 py-4 dark:border-gray-800">
          <div>
            <p className="text-sm font-bold text-gray-900 dark:text-white">
              {new Intl.DateTimeFormat("en-IN", {
                weekday: "short",
                day: "2-digit",
                month: "short",
                year: "numeric",
              }).format(date)}
            </p>
            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
              General (10:00 AM – 7:00 PM)
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-7 w-7 items-center justify-center rounded-full transition-colors hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-brand-500 dark:hover:bg-gray-800"
          >
            <X className="h-4 w-4 text-gray-500" aria-hidden="true" />
          </button>
        </div>

        <div className="flex items-center justify-between border-b border-amber-200/80 bg-amber-50/60 px-5 py-2.5 dark:border-amber-900/50 dark:bg-amber-950/30">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 animate-pulse rounded-full bg-amber-500" />
            <span className="text-xs font-bold text-amber-900 dark:text-amber-200">
              Break Time Taken: {brk > 0 ? msToHM(brk) : "0 mins"}
            </span>
          </div>
          <span className="rounded-full border border-amber-300/60 bg-amber-100/80 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
            {sessions.length > 1
              ? `${sessions.length - 1} break ${sessions.length - 1 === 1 ? "session" : "sessions"}`
              : "No active break"}
          </span>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {sessions.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <Clock
                className="mb-3 h-10 w-10 text-gray-300 dark:text-gray-600"
                aria-hidden="true"
              />
              <p className="text-sm text-gray-500">No attendance recorded</p>
            </div>
          ) : (
            <div>
              <div className="mb-3 grid grid-cols-2 gap-3">
                <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-500">
                  <span className="h-2 w-2 rounded-full bg-green-500" /> Check
                  In
                </p>
                <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-500">
                  <span className="h-2 w-2 rounded-full bg-rose-400" /> Check
                  Out
                </p>
              </div>
              {sessions.map((s, i) => {
                const next = sessions[i + 1];
                const gap =
                  next && s.checkOutAt
                    ? Date.parse(next.checkInAt) - Date.parse(s.checkOutAt)
                    : 0;
                return (
                  <Fragment key={s.id}>
                    <div className="grid grid-cols-2 gap-3 border-b border-gray-100 py-3 last:border-0 dark:border-gray-800">
                      <div className="flex items-center gap-2">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/40">
                          <LogIn
                            className="h-3.5 w-3.5 text-green-600"
                            aria-hidden="true"
                          />
                        </span>
                        <div>
                          <span className="text-sm font-bold text-gray-900 dark:text-white">
                            {time12(s.checkInAt)}
                          </span>
                          {s.source !== "SELF" ? (
                            <p className="text-[10px] font-semibold text-sky-600">
                              {s.source === "CORRECTION"
                                ? "Regularized"
                                : s.source === "IMPORT"
                                  ? "Imported"
                                  : "Set by HR"}
                            </p>
                          ) : null}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {s.checkOutAt ? (
                          <>
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/40">
                              <LogOut
                                className="h-3.5 w-3.5 text-rose-500"
                                aria-hidden="true"
                              />
                            </span>
                            <div>
                              <span className="text-sm font-bold text-gray-900 dark:text-white">
                                {time12(s.checkOutAt)}
                              </span>
                              <p className="text-[10px] text-gray-500">
                                {msToHM(
                                  Date.parse(s.checkOutAt) -
                                    Date.parse(s.checkInAt),
                                )}
                              </p>
                            </div>
                          </>
                        ) : isPast ? (
                          <div className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-2">
                              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-amber-300 bg-amber-100">
                                <LogOut
                                  className="h-3.5 w-3.5 text-amber-700"
                                  aria-hidden="true"
                                />
                              </span>
                              <span className="text-sm font-bold text-amber-800">
                                Missing
                              </span>
                            </div>
                            <span className="text-[10px] font-semibold text-amber-700">
                              No check-out (requires Regularization)
                            </span>
                          </div>
                        ) : (
                          <>
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-amber-200 bg-amber-50">
                              <span className="h-2 w-2 animate-pulse rounded-full bg-amber-400" />
                            </span>
                            <span className="text-sm font-medium text-amber-600">
                              Active
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    {gap > 0 && next && s.checkOutAt ? (
                      <div className="my-2 flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-1.5 dark:border-amber-900/50 dark:bg-amber-950/30">
                        <span className="flex items-center gap-1.5 text-[11px] font-bold text-amber-900 dark:text-amber-200">
                          <Clock
                            className="h-3 w-3 text-amber-600"
                            aria-hidden="true"
                          />
                          Break Duration: {msToHM(gap)}
                        </span>
                        <span className="font-mono text-[10px] text-amber-700">
                          {time12(s.checkOutAt)} → {time12(next.checkInAt)}
                        </span>
                      </div>
                    ) : null}
                  </Fragment>
                );
              })}
            </div>
          )}
        </div>

        <div className="space-y-3 border-t border-gray-200 bg-gray-50 px-5 py-3 dark:border-gray-800 dark:bg-gray-800/40">
          {banner ? (
            <div
              className={`flex items-center justify-between rounded-lg border px-3 py-2 font-bold ${banner.cls}`}
            >
              <span className="flex items-center gap-2 text-xs">
                <span className="h-2.5 w-2.5 rounded-full bg-current opacity-60" />
                {banner.label}
              </span>
              <span className="text-[10px]">
                {worked > 0 ? `Worked ${msToHM(worked)}` : ""}
              </span>
            </div>
          ) : dayType ? (
            <div
              className={`flex items-center justify-between rounded-lg border px-3 py-2 ${DAY_TYPE_STYLE[dayType]}`}
            >
              <span className="flex items-center gap-2 text-xs">
                <span
                  className={`h-2.5 w-2.5 rounded-full ${dayType === "Full Day" ? "bg-green-500" : dayType === "Half Day" ? "bg-amber-400" : "bg-red-400"}`}
                />
                {dayType}
              </span>
              <span className="text-[10px]">
                {dayType === "Full Day"
                  ? "≥ 7.5 hrs worked"
                  : dayType === "Half Day"
                    ? "≥ 4 hrs"
                    : "< 4 hrs"}
              </span>
            </div>
          ) : null}
          <div className="grid grid-cols-4 gap-2">
            <div>
              <p className="text-[10px] text-gray-500">First Check-In</p>
              <p className="mt-0.5 text-xs font-bold text-gray-900 dark:text-white">
                {firstIn}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-gray-500">Last Check-Out</p>
              <p className="mt-0.5 text-xs font-bold text-gray-900 dark:text-white">
                {lastOut}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-medium text-amber-600">
                Break Time
              </p>
              <p className="mt-0.5 text-xs font-bold text-amber-700">
                {brk > 0 ? msToHM(brk) : "0m"}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-gray-500">Total Hours</p>
              <p className="mt-0.5 text-xs font-bold text-gray-900 dark:text-white">
                {worked > 0 ? msToHM(worked) : "—"}
              </p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
