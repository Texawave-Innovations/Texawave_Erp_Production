"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Eye, Pencil, Search } from "lucide-react";
import { ApiError } from "@texawave-erp/core";
import {
  Alert,
  Button,
  Card,
  DataTable,
  EmptyState,
  ErrorState,
  Input,
  Pagination,
} from "@texawave-erp/ui-kit";
import { usePermission } from "@/hooks/usePermission";
import { useRegionalFormatter } from "@/features/settings/preferences/hooks";
import { EmployeeIdentity } from "@/features/hr/components/EmployeeIdentity";
import { TableSkeleton } from "@/features/hr/components/TableSkeleton";
import { useDailyReport } from "../hooks";
import { WRITE_ANY_SCOPE } from "../permissions";
import { formatMinutes, STATUS_LABELS } from "../status";
import type { DailyAttendanceRow, EffectiveStatus } from "../types";
import { AttendanceDetailDialog } from "./AttendanceDetailDialog";
import { AttendanceStatusBadge } from "./AttendanceStatusBadge";
import { DayTimeline } from "./DayTimeline";
import { ManualEditAttendanceDialog } from "./ManualEditAttendanceDialog";

const PAGE_SIZE = 100;

export function todayIst(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(
    new Date(),
  );
}

function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

type Bucket = "ALL" | "PRESENT" | "ABSENT" | "NOT_MARKED" | "AWAY";

const BUCKETS: {
  id: Bucket;
  label: string;
  matches: (s: EffectiveStatus) => boolean;
}[] = [
  { id: "ALL", label: "All", matches: () => true },
  {
    id: "PRESENT",
    label: "Present",
    matches: (s) => s === "PRESENT" || s === "HALF_DAY",
  },
  { id: "ABSENT", label: "Absent", matches: (s) => s === "ABSENT" },
  { id: "NOT_MARKED", label: "Not marked", matches: (s) => s === "NOT_MARKED" },
  {
    id: "AWAY",
    label: "Leave / off",
    matches: (s) => s === "ON_LEAVE" || s === "HOLIDAY" || s === "WEEKLY_OFF",
  },
];

/**
 * Daily roster (legacy Attendance → Daily): every employee in the caller's
 * report scope for one date, including those with no record yet, with the
 * derived status, first check-in, last check-out, a session timeline and the
 * hours worked. Data: GET /hr/attendance/reports/daily.
 */
