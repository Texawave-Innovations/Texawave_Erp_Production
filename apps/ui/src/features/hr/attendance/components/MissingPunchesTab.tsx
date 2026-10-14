"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { ApiError } from "@texawave-erp/core";
import {
  Alert,
  Button,
  Card,
  DataTable,
  DateRangePicker,
  EmptyState,
  ErrorState,
  Pagination,
  Select,
  StatusBadge,
} from "@texawave-erp/ui-kit";
import { usePermission } from "@/hooks/usePermission";
import { EmployeeIdentity } from "@/features/hr/components/EmployeeIdentity";
import { TableSkeleton } from "@/features/hr/components/TableSkeleton";
import { useMissingPunches } from "../hooks";
import { WRITE_ANY_SCOPE } from "../permissions";
import { formatTime } from "../status";
import {
  MISSING_PUNCH_TYPES,
  type MissingPunchRow,
  type MissingPunchType,
} from "../types";
import { DayTimeline } from "./DayTimeline";
import { ManualEditAttendanceDialog } from "./ManualEditAttendanceDialog";
import { todayIst } from "./DailyAttendanceTab";

const TYPE_LABELS: Record<MissingPunchType, string> = {
  MISSING_CHECK_OUT: "No check-out",
  MISSING_CHECK_IN: "No check-in",
};

function daysAgo(n: number): string {
  const d = new Date(`${todayIst()}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

/**
 * Days that need fixing before a month can be closed: a session left open on
 * a past day, or a day marked present with no check-in
 * (GET /hr/attendance/reports/missing-punches). HR can fix each from here.
 */
export function MissingPunchesTab() {
  const canWrite = usePermission(WRITE_ANY_SCOPE);
  const [range, setRange] = useState({ from: daysAgo(30), to: todayIst() });
  const [type, setType] = useState<"" | MissingPunchType>("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<MissingPunchRow | null>(null);

  const valid = range.from !== "" && range.to !== "" && range.from <= range.to;
  const list = useMissingPunches(
    {
      page,
      limit: 50,
      from: range.from,
      to: range.to,
      ...(type ? { type } : {}),
    },
    valid,
  );

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:items-center">
          <DateRangePicker
            value={range}
            onChange={(r) => {
              setRange({ from: r.from, to: r.to });
              setPage(1);
            }}
            onClear={() => setRange({ from: daysAgo(30), to: todayIst() })}
            fromAriaLabel="From date"
            toAriaLabel="To date"
          />
          <Select
            aria-label="Missing punch type"
            value={type}
            onChange={(e) => {
              setType(e.target.value as "" | MissingPunchType);
              setPage(1);
            }}
          >
            <option value="">All missing punches</option>
            {MISSING_PUNCH_TYPES.map((t) => (
              <option key={t} value={t}>
                {TYPE_LABELS[t]}
              </option>
            ))}
          </Select>
        </div>
        <p className="mt-2 text-theme-xs text-gray-500 dark:text-gray-400">
          Employees are listed a page at a time; a page can show fewer rows than
          its size when only some of them have missing punches.
        </p>
      </Card>

      {!valid ? (
        <Alert variant="warning" title="Choose a valid date range">
          The start date must be on or before the end date (at most 62 days).
        </Alert>
      ) : list.isPending ? (
        <TableSkeleton rowsCount={6} columnsCount={5} />
      ) : list.isError ? (
        list.error instanceof ApiError &&
        list.error.errorCode === "RANGE_TOO_LARGE" ? (
          <Alert variant="warning" title="Date range too large">
            {list.error.message}
          </Alert>
        ) : list.error instanceof ApiError && list.error.isPermissionError ? (
          <Alert
            variant="warning"
            title="You don't have access to attendance reports"
          >
            Ask an administrator for the <code>hr.attendance_report.read</code>{" "}
            permission.
          </Alert>
        ) : (
          <ErrorState onRetry={() => void list.refetch()} />
        )
      ) : list.data.data.length === 0 ? (
        <Card>
          <EmptyState
            title="No missing punches"
            description={
              list.data.meta.totalPages > page
                ? "None on this page of employees — check the next page."
                : "Every punch in this range is complete."
            }
          />
          {list.data.meta.totalPages > 1 ? (
            <Pagination
              page={page}
              totalPages={list.data.meta.totalPages}
              onPageChange={setPage}
            />
          ) : null}
        </Card>
      ) : (
        <>
          <DataTable
            caption="Missing punches"
            rows={list.data.data}
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
                header: "Date",
                cell: (r) => (
                  <span className="text-theme-xs font-medium">
                    {r.attendanceDate}
                  </span>
                ),
              },
              {
                header: "Problem",
                cell: (r) => (
                  <StatusBadge
                    label={TYPE_LABELS[r.type]}
                    colorToken={
                      r.type === "MISSING_CHECK_OUT" ? "warning" : "error"
                    }
                  />
                ),
              },
              {
                header: "Punches",
                cell: (r) => (
                  <div className="flex flex-col gap-1">
                    <DayTimeline sessions={r.sessions} className="w-40" />
                    <span className="font-mono text-[11px] text-gray-500">
                      {r.sessions.length === 0
                        ? "none"
                        : r.sessions
                            .map(
                              (s) =>
                                `${formatTime(s.checkInAt)}–${s.checkOutAt ? formatTime(s.checkOutAt) : "?"}`,
                            )
                            .join(", ")}
                    </span>
                  </div>
                ),
              },
              {
                header: "Fix",
                cell: (r) =>
                  canWrite && r.recordId !== null ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setEditing(r)}
                    >
                      <Pencil className="mr-1.5 h-3.5 w-3.5" />
                      Fix punches
                    </Button>
                  ) : (
                    <span className="text-theme-xs text-gray-400">—</span>
                  ),
              },
            ]}
          />
          {list.data.meta.totalPages > 1 ? (
            <Pagination
              page={list.data.meta.page}
              totalPages={list.data.meta.totalPages}
              onPageChange={setPage}
            />
          ) : null}
        </>
      )}

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
