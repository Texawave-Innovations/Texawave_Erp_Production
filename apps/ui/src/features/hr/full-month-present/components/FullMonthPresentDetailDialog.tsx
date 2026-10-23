"use client";

import { useMemo } from "react";
import {
  Calendar,
  CheckCircle2,
  Clock,
  Trophy,
  XCircle,
  AlertCircle,
  ShieldCheck,
  User,
} from "lucide-react";
import { Button, Dialog } from "@texawave-erp/ui-kit";
import { EmployeeIdentity } from "@/features/hr/components/EmployeeIdentity";
import type { EffectiveStatus, FullMonthPresentRow } from "../types";
import { STATUS_LABELS } from "../status";

export interface FullMonthPresentDetailDialogProps {
  open: boolean;
  onClose: () => void;
  row: FullMonthPresentRow;
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const STATUS_STYLES: Record<
  EffectiveStatus,
  { bg: string; text: string; border: string; dot: string; label: string }
> = {
  PRESENT: {
    bg: "bg-emerald-50 dark:bg-emerald-950/40",
    text: "text-emerald-800 dark:text-emerald-300",
    border: "border-emerald-200 dark:border-emerald-800/60",
    dot: "bg-emerald-500",
    label: "Present",
  },
  ABSENT: {
    bg: "bg-rose-50 dark:bg-rose-950/40",
    text: "text-rose-800 dark:text-rose-300",
    border: "border-rose-200 dark:border-rose-800/60",
    dot: "bg-rose-500",
    label: "Absent",
  },
  HALF_DAY: {
    bg: "bg-amber-50 dark:bg-amber-950/40",
    text: "text-amber-800 dark:text-amber-300",
    border: "border-amber-200 dark:border-amber-800/60",
    dot: "bg-amber-500",
    label: "Half Day",
  },
  HOLIDAY: {
    bg: "bg-sky-50 dark:bg-sky-950/40",
    text: "text-sky-800 dark:text-sky-300",
    border: "border-sky-200 dark:border-sky-800/60",
    dot: "bg-sky-500",
    label: "Holiday",
  },
  WEEKLY_OFF: {
    bg: "bg-slate-50 dark:bg-slate-800/50",
    text: "text-slate-700 dark:text-slate-300",
    border: "border-slate-200 dark:border-slate-700/60",
    dot: "bg-slate-400",
    label: "Weekly Off",
  },
  ON_LEAVE: {
    bg: "bg-blue-50 dark:bg-blue-950/40",
    text: "text-blue-800 dark:text-blue-300",
    border: "border-blue-200 dark:border-blue-800/60",
    dot: "bg-blue-500",
    label: "On Leave",
  },
  NOT_MARKED: {
    bg: "bg-gray-50/80 dark:bg-gray-800/30",
    text: "text-gray-500 dark:text-gray-400",
    border: "border-dashed border-gray-200 dark:border-gray-700/60",
    dot: "bg-gray-300 dark:bg-gray-600",
    label: "Not Marked",
  },
};

/**
 * Executive Attendance Calendar Matrix & Qualification Drill-Down Dialog
 */
export function FullMonthPresentDetailDialog({
  open,
  onClose,
  row,
}: FullMonthPresentDetailDialogProps) {
  // Calendar Matrix computation (Mon-Sun)
  const { cells, monthTitle } = useMemo(() => {
    const parts = row.month.split("-").map(Number);
    const year = parts[0] ?? new Date().getFullYear();
    const monthNum = parts[1] ?? 1;

    const firstDay = new Date(Date.UTC(year, monthNum - 1, 1));
    const lead = (firstDay.getUTCDay() + 6) % 7; // Monday = 0
    const totalDays = new Date(Date.UTC(year, monthNum, 0)).getUTCDate();

    const result: (string | null)[] = Array.from({ length: lead }, () => null);
    for (let d = 1; d <= totalDays; d++) {
      result.push(`${row.month}-${String(d).padStart(2, "0")}`);
    }

    const monthName = firstDay.toLocaleString("en-US", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    });

    return { cells: result, monthTitle: monthName };
  }, [row.month]);

  // Fast date lookup map
  const statusByDate = useMemo(() => {
    return new Map(row.days.map((d) => [d.attendanceDate, d.status]));
  }, [row.days]);

