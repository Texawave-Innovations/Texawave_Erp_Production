"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
  Select,
  Skeleton,
} from "@texawave-erp/ui-kit";
import { usePermission } from "@/hooks/usePermission";
import { useAttendanceList } from "../hooks";
import {
  READ_ANY_SCOPE,
  SELF_SERVICE_READ,
  WRITE_ANY_SCOPE,
} from "../permissions";
import { STATUS_LABELS } from "../status";
import {
  STORED_STATUSES,
  type AttendanceDayView,
  type StoredStatus,
} from "../types";
import { AttendanceDetailDialog } from "./AttendanceDetailDialog";
import { AttendanceStatusBadge } from "./AttendanceStatusBadge";
import { ManualEditAttendanceDialog } from "./ManualEditAttendanceDialog";

const PAGE_SIZE = 20;
const MAX_RANGE_DAYS = 62;

function today(): string {
  return new Intl.DateTimeFormat("en-CA").format(new Date());
}

function startOfMonth(): string {
  const d = new Date();
  return new Intl.DateTimeFormat("en-CA").format(
    new Date(d.getFullYear(), d.getMonth(), 1),
  );
}

interface Filters {
  from: string;
  to: string;
  employeeId: string;
  status: "" | StoredStatus;
}

/**
 * HR Attendance: the caller's own/team/all scope, filtered by date range,
 * employee id and stored status. Filtering and paging happen server-side.
 * There is no employee name on the API payload, so rows show the employee
 * id, matching what the backend actually returns.
 */
export function AttendanceView() {
  const router = useRouter();
  const canRead = usePermission(READ_ANY_SCOPE);
  const canWrite = usePermission(WRITE_ANY_SCOPE);
  const canSelfService = usePermission(SELF_SERVICE_READ);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<Filters>({
    from: startOfMonth(),
    to: today(),
    employeeId: "",
    status: "",
  });
  const [rangeError, setRangeError] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [editRecord, setEditRecord] = useState<AttendanceDayView | null>(null);

  function update<K extends keyof Filters>(key: K, value: Filters[K]) {
    const next = { ...filters, [key]: value };
    setFilters(next);
    setPage(1);
    if (next.from && next.to) {
      const days =
        Math.round(
          (new Date(next.to).getTime() - new Date(next.from).getTime()) /
            86_400_000,
        ) + 1;
      setRangeError(
        next.from > next.to
          ? "`From` must not be after `to`."
          : days > MAX_RANGE_DAYS
            ? `The date range may not exceed ${MAX_RANGE_DAYS} days.`
            : null,
      );
    }
  }

  const employeeIdNum = Number(filters.employeeId);
  const query = {
    page,
    limit: PAGE_SIZE,
    from: filters.from,
    to: filters.to,
    ...(filters.employeeId &&
    Number.isInteger(employeeIdNum) &&
    employeeIdNum > 0
      ? { employeeId: employeeIdNum }
      : {}),
    ...(filters.status ? { status: filters.status } : {}),
  };

  const list = useAttendanceList(query);

  if (!canRead) {
    return (
      <Alert variant="warning" title="You don't have access to attendance">
        Ask an administrator for the <code>hr.attendance.read</code> permission.
      </Alert>
    );
  }

  const header = (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-theme-xl font-semibold text-gray-900 dark:text-white/90">
          Attendance
        </h1>
        {list.data ? (
          <p className="text-theme-sm text-gray-500 dark:text-gray-400">
            {list.data.meta.total} attendance records
          </p>
        ) : null}
      </div>
      {canSelfService ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/self-service/attendance")}
        >
          My attendance
        </Button>
      ) : null}
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      {header}

      <Card>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="grid grid-cols-2 gap-2">
            <Input
              type="date"
              aria-label="From date"
              value={filters.from}
              onChange={(e) => update("from", e.target.value)}
            />
            <Input
              type="date"
              aria-label="To date"
              value={filters.to}
              onChange={(e) => update("to", e.target.value)}
            />
          </div>
          <Input
            type="number"
            min="1"
            aria-label="Filter by employee id"
            placeholder="Employee ID"
            value={filters.employeeId}
            onChange={(e) => update("employeeId", e.target.value)}
          />
          <Select
            aria-label="Filter by status"
            value={filters.status}
            onChange={(e) =>
              update("status", e.target.value as "" | StoredStatus)
            }
          >
            <option value="">All statuses</option>
            {STORED_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </Select>
        </div>
      </Card>

      {rangeError ? (
        <Alert variant="warning" title="Invalid date range">
          {rangeError}
        </Alert>
      ) : list.isPending ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : list.isError ? (
        list.error instanceof ApiError && list.error.isPermissionError ? (
          <Alert variant="warning" title="You don't have access to attendance">
            Your access to this list has changed. Contact an administrator.
          </Alert>
        ) : list.error instanceof ApiError &&
          list.error.errorCode === "RANGE_TOO_LARGE" ? (
          <Alert variant="warning" title="Date range too large">
            {list.error.message}
          </Alert>
        ) : (
          <ErrorState onRetry={() => void list.refetch()} />
        )
      ) : list.data.data.length === 0 ? (
        <Card>
          <EmptyState
            title="No attendance records match these filters"
            description="Try a different date range, employee or status."
          />
        </Card>
      ) : (
        <>
          <DataTable
            caption="Attendance"
            rows={list.data.data}
            getRowKey={(r) =>
              String(r.recordId ?? `${r.employeeId}-${r.attendanceDate}`)
            }
            columns={[
              { header: "Employee", cell: (r) => `#${r.employeeId}` },
              { header: "Date", cell: (r) => r.attendanceDate },
              {
                header: "Status",
                cell: (r) => <AttendanceStatusBadge status={r.status} />,
              },
              {
                header: "Worked",
                cell: (r) =>
                  `${Math.floor(r.workedMinutes / 60)}h ${r.workedMinutes % 60}m`,
              },
              {
                header: "Overtime",
                cell: (r) =>
                  `${Math.floor(r.overtimeMinutes / 60)}h ${r.overtimeMinutes % 60}m`,
              },
              {
                header: "Actions",
                cell: (r) =>
                  r.recordId === null ? (
                    "—"
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setDetailId(r.recordId as number)}
                    >
                      Details
                    </Button>
                  ),
              },
            ]}
          />
          <Pagination
            page={list.data.meta.page}
            totalPages={list.data.meta.totalPages}
            onPageChange={setPage}
          />
        </>
      )}

      {detailId !== null ? (
        <AttendanceDetailDialog
          open
          id={detailId}
          canEdit={canWrite}
          onClose={() => setDetailId(null)}
          onEdit={() => {
            const row = list.data?.data.find((r) => r.recordId === detailId);
            if (row) setEditRecord(row);
            setDetailId(null);
          }}
        />
      ) : null}

      {editRecord ? (
        <ManualEditAttendanceDialog
          open
          record={editRecord}
          onClose={() => setEditRecord(null)}
        />
      ) : null}
    </div>
  );
}
