"use client";

import { useMemo, useState } from "react";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  Search,
  TrendingUp,
  UserCheck,
  UserX,
} from "lucide-react";
import { ApiError } from "@texawave-erp/core";
import {
  Alert,
  Button,
  EmptyState,
  ErrorState,
  Input,
  Select,
  Skeleton,
  cn,
} from "@texawave-erp/ui-kit";
import { useEmployees } from "@/features/hr/employees/hooks";
import { useAttendanceList, useEmployeeMonthStatuses } from "../hooks";
import {
  formatMinutes,
  formatTime,
  STATUS_COLOR,
  STATUS_LABELS,
} from "../status";
import type { AttendanceDayView, EffectiveStatus } from "../types";
import { DayTimeline } from "./DayTimeline";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function currentMonth(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" })
    .format(new Date())
    .slice(0, 7);
}

function shiftMonth(month: string, by: number): string {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const d = new Date(Date.UTC(y, m - 1 + by, 1));
  return d.toISOString().slice(0, 7);
}

function lastDay(month: string): string {
  const [y, m] = month.split("-").map(Number) as [number, number];
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}

const CELL_TONE: Record<
  "brand" | "gray" | "success" | "warning" | "error",
  string
> = {
  success:
    "border-emerald-200/90 bg-emerald-50/70 hover:bg-emerald-100/80 dark:border-emerald-900/50 dark:bg-emerald-950/40 text-emerald-950 dark:text-emerald-100",
  error:
    "border-rose-200/90 bg-rose-50/70 hover:bg-rose-100/80 dark:border-rose-900/50 dark:bg-rose-950/40 text-rose-950 dark:text-rose-100",
  warning:
    "border-amber-200/90 bg-amber-50/70 hover:bg-amber-100/80 dark:border-amber-900/50 dark:bg-amber-950/40 text-amber-950 dark:text-amber-100",
  brand:
    "border-sky-200/90 bg-sky-50/70 hover:bg-sky-100/80 dark:border-sky-900/50 dark:bg-sky-950/40 text-sky-950 dark:text-sky-100",
  gray: "border-slate-200/80 bg-slate-50/60 hover:bg-slate-100/70 dark:border-slate-800 dark:bg-slate-800/40 text-slate-800 dark:text-slate-200",
};

/**
 * One employee, one month (legacy Attendance → Monthly / Weekly): a calendar
 * of the derived status of every day so far, month totals, and each day's
 * punches. Statuses come from the full-month-present report (which derives
 * unmarked, holiday, weekly-off and leave days); hours come from the stored
 * records. Both are read in the caller's own scope.
 */
