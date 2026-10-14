"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ApiError } from "@texawave-erp/core";
import {
  Alert,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  Select,
  Skeleton,
} from "@texawave-erp/ui-kit";
import { StatCard } from "@/features/hr/components/StatCard";
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
    "border-success-200 bg-success-50 dark:border-success-900 dark:bg-success-950/40",
  error:
    "border-error-200 bg-error-50 dark:border-error-900 dark:bg-error-950/40",
  warning:
    "border-warning-200 bg-warning-50 dark:border-warning-900 dark:bg-warning-950/40",
  brand:
    "border-brand-200 bg-brand-50 dark:border-brand-900 dark:bg-brand-950/40",
  gray: "border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-800/40",
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
    <div className="flex flex-col gap-4">
      <Card>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr_auto] md:items-center">
          <Input
            aria-label="Find employee"
            placeholder="Find employee by name or code…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
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
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Input
              type="month"
              aria-label="Month"
              value={month}
              max={currentMonth()}
              onChange={(e) => e.target.value && setMonth(e.target.value)}
              className="w-40"
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              aria-label="Next month"
              disabled={isCurrent}
              onClick={() => setMonth(shiftMonth(month, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>

      {employeeId === null ? (
        <Card>
          <EmptyState
            title="Choose an employee"
            description="Pick someone to see their month as a calendar, with totals and each day's punches."
          />
        </Card>
      ) : statuses.isPending || records.isPending ? (
        <Skeleton className="h-96 w-full" />
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
        <Card>
          <EmptyState
            title="No month to show"
            description="This employee is not active, or was not employed in this month."
          />
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-5">
            <StatCard
              headingId="em-present"
              label="Present"
              value={count("PRESENT")}
              note={`Half days: ${count("HALF_DAY")}`}
              tone="success"
            />
            <StatCard
              headingId="em-absent"
              label="Absent"
              value={count("ABSENT")}
              note={`Not marked: ${count("NOT_MARKED")}`}
              tone="error"
            />
            <StatCard
              headingId="em-leave"
              label="On leave"
              value={count("ON_LEAVE")}
              note={`Holidays: ${count("HOLIDAY")} · Off: ${count("WEEKLY_OFF")}`}
              tone="brand"
            />
            <StatCard
              headingId="em-worked"
              label="Hours worked"
              value={formatMinutes(totals.worked)}
              note={row.monthComplete ? "Whole month" : "Month so far"}
              tone="neutral"
            />
            <StatCard
              headingId="em-ot"
              label="Overtime"
              value={formatMinutes(totals.overtime)}
              note="Beyond the shift target"
              tone="info"
            />
          </div>

          <Card>
            <div
              className="grid grid-cols-7 gap-1.5"
              role="grid"
              aria-label={`Attendance calendar for ${month}`}
            >
              {WEEKDAYS.map((d) => (
                <div
                  key={d}
                  role="columnheader"
                  className="pb-1 text-center text-theme-xs font-semibold text-gray-500 dark:text-gray-400"
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
                  : "border-dashed border-gray-200 dark:border-gray-800";
                return (
                  <button
                    key={date}
                    type="button"
                    role="gridcell"
                    aria-selected={selectedDay === date}
                    aria-label={`${date}: ${status ? STATUS_LABELS[status] : "Upcoming"}`}
                    disabled={!status}
                    onClick={() => setSelectedDay(date)}
                    className={`flex min-h-16 flex-col items-start gap-0.5 rounded-lg border p-1.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-brand-500 disabled:cursor-default ${tone} ${selectedDay === date ? "ring-2 ring-brand-500" : ""}`}
                  >
                    <span className="text-theme-xs font-semibold text-gray-800 dark:text-gray-200">
                      {Number(date.slice(8))}
                    </span>
                    {status ? (
                      <span className="hidden text-[11px] text-gray-600 sm:block dark:text-gray-400">
                        {STATUS_LABELS[status]}
                      </span>
                    ) : null}
                    {record && record.workedMinutes > 0 ? (
                      <span className="font-mono text-[11px] text-gray-500">
                        {formatMinutes(record.workedMinutes)}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </Card>

          {selectedDay ? (
            <Card>
              <h3 className="text-theme-sm font-semibold text-gray-900 dark:text-white">
                {selectedDay} ·{" "}
                {STATUS_LABELS[statusByDate.get(selectedDay) ?? "NOT_MARKED"]}
              </h3>
              {selectedRecord && selectedRecord.sessions.length > 0 ? (
                <div className="mt-3 flex flex-col gap-3">
                  <DayTimeline sessions={selectedRecord.sessions} />
                  <ul className="flex flex-col gap-1 text-theme-xs text-gray-700 dark:text-gray-300">
                    {selectedRecord.sessions.map((s) => (
                      <li key={s.id} className="font-mono">
                        {formatTime(s.checkInAt)} →{" "}
                        {s.checkOutAt ? formatTime(s.checkOutAt) : "open"}
                        <span className="ml-2 font-sans text-gray-500">
                          ({s.source.toLowerCase()})
                        </span>
                      </li>
                    ))}
                  </ul>
                  <p className="text-theme-xs text-gray-600 dark:text-gray-400">
                    Worked {formatMinutes(selectedRecord.workedMinutes)}
                    {selectedRecord.overtimeMinutes > 0
                      ? ` · overtime ${formatMinutes(selectedRecord.overtimeMinutes)}`
                      : ""}
                    {selectedRecord.shortfallMinutes > 0
                      ? ` · short ${formatMinutes(selectedRecord.shortfallMinutes)}`
                      : ""}
                  </p>
                </div>
              ) : (
                <p className="mt-2 text-theme-xs text-gray-500 dark:text-gray-400">
                  No punches recorded.
                </p>
              )}
            </Card>
          ) : null}
        </>
      )}
    </div>
  );
}
