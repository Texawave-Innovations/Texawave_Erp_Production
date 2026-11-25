"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, Download } from "lucide-react";
import { businessToday } from "@texawave-erp/core";
import {
  Button,
  EmptyState,
  ErrorState,
  Input,
  Select,
  Skeleton,
} from "@texawave-erp/ui-kit";
import { useNotify } from "@/hooks/useNotify";
import { usePermission } from "@/hooks/usePermission";
import { downloadReportCsv } from "../api";
import { useEmployeeMonth, useEmployeeReport } from "../hooks";
import { REVIEW_EXPORT_ANY_SCOPE } from "../permissions";
import type { EmployeeReportLine } from "../types";
import { AttendanceMonthView } from "./AttendanceMonthView";
import { formatMinutes } from "./format";

/** First day of the month that holds `date` (`YYYY-MM-DD`). */
function monthStart(date: string): string {
  return `${date.slice(0, 7)}-01`;
}

type Person = EmployeeReportLine["employee"];

/** Sums of the numeric columns over the lines in view (the team's totals). */
function totalsOf(lines: readonly EmployeeReportLine[]) {
  return lines.reduce(
    (t, l) => ({
      daysRecorded: t.daysRecorded + l.daysRecorded,
      taskMinutes: t.taskMinutes + l.taskMinutes,
      customMinutes: t.customMinutes + l.customMinutes,
      totalMinutes: t.totalMinutes + l.totalMinutes,
      targetMinutes: t.targetMinutes + l.targetMinutes,
      permissionMinutes: t.permissionMinutes + l.permissionMinutes,
      attendanceMinutes: t.attendanceMinutes + l.attendanceMinutes,
      notSubmittedDays: t.notSubmittedDays + l.notSubmittedDays,
      submittedDays: t.submittedDays + l.submittedDays,
      approvedDays: t.approvedDays + l.approvedDays,
      returnedDays: t.returnedDays + l.returnedDays,
    }),
    {
      daysRecorded: 0,
      taskMinutes: 0,
      customMinutes: 0,
      totalMinutes: 0,
      targetMinutes: 0,
      permissionMinutes: 0,
      attendanceMinutes: 0,
      notSubmittedDays: 0,
      submittedDays: 0,
      approvedDays: 0,
      returnedDays: 0,
    },
  );
}

/** One employee's month, opened from the report: back to the report, an
 * employee picker, and the same month view the employee sees. */
function EmployeeDrillDown({
  employee,
  people,
  initialMonth,
  onSelect,
  onBack,
  onOpenDay,
}: {
  employee: Person;
  people: readonly Person[];
  initialMonth: string;
  onSelect: (id: number) => void;
  onBack: () => void;
  onOpenDay: (employeeId: number, date: string) => void;
}) {
  const [month, setMonth] = useState(initialMonth);
  const query = useEmployeeMonth(employee.id, month);
  return (
    <div className="flex flex-col gap-4" data-testid="employee-drilldown">
      <div className="flex flex-wrap items-center gap-3">
        <Button size="sm" variant="secondary" onClick={onBack}>
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to report
        </Button>
        <div className="min-w-0">
          <p className="text-base font-extrabold text-gray-900 dark:text-white">
            {employee.name}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {employee.code} · {employee.team}
          </p>
        </div>
        <Select
          aria-label="Switch employee"
          value={String(employee.id)}
          onChange={(e) => onSelect(Number(e.target.value))}
          className="ml-auto w-64"
        >
          {people.map((p) => (
            <option key={p.id} value={String(p.id)}>
              {p.name} ({p.code})
            </option>
          ))}
        </Select>
      </div>
      <AttendanceMonthView
        month={month}
        onMonthChange={setMonth}
        data={query.data}
        isLoading={query.isLoading}
        isError={query.isError}
        onRetry={() => void query.refetch()}
        onOpenDay={(date) => onOpenDay(employee.id, date)}
      />
    </div>
  );
}

/**
 * Per-employee report over a date range: recorded hours (tasks and other
 * activities), the shift target after approved permissions, the permission and
 * attendance hours, and how many days are not submitted, submitted, approved or
 * returned. A team filter narrows the people and the totals row follows it.
 * Opening an employee shows their month (attendance, check-in/out, permissions
 * and logged time); a day opens the day review. The API scopes the people to
 * the caller's `hr.timesheet.read` reach and caps a range at 62 days. CSV
 * downloads need the export permission.
 */