export function EmployeeMonthTab() {
  const [month, setMonth] = useState(currentMonth());
  const [employeeId, setEmployeeId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const employees = useEmployees({
    page: 1,
    limit: 100,
    ...(search.trim() ? { search: search.trim() } : {}),
  });
  const from = `${month}-01`;
  const to = lastDay(month);
  const statuses = useEmployeeMonthStatuses(month, employeeId);
  const records = useAttendanceList(
    { page: 1, limit: 100, from, to, ...(employeeId ? { employeeId } : {}) },
    employeeId !== null,
  );

  const recordByDate = useMemo(() => {
    const map = new Map<string, AttendanceDayView>();
    for (const r of records.data?.data ?? []) map.set(r.attendanceDate, r);
    return map;
  }, [records.data]);

  const row = statuses.data?.data[0] ?? null;
  const statusByDate = useMemo(
    () => new Map((row?.days ?? []).map((d) => [d.attendanceDate, d.status])),
    [row],
  );

  const totals = useMemo(() => {
    let worked = 0;
    let overtime = 0;
    for (const r of recordByDate.values()) {
      worked += r.workedMinutes;
      overtime += r.overtimeMinutes;
    }
    return { worked, overtime };
  }, [recordByDate]);

  // Calendar cells: blanks before the 1st so weeks start on Monday.
  const cells = useMemo(() => {
    const first = new Date(`${from}T00:00:00Z`);
    const lead = (first.getUTCDay() + 6) % 7;
    const days = Number(to.slice(8, 10));
    const out: (string | null)[] = Array.from({ length: lead }, () => null);
    for (let d = 1; d <= days; d += 1)
      out.push(`${month}-${String(d).padStart(2, "0")}`);
    return out;
  }, [from, to, month]);

  const selectedRecord = selectedDay
    ? recordByDate.get(selectedDay)
    : undefined;
  const count = (s: EffectiveStatus) => row?.countsByStatus[s] ?? 0;
  const isCurrent = month >= currentMonth();

  return (
    <div className="flex flex-col gap-5">
      {/* Executive Control Toolbar */}
      <div className="relative z-20 focus-within:z-30 rounded-2xl border border-sky-100/90 bg-white/95 p-4 shadow-2xs backdrop-blur-md dark:border-sky-950/40 dark:bg-gray-900/90">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr_auto] md:items-center">
          <div className="relative">
            <Input
              aria-label="Find employee"
              placeholder="Find employee by name or code…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          </div>

          <Select
            aria-label="Employee"
            value={employeeId ?? ""}
            onChange={(e) => {
              setEmployeeId(e.target.value ? Number(e.target.value) : null);
              setSelectedDay(null);
            }}
          >
            <option value="">Choose an employee…</option>
            {(employees.data?.data ?? []).map((e) => (
              <option key={e.id} value={e.id}>
                {e.fullName} ({e.employeeCode})
              </option>
            ))}
          </Select>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              aria-label="Previous month"
              onClick={() => setMonth(shiftMonth(month, -1))}
              className="h-9 px-2.5"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Input
              type="month"
              aria-label="Month"
              value={month}
              max={currentMonth()}
              onChange={(e) => e.target.value && setMonth(e.target.value)}
              className="w-40 font-semibold"
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              aria-label="Next month"
              disabled={isCurrent}
              onClick={() => setMonth(shiftMonth(month, 1))}
              className="h-9 px-2.5"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {employeeId === null ? (
        <div className="rounded-2xl border border-sky-100/90 bg-white/95 p-8 shadow-2xs backdrop-blur-md dark:border-sky-950/40 dark:bg-gray-900/90">
          <EmptyState
            title="Choose an employee"
            description="Pick someone to see their month as a calendar, with totals and each day's punches."
          />
        </div>
      ) : statuses.isPending || records.isPending ? (
        <Skeleton className="h-96 w-full rounded-2xl" />
      ) : statuses.isError || records.isError ? (
        (statuses.error ?? records.error) instanceof ApiError &&
        ((statuses.error ?? records.error) as ApiError).isPermissionError ? (
          <Alert variant="warning" title="You can't view this employee's month">
            This needs both the attendance read and attendance report
            permissions for their team.
          </Alert>
        ) : (
          <ErrorState
            onRetry={() => {
              void statuses.refetch();
              void records.refetch();
            }}
          />
        )
      ) : !row ? (
        <div className="rounded-2xl border border-sky-100/90 bg-white/95 p-8 shadow-2xs backdrop-blur-md dark:border-sky-950/40 dark:bg-gray-900/90">
          <EmptyState
            title="No month to show"
            description="This employee is not active, or was not employed in this month."
          />
        </div>
      ) : (
        <>
          {/* Executive KPI Summary Tiles */}
          <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-5">
            {/* Present */}
            <div className="flex items-center justify-between rounded-2xl border border-emerald-200/80 bg-linear-to-r from-[#f0fdf4] to-[#ecfdf5] p-3.5 shadow-xs dark:border-emerald-900/40 dark:from-slate-900 dark:to-slate-800">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                  Present
                </p>
                <h3 className="mt-1 text-2xl font-extrabold text-emerald-800 dark:text-white">
                  {count("PRESENT")}
                </h3>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  Half days: {count("HALF_DAY")}
                </p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-emerald-300/80 bg-white text-emerald-600 shadow-xs dark:border-emerald-800 dark:bg-slate-800 dark:text-emerald-300">
                <UserCheck className="h-5 w-5" />
              </div>
            </div>

            {/* Absent */}
            <div className="flex items-center justify-between rounded-2xl border border-rose-200/80 bg-linear-to-r from-[#fff1f2] to-[#fff5f5] p-3.5 shadow-xs dark:border-rose-900/40 dark:from-slate-900 dark:to-slate-800">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-rose-800 dark:text-rose-300">
                  Absent
                </p>
                <h3 className="mt-1 text-2xl font-extrabold text-rose-800 dark:text-white">
                  {count("ABSENT")}
                </h3>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  Not marked: {count("NOT_MARKED")}
                </p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-rose-300/80 bg-white text-rose-600 shadow-xs dark:border-rose-800 dark:bg-slate-800 dark:text-rose-300">
                <UserX className="h-5 w-5" />
              </div>
            </div>

            {/* On Leave */}
            <div className="flex items-center justify-between rounded-2xl border border-sky-200/80 bg-linear-to-r from-[#edf6ff] to-[#f0f8ff] p-3.5 shadow-xs dark:border-sky-900/40 dark:from-slate-900 dark:to-slate-800">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#0a3271] dark:text-sky-300">
                  On Leave
                </p>
                <h3 className="mt-1 text-2xl font-extrabold text-[#0a3271] dark:text-white">
                  {count("ON_LEAVE")}
                </h3>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  Off: {count("WEEKLY_OFF")} · Hol: {count("HOLIDAY")}
                </p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-sky-300/80 bg-white text-brand-500 shadow-xs dark:border-sky-800 dark:bg-slate-800 dark:text-sky-300">
                <Calendar className="h-5 w-5" />
              </div>
            </div>

            {/* Hours Worked */}
            <div className="flex items-center justify-between rounded-2xl border border-slate-200/80 bg-linear-to-r from-slate-50 to-slate-100/70 p-3.5 shadow-xs dark:border-slate-800 dark:from-slate-900 dark:to-slate-800">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Hours Worked
                </p>
                <h3 className="mt-1 text-2xl font-extrabold text-slate-900 dark:text-white">
                  {formatMinutes(totals.worked)}
                </h3>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  {row.monthComplete ? "Whole month" : "Month so far"}
                </p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-300/80 bg-white text-slate-700 shadow-xs dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300">
                <Clock className="h-5 w-5" />
              </div>
            </div>

            {/* Overtime */}
            <div className="flex items-center justify-between rounded-2xl border border-amber-200/80 bg-linear-to-r from-[#fffbeb] to-[#fef3c7] p-3.5 shadow-xs dark:border-amber-900/40 dark:from-slate-900 dark:to-slate-800">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">
                  Overtime
                </p>
                <h3 className="mt-1 text-2xl font-extrabold text-amber-800 dark:text-white">
                  {formatMinutes(totals.overtime)}
                </h3>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  Beyond shift target
                </p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-amber-300/80 bg-white text-amber-600 shadow-xs dark:border-amber-800 dark:bg-slate-800 dark:text-amber-300">
                <TrendingUp className="h-5 w-5" />
              </div>
            </div>
          </div>

          {/* Calendar Grid Card */}
          <div className="rounded-2xl border border-sky-100/90 bg-white/95 p-5 shadow-2xs backdrop-blur-md dark:border-sky-950/40 dark:bg-gray-900/90">
            <div
              className="grid grid-cols-7 gap-2"
              role="grid"
              aria-label={`Attendance calendar for ${month}`}
            >
              {WEEKDAYS.map((d) => (
                <div
                  key={d}
                  role="columnheader"
                  className="pb-1.5 text-center text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider"
                >
                  {d}
                </div>
              ))}
              {cells.map((date, i) => {
                if (!date) return <div key={`blank-${i}`} aria-hidden />;
                const status = statusByDate.get(date);
                const record = recordByDate.get(date);
                const tone = status
                  ? CELL_TONE[STATUS_COLOR[status]]
                  : "border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/30";
                return (
                  <button
                    key={date}
                    type="button"
                    role="gridcell"
                    aria-selected={selectedDay === date}
                    aria-label={`${date}: ${status ? STATUS_LABELS[status] : "Upcoming"}`}
                    disabled={!status}
                    onClick={() => setSelectedDay(date)}
                    className={cn(
                      "flex min-h-16 flex-col items-start gap-1 rounded-xl border p-2 text-left transition-all cursor-pointer",
                      "focus-visible:outline-2 focus-visible:outline-brand-500 disabled:cursor-default",
                      tone,
                      selectedDay === date ? "ring-2 ring-[#1769F5] shadow-xs scale-101" : "hover:shadow-2xs",
                    )}
                  >
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      {Number(date.slice(8))}
                    </span>
                    {status ? (
                      <span className="hidden text-[10.5px] font-medium text-slate-600 sm:block dark:text-slate-300">
                        {STATUS_LABELS[status]}
                      </span>
                    ) : null}
                    {record && record.workedMinutes > 0 ? (
                      <span className="text-[10.5px] font-semibold text-slate-600 dark:text-slate-400">
                        {formatMinutes(record.workedMinutes)}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected Day Details Card */}
          {selectedDay ? (
            <div className="rounded-2xl border border-sky-100/90 bg-white/95 p-5 shadow-2xs backdrop-blur-md dark:border-sky-950/40 dark:bg-gray-900/90">
              <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
                <h3 className="text-theme-sm font-bold text-gray-900 dark:text-white">
                  {selectedDay} ·{" "}
                  <span className="text-brand-600 dark:text-brand-400 font-semibold">
                    {STATUS_LABELS[statusByDate.get(selectedDay) ?? "NOT_MARKED"]}
                  </span>
                </h3>
                {selectedRecord && (
                  <span className="text-theme-xs font-medium text-gray-500 dark:text-gray-400">
                    Worked {formatMinutes(selectedRecord.workedMinutes)}
                    {selectedRecord.overtimeMinutes > 0
                      ? ` · OT +${formatMinutes(selectedRecord.overtimeMinutes)}`
                      : ""}
                    {selectedRecord.shortfallMinutes > 0
                      ? ` · Short -${formatMinutes(selectedRecord.shortfallMinutes)}`
                      : ""}
                  </span>
                )}
              </div>

              {selectedRecord && selectedRecord.sessions.length > 0 ? (
                <div className="mt-4 flex flex-col gap-3.5">
                  <DayTimeline sessions={selectedRecord.sessions} />
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                    {selectedRecord.sessions.map((s, idx) => (
                      <div
                        key={s.id}
                        className="flex items-center justify-between p-2.5 rounded-xl border border-gray-100 bg-gray-50/60 dark:border-gray-800 dark:bg-gray-800/40 text-theme-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-50 text-[10px] font-bold text-brand-700 dark:bg-brand-950 dark:text-brand-300">
                            {idx + 1}
                          </span>
                          <span className="font-semibold text-gray-800 dark:text-gray-200">
                            {formatTime(s.checkInAt)} →{" "}
                            {s.checkOutAt ? formatTime(s.checkOutAt) : (
                              <span className="text-emerald-600 dark:text-emerald-400 font-bold">Open</span>
                            )}
                          </span>
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 bg-white dark:bg-gray-900 px-1.5 py-0.5 rounded border border-gray-200/80 dark:border-gray-700">
                          {s.source.toLowerCase()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="mt-3 text-theme-xs text-gray-500 dark:text-gray-400">
                  No punches recorded for this date.
                </p>
              )}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