export function DailyAttendanceTab() {
  const canWrite = usePermission(WRITE_ANY_SCOPE);
  const { formatTime: regionalFormatTime } = useRegionalFormatter();
  const [date, setDate] = useState(todayIst());
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [bucket, setBucket] = useState<Bucket>("ALL");
  const [detail, setDetail] = useState<DailyAttendanceRow | null>(null);
  const [editing, setEditing] = useState<DailyAttendanceRow | null>(null);

  const report = useDailyReport({ date, page, limit: PAGE_SIZE });
  const rows = useMemo(() => report.data?.data ?? [], [report.data]);

  const counts = useMemo(() => {
    const out = Object.fromEntries(BUCKETS.map((b) => [b.id, 0])) as Record<
      Bucket,
      number
    >;
    for (const r of rows) {
      for (const b of BUCKETS) if (b.matches(r.status)) out[b.id] += 1;
    }
    return out;
  }, [rows]);

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const matcher = BUCKETS.find((b) => b.id === bucket)!.matches;
    return rows.filter(
      (r) =>
        matcher(r.status) &&
        (needle === "" ||
          r.employee.fullName.toLowerCase().includes(needle) ||
          r.employee.employeeCode.toLowerCase().includes(needle)),
    );
  }, [rows, search, bucket]);

  function changeDate(next: string) {
    setDate(next);
    setPage(1);
  }

  const isToday = date === todayIst();
  const total = report.data?.meta.total ?? 0;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              aria-label="Previous day"
              onClick={() => changeDate(shiftDate(date, -1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Input
              type="date"
              aria-label="Roster date"
              value={date}
              max={todayIst()}
              onChange={(e) => e.target.value && changeDate(e.target.value)}
              className="w-44"
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              aria-label="Next day"
              disabled={isToday}
              onClick={() => changeDate(shiftDate(date, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            {!isToday ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => changeDate(todayIst())}
              >
                Today
              </Button>
            ) : null}
          </div>
          <div className="relative w-full lg:w-72">
            <Input
              aria-label="Search by name or code"
              placeholder="Search name or code…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          </div>
        </div>
        <div
          className="mt-3 flex flex-wrap gap-2"
          role="group"
          aria-label="Filter by status"
        >
          {BUCKETS.map((b) => (
            <button
              key={b.id}
              type="button"
              aria-pressed={bucket === b.id}
              onClick={() => setBucket(b.id)}
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-theme-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-brand-500 ${
                bucket === b.id
                  ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-950/60 dark:text-brand-300"
                  : "border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-800 dark:text-gray-400 dark:hover:bg-gray-800/50"
              }`}
            >
              {b.label}
              <span className="rounded-full bg-white px-1.5 font-mono text-[11px] text-gray-700 dark:bg-gray-900 dark:text-gray-300">
                {counts[b.id]}
              </span>
            </button>
          ))}
        </div>
        {total > PAGE_SIZE ? (
          <p className="mt-2 text-theme-xs text-gray-500 dark:text-gray-400">
            Counts, search and filters apply to the {PAGE_SIZE} employees on
            this page.
          </p>
        ) : null}
      </Card>

      {report.isPending ? (
        <TableSkeleton rowsCount={8} columnsCount={7} />
      ) : report.isError ? (
        report.error instanceof ApiError && report.error.isPermissionError ? (
          <Alert
            variant="warning"
            title="You don't have access to the daily roster"
          >
            Ask an administrator for the <code>hr.attendance_report.read</code>{" "}
            permission.
          </Alert>
        ) : (
          <ErrorState onRetry={() => void report.refetch()} />
        )
      ) : visible.length === 0 ? (
        <Card>
          <EmptyState
            title={
              rows.length === 0
                ? "No employees for this date"
                : "No one matches these filters"
            }
            description={
              rows.length === 0
                ? "Nobody in your scope was employed on this date."
                : "Clear the search or pick another status."
            }
          />
        </Card>
      ) : (
        <>
          <DataTable
            caption={`Attendance roster for ${date}`}
            rows={visible}
            getRowKey={(r) => `${r.employee.id}-${r.attendanceDate}`}
            columns={[
              {
                header: "Employee",
                cell: (r) => (
                  <EmployeeIdentity
                    name={r.employee.fullName}
                    code={r.employee.employeeCode}
                    avatarSize="sm"
                    size="sm"
                  />
                ),
              },
              {
                header: "Status",
                cell: (r) => <AttendanceStatusBadge status={r.status} />,
              },
              {
                header: "Check-in",
                cell: (r) => (
                  <span className="font-mono text-theme-xs text-gray-700 dark:text-gray-300">
                    {r.sessions[0]
                      ? regionalFormatTime(r.sessions[0].checkInAt)
                      : "—"}
                  </span>
                ),
              },
              {
                header: "Check-out",
                cell: (r) => {
                  const last = r.sessions[r.sessions.length - 1];
                  return (
                    <span className="font-mono text-theme-xs text-gray-700 dark:text-gray-300">
                      {r.hasOpenSession ? (
                        <span className="font-semibold text-brand-600 dark:text-brand-400">
                          Working
                        </span>
                      ) : last?.checkOutAt ? (
                        regionalFormatTime(last.checkOutAt)
                      ) : (
                        "—"
                      )}
                    </span>
                  );
                },
              },
              {
                header: "9 AM – 9 PM",
                cell: (r) => (
                  <DayTimeline sessions={r.sessions} className="w-40" />
                ),
              },
              {
                header: "Worked",
                cell: (r) => (
                  <span className="text-theme-xs">
                    <span className="font-medium text-gray-800 dark:text-gray-200">
                      {formatMinutes(r.workedMinutes)}
                    </span>
                    {r.overtimeMinutes > 0 ? (
                      <span className="ml-1.5 font-semibold text-success-700 dark:text-success-400">
                        +{formatMinutes(r.overtimeMinutes)}
                      </span>
                    ) : r.shortfallMinutes > 0 &&
                      r.status === "PRESENT" &&
                      !r.hasOpenSession ? (
                      <span className="ml-1.5 text-warning-700 dark:text-warning-400">
                        −{formatMinutes(r.shortfallMinutes)}
                      </span>
                    ) : null}
                  </span>
                ),
              },
              {
                header: "Actions",
                cell: (r) =>
                  r.recordId === null ? (
                    <span
                      className="text-theme-xs text-gray-400"
                      title="No record for this day yet"
                    >
                      {STATUS_LABELS[r.status] === "Not Marked"
                        ? "No record"
                        : "—"}
                    </span>
                  ) : (
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label={`Details for ${r.employee.fullName}`}
                        onClick={() => setDetail(r)}
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      {canWrite ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          aria-label={`Edit attendance for ${r.employee.fullName}`}
                          onClick={() => setEditing(r)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      ) : null}
                    </div>
                  ),
              },
            ]}
          />
          {report.data.meta.totalPages > 1 ? (
            <Pagination
              page={report.data.meta.page}
              totalPages={report.data.meta.totalPages}
              onPageChange={setPage}
            />
          ) : null}
        </>
      )}

      {detail?.recordId != null ? (
        <AttendanceDetailDialog
          open
          id={detail.recordId}
          canEdit={canWrite}
          employee={detail.employee}
          onClose={() => setDetail(null)}
          onEdit={() => {
            setEditing(detail);
            setDetail(null);
          }}
        />
      ) : null}
      {editing ? (
        <ManualEditAttendanceDialog
          open
          record={editing}
          employee={editing.employee}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </div>
  );
}