  const absentCount = row.countsByStatus.ABSENT ?? 0;
  const halfDayCount = row.countsByStatus.HALF_DAY ?? 0;
  const leaveCount = row.countsByStatus.ON_LEAVE ?? 0;
  const offCount =
    (row.countsByStatus.WEEKLY_OFF ?? 0) + (row.countsByStatus.HOLIDAY ?? 0);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`${row.employee.fullName} — ${monthTitle}`}
      size="2xl"
      className="max-w-3xl"
    >
      <div className="flex flex-col gap-5">
        {/* Employee & Qualification Hero Banner */}
        <div
          className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl border transition-all ${
            row.fullMonthPresent
              ? "border-emerald-200/90 bg-linear-to-r from-emerald-50 via-teal-50/50 to-emerald-50/20 dark:border-emerald-900/60 dark:from-emerald-950/40 dark:to-teal-950/20"
              : "border-sky-100/90 bg-linear-to-r from-sky-50/60 via-slate-50 to-sky-50/20 dark:border-sky-950/40 dark:from-slate-900/60 dark:to-slate-800/40"
          }`}
        >
          <div className="flex items-center gap-3">
            <EmployeeIdentity
              name={row.employee.fullName}
              code={row.employee.employeeCode}
              avatarSize="md"
              size="md"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {row.fullMonthPresent ? (
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl border border-emerald-300/80 bg-white shadow-2xs dark:border-emerald-800 dark:bg-emerald-900/50">
                <Trophy className="h-4 w-4 text-emerald-600 dark:text-emerald-300" />
                <span className="text-theme-xs font-bold text-emerald-800 dark:text-emerald-200">
                  100% Full Month Present Qualified
                </span>
              </div>
            ) : (
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl border border-slate-200/80 bg-white shadow-2xs dark:border-slate-700 dark:bg-slate-800/80">
                <XCircle className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                <span className="text-theme-xs font-semibold text-slate-700 dark:text-slate-300">
                  Not Qualified
                </span>
              </div>
            )}
          </div>
        </div>

        {/* 4 Summary Counter Tiles */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="flex flex-col p-3 rounded-xl border border-emerald-100 bg-emerald-50/50 dark:border-emerald-950/40 dark:bg-emerald-950/20">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              Present Days
            </span>
            <span className="text-xl font-extrabold text-emerald-900 dark:text-emerald-200 mt-0.5">
              {row.presentDays}
            </span>
            <span className="text-[11px] text-emerald-600/80 dark:text-emerald-400/80">
              {row.days.length} days counted
            </span>
          </div>

          <div className="flex flex-col p-3 rounded-xl border border-rose-100 bg-rose-50/50 dark:border-rose-950/40 dark:bg-rose-950/20">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-rose-700 dark:text-rose-400">
              Absent
            </span>
            <span className="text-xl font-extrabold text-rose-900 dark:text-rose-200 mt-0.5">
              {absentCount}
            </span>
            <span className="text-[11px] text-rose-600/80 dark:text-rose-400/80">
              {absentCount === 0 ? "Zero absences" : "Days missed"}
            </span>
          </div>

          <div className="flex flex-col p-3 rounded-xl border border-amber-100 bg-amber-50/50 dark:border-amber-950/40 dark:bg-amber-950/20">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">
              Half Day / Leave
            </span>
            <span className="text-xl font-extrabold text-amber-900 dark:text-amber-200 mt-0.5">
              {halfDayCount + leaveCount}
            </span>
            <span className="text-[11px] text-amber-600/80 dark:text-amber-400/80">
              {halfDayCount} half · {leaveCount} leave
            </span>
          </div>

          <div className="flex flex-col p-3 rounded-xl border border-slate-200/80 bg-slate-50/60 dark:border-slate-800 dark:bg-slate-800/40">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
              Weekly Off / Hol
            </span>
            <span className="text-xl font-extrabold text-slate-800 dark:text-white mt-0.5">
              {offCount}
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              Non-working days
            </span>
          </div>
        </div>

        {/* Qualification Criteria Status Strip */}
        <div className="flex flex-wrap items-center gap-3 p-3 rounded-xl border border-slate-100 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-800/30 text-xs">
          <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
            <span className="font-semibold text-slate-700 dark:text-slate-200">
              Month Complete:
            </span>
            {row.monthComplete ? (
              <span className="inline-flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-3.5 w-3.5" /> Yes
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 font-semibold text-amber-600 dark:text-amber-400">
                <Clock className="h-3.5 w-3.5" /> In Progress
              </span>
            )}
          </div>
          <span className="text-slate-300 dark:text-slate-700">•</span>
          <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
            <span className="font-semibold text-slate-700 dark:text-slate-200">
              Employed Whole Month:
            </span>
            {row.employedWholeMonth ? (
              <span className="inline-flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-3.5 w-3.5" /> Yes
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 font-semibold text-rose-600 dark:text-rose-400">
                <XCircle className="h-3.5 w-3.5" /> No
              </span>
            )}
          </div>
        </div>

        {/* Monthly Calendar Matrix (Mon - Sun) */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-theme-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Calendar className="h-4 w-4 text-brand-500" />
              Monthly Attendance Matrix
            </h3>
            <span className="text-theme-xs font-medium text-slate-500 dark:text-slate-400">
              {row.days.length} days recorded in {monthTitle}
            </span>
          </div>

          <div className="rounded-2xl border border-sky-100/90 bg-white p-3.5 shadow-2xs dark:border-sky-950/40 dark:bg-gray-900">
            {/* Weekdays Header */}
            <div className="grid grid-cols-7 gap-1.5 mb-2">
              {WEEKDAYS.map((day) => (
                <div
                  key={day}
                  className="text-center text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 py-1"
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Cells */}
            <div className="grid grid-cols-7 gap-1.5">
              {cells.map((date, idx) => {
                if (!date) {
                  return (
                    <div
                      key={`blank-${idx}`}
                      className="min-h-12 rounded-xl bg-transparent"
                    />
                  );
                }

                const dayNum = Number(date.slice(8));
                const status = statusByDate.get(date);
                const style = status ? STATUS_STYLES[status] : null;

                return (
                  <div
                    key={date}
                    className={`flex flex-col items-center justify-center p-2 rounded-xl border text-center transition-all ${
                      style
                        ? `${style.bg} ${style.border}`
                        : "border-dashed border-slate-200 bg-slate-50/40 dark:border-slate-800 dark:bg-slate-800/20"
                    }`}
                  >
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      {dayNum}
                    </span>
                    {style ? (
                      <span
                        className={`text-[10px] font-semibold mt-0.5 truncate max-w-full ${style.text}`}
                      >
                        {style.label}
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                        —
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2 text-theme-xs text-slate-600 dark:text-slate-400">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
            <span>Present</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
            <span>Absent</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
            <span>Half Day</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-sky-500" />
            <span>Holiday</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-slate-400" />
            <span>Weekly Off</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
            <span>On Leave</span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-3 border-t border-gray-100 dark:border-gray-800">
          <Button type="button" variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