export function TimesheetReport({
  onOpenDay,
}: {
  /** Opens one employee-day (the parent owns the review dialog). */
  onOpenDay: (employeeId: number, date: string) => void;
}) {
  const today = businessToday();
  const [from, setFrom] = useState(monthStart(today));
  const [to, setTo] = useState(today);
  const [team, setTeam] = useState("ALL");
  const [openId, setOpenId] = useState<number | null>(null);
  const canExport = usePermission(REVIEW_EXPORT_ANY_SCOPE);
  const { notifyError } = useNotify();
  const [downloading, setDownloading] = useState<"employees" | "days" | null>(
    null,
  );

  const valid = from !== "" && to !== "" && from <= to;
  const { data, isLoading, isError, error, refetch } = useEmployeeReport(
    valid ? { from, to } : null,
  );

  const lines = useMemo(() => data?.lines ?? [], [data]);
  const teams = useMemo(
    () => [...new Set(lines.map((l) => l.employee.team))].sort(),
    [lines],
  );
  const visible = useMemo(
    () =>
      team === "ALL" ? lines : lines.filter((l) => l.employee.team === team),
    [lines, team],
  );
  const totals = useMemo(() => totalsOf(visible), [visible]);
  const opened = lines.find((l) => l.employee.id === openId)?.employee ?? null;

  async function download(kind: "employees" | "days") {
    setDownloading(kind);
    try {
      await downloadReportCsv(kind, { from, to });
    } catch (err) {
      notifyError(err, "timesheets.report.downloadFailed");
    } finally {
      setDownloading(null);
    }
  }

  if (opened) {
    return (
      <section aria-label="Timesheet report" className="flex flex-col gap-4">
        <EmployeeDrillDown
          key={opened.id}
          employee={opened}
          people={(team === "ALL" ? lines : visible).map((l) => l.employee)}
          initialMonth={to.slice(0, 7)}
          onSelect={setOpenId}
          onBack={() => setOpenId(null)}
          onOpenDay={onOpenDay}
        />
      </section>
    );
  }

  return (
    <section aria-label="Timesheet report" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs font-semibold text-gray-600 dark:text-gray-300">
          From
          <Input
            type="date"
            aria-label="Report from"
            value={from}
            max={to || undefined}
            onChange={(e) => setFrom(e.target.value)}
            className="w-44"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-gray-600 dark:text-gray-300">
          To
          <Input
            type="date"
            aria-label="Report to"
            value={to}
            min={from || undefined}
            onChange={(e) => setTo(e.target.value)}
            className="w-44"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-gray-600 dark:text-gray-300">
          Team
          <Select
            aria-label="Filter by team"
            value={team}
            onChange={(e) => setTeam(e.target.value)}
            className="w-48"
          >
            <option value="ALL">All teams</option>
            {teams.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </Select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-gray-600 dark:text-gray-300">
          Employee
          <Select
            aria-label="Open an employee"
            value=""
            onChange={(e) => {
              if (e.target.value) setOpenId(Number(e.target.value));
            }}
            className="w-64"
          >
            <option value="">Open an employee…</option>
            {visible.map((l) => (
              <option key={l.employee.id} value={String(l.employee.id)}>
                {l.employee.name} ({l.employee.code})
              </option>
            ))}
          </Select>
        </label>
        {canExport ? (
          <div className="ml-auto flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => void download("employees")}
              loading={downloading === "employees"}
              disabled={!valid || downloading !== null}
            >
              <Download className="h-3.5 w-3.5" />
              CSV by employee
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => void download("days")}
              loading={downloading === "days"}
              disabled={!valid || downloading !== null}
            >
              <Download className="h-3.5 w-3.5" />
              CSV by day
            </Button>
          </div>
        ) : null}
      </div>

      {!valid ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Choose a start date that is not after the end date.
        </p>
      ) : isLoading ? (
        <Skeleton className="h-40 w-full rounded-2xl" />
      ) : isError ? (
        <ErrorState
          title="Could not load the report"
          {...(error instanceof Error && error.message
            ? { description: error.message }
            : {})}
          onRetry={() => void refetch()}
        />
      ) : visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white py-6 dark:border-gray-800 dark:bg-gray-900">
          <EmptyState
            title="No timesheets in this range"
            description="Days with recorded work appear here, one line per employee."
          />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
          <table className="w-full min-w-[1040px] text-left text-sm">
            <thead className="border-b border-gray-200 text-xs font-bold uppercase tracking-wide text-gray-500 dark:border-gray-800 dark:text-gray-400">
              <tr>
                <th className="px-4 py-3">Employee</th>
                <th className="px-3 py-3 text-right">Days</th>
                <th className="px-3 py-3 text-right">Task time</th>
                <th className="px-3 py-3 text-right">Other</th>
                <th className="px-3 py-3 text-right">Logged</th>
                <th
                  className="px-3 py-3 text-right"
                  title="Shift target after approved permissions"
                >
                  Target
                </th>
                <th className="px-3 py-3 text-right">Permission</th>
                <th
                  className="px-3 py-3 text-right"
                  title="Minutes HR attendance counts as worked"
                >
                  Attendance
                </th>
                <th className="px-3 py-3 text-right">Not submitted</th>
                <th className="px-3 py-3 text-right">Submitted</th>
                <th className="px-3 py-3 text-right">Approved</th>
                <th className="px-3 py-3 text-right">Returned</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((line) => (
                <tr
                  key={line.employee.id}
                  className="border-b border-gray-100 last:border-0 dark:border-gray-800"
                >
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => setOpenId(line.employee.id)}
                      className="text-left font-semibold text-brand-700 underline-offset-2 hover:underline dark:text-cyan-300"
                      aria-label={`Open ${line.employee.name}`}
                    >
                      {line.employee.name}
                    </button>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {line.employee.code} · {line.employee.team}
                    </p>
                  </td>
                  <td className="px-3 py-3 text-right">{line.daysRecorded}</td>
                  <td className="px-3 py-3 text-right">
                    {formatMinutes(line.taskMinutes)}
                  </td>
                  <td className="px-3 py-3 text-right">
                    {formatMinutes(line.customMinutes)}
                  </td>
                  <td className="px-3 py-3 text-right font-bold">
                    {formatMinutes(line.totalMinutes)}
                  </td>
                  <td className="px-3 py-3 text-right">
                    {line.targetMinutes > 0
                      ? formatMinutes(line.targetMinutes)
                      : "—"}
                  </td>
                  <td className="px-3 py-3 text-right">
                    {line.permissionMinutes > 0
                      ? formatMinutes(line.permissionMinutes)
                      : "—"}
                  </td>
                  <td className="px-3 py-3 text-right">
                    {formatMinutes(line.attendanceMinutes)}
                  </td>
                  <td className="px-3 py-3 text-right">
                    {line.notSubmittedDays}
                  </td>
                  <td className="px-3 py-3 text-right">{line.submittedDays}</td>
                  <td className="px-3 py-3 text-right">{line.approvedDays}</td>
                  <td className="px-3 py-3 text-right">{line.returnedDays}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr
                data-testid="report-totals"
                className="border-t border-gray-200 bg-gray-50 text-sm font-bold text-gray-900 dark:border-gray-800 dark:bg-gray-900/60 dark:text-white"
              >
                <td className="px-4 py-3">
                  {team === "ALL" ? "All teams" : team} · {visible.length}{" "}
                  {visible.length === 1 ? "person" : "people"}
                </td>
                <td className="px-3 py-3 text-right">{totals.daysRecorded}</td>
                <td className="px-3 py-3 text-right">
                  {formatMinutes(totals.taskMinutes)}
                </td>
                <td className="px-3 py-3 text-right">
                  {formatMinutes(totals.customMinutes)}
                </td>
                <td className="px-3 py-3 text-right">
                  {formatMinutes(totals.totalMinutes)}
                </td>
                <td className="px-3 py-3 text-right">
                  {totals.targetMinutes > 0
                    ? formatMinutes(totals.targetMinutes)
                    : "—"}
                </td>
                <td className="px-3 py-3 text-right">
                  {totals.permissionMinutes > 0
                    ? formatMinutes(totals.permissionMinutes)
                    : "—"}
                </td>
                <td className="px-3 py-3 text-right">
                  {formatMinutes(totals.attendanceMinutes)}
                </td>
                <td className="px-3 py-3 text-right">
                  {totals.notSubmittedDays}
                </td>
                <td className="px-3 py-3 text-right">{totals.submittedDays}</td>
                <td className="px-3 py-3 text-right">{totals.approvedDays}</td>
                <td className="px-3 py-3 text-right">{totals.returnedDays}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </section>
  );
}
