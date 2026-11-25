"use client";

import { CalendarClock, Clock } from "lucide-react";
import { businessToday } from "@texawave-erp/core";
import {
  DataTable,
  EmptyState,
  ErrorState,
  Select,
  StatCard,
  StatusBadge,
  type DataTableColumn,
} from "@texawave-erp/ui-kit";
import { AttendanceStatusBadge } from "@/features/hr/attendance/components/AttendanceStatusBadge";
import type { EffectiveStatus } from "@/features/hr/attendance/types";
import { visibleMonthStatus } from "../month-status";
import type { EmployeeMonth, MonthDay } from "../types";
import {
  formatClock,
  formatMinutes,
  formatPermissionWindow,
  formatShortDate,
  weekdayShort,
} from "./format";
import { ReviewStatusChip } from "./ReviewStatus";

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** `2026-08` -> `{ year: 2026, monthNumber: 8 }`. */
function splitMonth(month: string) {
  return {
    year: Number(month.slice(0, 4)),
    monthNumber: Number(month.slice(5, 7)),
  };
}

/** The `YYYY-MM` that holds `date`, today's by default. */
export function currentMonth(): string {
  return businessToday().slice(0, 7);
}

/** Month and year pickers; `value` and the callback are `YYYY-MM`. */
export function MonthPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (month: string) => void;
}) {
  const { year, monthNumber } = splitMonth(value);
  const thisYear = Number(businessToday().slice(0, 4));
  const years = Array.from({ length: 6 }, (_, i) => thisYear - 4 + i);
  if (!years.includes(year)) years.push(year);
  years.sort((a, b) => a - b);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    <div className="flex items-center gap-2">
      <Select
        aria-label="Month"
        value={String(monthNumber)}
        onChange={(e) => onChange(`${year}-${pad(Number(e.target.value))}`)}
        className="w-40"
      >
        {MONTH_NAMES.map((name, i) => (
          <option key={name} value={String(i + 1)}>
            {name}
          </option>
        ))}
      </Select>
      <Select
        aria-label="Year"
        value={String(year)}
        onChange={(e) => onChange(`${e.target.value}-${pad(monthNumber)}`)}
        className="w-28"
      >
        {years.map((y) => (
          <option key={y} value={String(y)}>
            {y}
          </option>
        ))}
      </Select>
    </div>
  );
}

function Dash() {
  return <span className="text-gray-400">—</span>;
}

/** The shift target with the permission shown beside it, e.g. `6h` and
 * `8h − 2h permission`, so the reduction is never silent. */
function TargetCell({ day }: { day: MonthDay }) {
  if (day.targetMinutes === null) return <Dash />;
  return (
    <div>
      <span className="font-semibold text-gray-900 dark:text-white">
        {formatMinutes(day.targetMinutes)}
      </span>
      {day.permissionMinutes > 0 && day.baseTargetMinutes !== null ? (
        <p className="text-[11px] text-gray-500 dark:text-gray-400">
          {formatMinutes(day.baseTargetMinutes)} −{" "}
          {formatMinutes(day.permissionMinutes)}
        </p>
      ) : null}
    </div>
  );
}

function HoursCell({ day }: { day: MonthDay }) {
  if (day.workedMinutes <= 0) return <Dash />;
  const short =
    day.targetMinutes !== null &&
    day.targetMinutes > 0 &&
    day.workedMinutes < day.targetMinutes;
  return (
    <span
      className={`font-bold ${
        short
          ? "text-amber-600 dark:text-amber-400"
          : "text-emerald-700 dark:text-emerald-400"
      }`}
    >
      {formatMinutes(day.workedMinutes)}
    </span>
  );
}

function monthColumns(
  today: string,
  onOpenDay: ((date: string) => void) | undefined,
): DataTableColumn<MonthDay>[] {
  return [
    {
      header: "Date",
      cell: (d) => (
        <span className="font-semibold text-gray-900 dark:text-white">
          {formatShortDate(d.date)}
        </span>
      ),
    },
    { header: "Day", cell: (d) => weekdayShort(d.weekday) },
    {
      header: "Status",
      // A future day has no verdict yet; only a planned holiday, weekly off
      // or approved leave is shown ahead of the day.
      cell: (d) => {
        const status = visibleMonthStatus(d, today);
        return status === null ? (
          <Dash />
        ) : (
          <AttendanceStatusBadge status={status as EffectiveStatus} />
        );
      },
    },
    {
      header: "Check In",
      cell: (d) => (d.checkInAt ? formatClock(d.checkInAt) : <Dash />),
    },
    {
      header: "Check Out",
      cell: (d) =>
        d.checkOutAt ? (
          formatClock(d.checkOutAt)
        ) : d.checkInAt && d.date >= today ? (
          <span className="text-xs text-cyan-700 dark:text-cyan-300">
            Still in
          </span>
        ) : (
          <Dash />
        ),
    },
    { header: "Hours", cell: (d) => <HoursCell day={d} /> },
    { header: "Target", cell: (d) => <TargetCell day={d} /> },
    {
      header: "Permission",
      cell: (d) =>
        d.permissions.length > 0 ? (
          <div className="flex flex-col items-start gap-1">
            {d.permissions.map((p) => (
              <StatusBadge
                key={`${p.fromTime}-${p.toTime}`}
                colorToken="brand"
                label={`${formatPermissionWindow(p)} · ${formatMinutes(p.minutes)}`}
              />
            ))}
          </div>
        ) : (
          <Dash />
        ),
    },
    {
      header: "Logged",
      cell: (d) =>
        d.loggedMinutes > 0 ? formatMinutes(d.loggedMinutes) : <Dash />,
    },
    {
      header: "Timesheet",
      cell: (d) =>
        d.reviewStatus ? (
          <div className="flex items-center gap-2">
            <ReviewStatusChip status={d.reviewStatus} stage={null} />
            {onOpenDay !== undefined && d.rowCount > 0 ? (
              <button
                type="button"
                onClick={() => onOpenDay(d.date)}
                className="text-xs font-semibold text-brand-700 underline-offset-2 hover:underline dark:text-cyan-300"
                aria-label={`Open ${formatShortDate(d.date)}`}
              >
                Open
              </button>
            ) : null}
          </div>
        ) : (
          <Dash />
        ),
    },
  ];
}

/**
 * One employee's month: HR's attendance (status, check-in and out, hours, the
 * target after approved permissions) beside what was logged in the timesheet.
 * The employee's own Attendance tab and the reviewer's employee drill-down both
 * render this, so the two always read the same. `onOpenDay` makes a day with
 * logged work clickable (employee: jump to that day; reviewer: open the day).
 */
export function AttendanceMonthView({
  month,
  onMonthChange,
  data,
  isLoading,
  isError,
  onRetry,
  onOpenDay,
}: {
  month: string;
  onMonthChange: (month: string) => void;
  data: EmployeeMonth | undefined;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  onOpenDay?: ((date: string) => void) | undefined;
}) {
  const today = businessToday();
  const { year, monthNumber } = splitMonth(month);
  const title = `${MONTH_NAMES[monthNumber - 1] ?? ""} ${year}`;

  return (
    <section aria-label="Attendance" className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-bold text-gray-900 dark:text-white">
          {title} — Attendance
        </h2>
        <MonthPicker value={month} onChange={onMonthChange} />
      </div>

      {isError ? (
        <ErrorState title="Could not load the month" onRetry={onRetry} />
      ) : (
        <>
          {data ? (
            <div
              aria-label="Month summary"
              className="grid grid-cols-2 gap-4 lg:grid-cols-6"
            >
              <StatCard
                headingId="am-present"
                label="Present"
                value={data.summary.presentDays}
                note="Days worked (half days included)"
                tone="success"
              />
              <StatCard
                headingId="am-absent"
                label="Absent"
                value={data.summary.absentDays}
                note="Days marked absent"
                tone="error"
              />
              <StatCard
                headingId="am-leave"
                label="Leave"
                value={data.summary.leaveDays}
                note="Approved leave days"
                tone="amber"
              />
              <StatCard
                headingId="am-holiday"
                label="Holiday"
                value={data.summary.holidayDays}
                note="Company holidays"
                tone="info"
              />
              <StatCard
                headingId="am-permission"
                label="Permission"
                value={formatMinutes(data.summary.permissionMinutes)}
                note="Approved, taken off the target"
                tone="neutral"
                icon={CalendarClock}
              />
              <StatCard
                headingId="am-logged"
                label="Hrs Logged"
                value={formatMinutes(data.summary.loggedMinutes)}
                note={`HR counts ${formatMinutes(data.summary.workedMinutes)} worked`}
                tone="brand"
                icon={Clock}
              />
            </div>
          ) : null}

          <DataTable
            caption={`${title} attendance`}
            rows={data?.days ?? []}
            getRowKey={(d) => d.date}
            columns={monthColumns(today, onOpenDay)}
            loading={isLoading}
            loadingRowsCount={10}
            emptyState={<EmptyState title="Nothing to show for this month" />}
          />
        </>
      )}
    </section>
  );
}
