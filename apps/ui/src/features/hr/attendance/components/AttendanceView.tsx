"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarCheck,
  Clock,
  Eye,
  Pencil,
  Search,
  UserCheck,
  UserX,
  X,
} from "lucide-react";
import { ApiError } from "@texawave-erp/core";
import {
  Alert,
  Button,
  Card,
  DataTable,
  DateRangePicker,
  EmptyState,
  ErrorState,
  Input,
  Pagination,
  Select,
} from "@texawave-erp/ui-kit";
import { usePermission } from "@/hooks/usePermission";
import { EmployeeIdentity } from "@/features/hr/components/EmployeeIdentity";
import {
  FilterChips,
  type FilterChipItem,
} from "@/features/hr/components/FilterChip";
import { StatCard } from "@/features/hr/components/StatCard";
import { TableSkeleton } from "@/features/hr/components/TableSkeleton";
import { useEmployees } from "@/features/hr/employees/hooks";
import { useAttendanceList } from "../hooks";
import {
  READ_ANY_SCOPE,
  SELF_SERVICE_READ,
  WRITE_ANY_SCOPE,
} from "../permissions";
import { formatMinutes, formatTime, STATUS_LABELS } from "../status";
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

  // Load employee master for rich identity resolution
  const employeesQuery = useEmployees({ page: 1, limit: 100 });
  const employeeMap = useMemo(() => {
    const map = new Map<
      number,
      {
        fullName: string;
        employeeCode: string;
        designation?: { name: string } | null;
      }
    >();
    if (employeesQuery.data?.data) {
      for (const emp of employeesQuery.data.data) {
        map.set(emp.id, emp);
      }
    }
    return map;
  }, [employeesQuery.data]);

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

  function updateRange(from: string, to: string) {
    const next = { ...filters, from, to };
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
    } else {
      setRangeError(null);
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

  // Compute real metrics from loaded attendance data
  const summaryMetrics = useMemo(() => {
    if (!list.data) return null;
    const total = list.data.meta.total;
    const present = list.data.data.filter((r) => r.status === "PRESENT").length;
    const absent = list.data.data.filter((r) => r.status === "ABSENT").length;
    const other = list.data.data.filter(
      (r) =>
        r.status === "HALF_DAY" ||
        r.status === "ON_LEAVE" ||
        r.status === "HOLIDAY",
    ).length;
    return { total, present, absent, other };
  }, [list.data]);

  // Construct active filter chips
  const activeChips = useMemo<FilterChipItem[]>(() => {
    const chips: FilterChipItem[] = [];
    if (
      filters.from &&
      filters.to &&
      (filters.from !== startOfMonth() || filters.to !== today())
    ) {
      chips.push({
        id: "date-range",
        label: "Range",
        value: `${filters.from} to ${filters.to}`,
        onRemove: () => updateRange(startOfMonth(), today()),
      });
    }
    if (filters.employeeId) {
      const emp = employeeMap.get(Number(filters.employeeId));
      chips.push({
        id: "employee",
        label: "Employee",
        value: emp
          ? `${emp.fullName} (#${filters.employeeId})`
          : `#${filters.employeeId}`,
        onRemove: () => update("employeeId", ""),
      });
    }
    if (filters.status) {
      chips.push({
        id: "status",
        label: "Status",
        value: STATUS_LABELS[filters.status],
        onRemove: () => update("status", ""),
      });
    }
    return chips;
  }, [filters, employeeMap]);

  function handleResetFilters() {
    setFilters({
      from: startOfMonth(),
      to: today(),
      employeeId: "",
      status: "",
    });
    setRangeError(null);
    setPage(1);
  }

  const selectedRecord = useMemo(() => {
    if (detailId === null || !list.data?.data) return null;
    return list.data.data.find((r) => r.recordId === detailId) ?? null;
  }, [detailId, list.data]);

  const selectedEmployee = useMemo(() => {
    if (!selectedRecord) return null;
    return employeeMap.get(selectedRecord.employeeId) ?? null;
  }, [selectedRecord, employeeMap]);

  const editEmployee = useMemo(() => {
    if (!editRecord) return null;
    return employeeMap.get(editRecord.employeeId) ?? null;
  }, [editRecord, employeeMap]);

  if (!canRead) {
    return (
      <Alert variant="warning" title="You don't have access to attendance">
        Ask an administrator for the <code>hr.attendance.read</code> permission.
      </Alert>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-theme-xl font-bold tracking-tight text-gray-900 dark:text-white">
              Attendance
            </h1>
            {list.data ? (
              <span className="inline-flex items-center rounded-full bg-brand-50 px-2.5 py-0.5 text-theme-xs font-semibold text-brand-700 dark:bg-brand-950/70 dark:text-brand-300 border border-brand-200 dark:border-brand-800">
                {list.data.meta.total} records
              </span>
            ) : null}
          </div>
          <p className="text-theme-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Monitor and manage employee attendance records.
          </p>
        </div>

        {canSelfService ? (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => router.push("/portal/attendance")}
            className="inline-flex items-center gap-2"
          >
            <UserCheck className="h-4 w-4 text-brand-600 dark:text-brand-400" />
            My attendance
          </Button>
        ) : null}
      </div>

      {/* Summary Metrics */}
      {summaryMetrics ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
          <StatCard
            headingId="total-attendance-records"
            label="Total Records"
            value={summaryMetrics.total}
            note="Matching current query"
            tone="neutral"
            icon={CalendarCheck}
          />
          <StatCard
            headingId="present-attendance"
            label="Present"
            value={summaryMetrics.present}
            note="In current results view"
            tone="success"
            icon={UserCheck}
          />
          <StatCard
            headingId="absent-attendance"
            label="Absent"
            value={summaryMetrics.absent}
            note="In current results view"
            tone="error"
            icon={UserX}
          />
          <StatCard
            headingId="half-day-leave-attendance"
            label="Half Day / Leave"
            value={summaryMetrics.other}
            note="In current results view"
            tone="warning"
            icon={Clock}
          />
        </div>
      ) : null}

      {/* Filters Card */}
      <Card>
        <div className="flex flex-col gap-3.5">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4 items-center">
            <DateRangePicker
              value={{ from: filters.from, to: filters.to }}
              onChange={(r) => updateRange(r.from, r.to)}
              onClear={() => updateRange("", "")}
              fromAriaLabel="From date"
              toAriaLabel="To date"
            />

            <div className="relative">
              <Input
                type="number"
                min="1"
                aria-label="Filter by employee id"
                placeholder="Employee ID..."
                value={filters.employeeId}
                onChange={(e) => update("employeeId", e.target.value)}
                className="pl-9"
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            </div>

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

            {activeChips.length > 0 ? (
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleResetFilters}
                  className="text-theme-xs text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 inline-flex items-center gap-1.5"
                >
                  <X className="h-3.5 w-3.5" />
                  Reset all filters
                </Button>
              </div>
            ) : null}
          </div>

          {activeChips.length > 0 ? (
            <FilterChips
              chips={activeChips}
              onClearAll={handleResetFilters}
              className="pt-2 border-t border-gray-100 dark:border-gray-800"
            />
          ) : null}
        </div>
      </Card>

      {/* Range Error Alert */}
      {rangeError ? (
        <Alert variant="warning" title="Invalid date range">
          {rangeError}
        </Alert>
      ) : list.isPending ? (
        <TableSkeleton rowsCount={6} columnsCount={8} />
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
            description="Try selecting a different date range, employee ID, or attendance status."
            action={
              activeChips.length > 0 ? (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleResetFilters}
                >
                  Clear all filters
                </Button>
              ) : undefined
            }
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
              {
                header: "Employee",
                cell: (r) => {
                  const emp = employeeMap.get(r.employeeId);
                  return (
                    <EmployeeIdentity
                      name={emp?.fullName ?? `Employee #${r.employeeId}`}
                      code={emp?.employeeCode ?? `#${r.employeeId}`}
                      subtext={emp?.designation?.name}
                      avatarSize="sm"
                      size="sm"
                    />
                  );
                },
              },
              {
                header: "Date",
                cell: (r) => (
                  <span className="font-medium text-gray-800 dark:text-gray-200 text-theme-xs">
                    {r.attendanceDate}
                  </span>
                ),
              },
              {
                header: "Check-in",
                cell: (r) => {
                  const firstSession = r.sessions[0];
                  return (
                    <span className="font-mono text-theme-xs text-gray-600 dark:text-gray-400">
                      {firstSession ? formatTime(firstSession.checkInAt) : "—"}
                    </span>
                  );
                },
              },
              {
                header: "Check-out",
                cell: (r) => {
                  const lastSession = r.sessions[r.sessions.length - 1];
                  return (
                    <span className="font-mono text-theme-xs text-gray-600 dark:text-gray-400">
                      {lastSession?.checkOutAt ? (
                        formatTime(lastSession.checkOutAt)
                      ) : r.hasOpenSession ? (
                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                          Open
                        </span>
                      ) : (
                        "—"
                      )}
                    </span>
                  );
                },
              },
              {
                header: "Worked",
                cell: (r) => (
                  <span className="font-medium text-gray-800 dark:text-gray-200 text-theme-xs">
                    {formatMinutes(r.workedMinutes)}
                  </span>
                ),
              },
              {
                header: "Overtime",
                cell: (r) =>
                  r.overtimeMinutes > 0 ? (
                    <span className="font-semibold text-purple-700 dark:text-purple-400 text-theme-xs">
                      +{formatMinutes(r.overtimeMinutes)}
                    </span>
                  ) : (
                    <span className="text-gray-400 dark:text-gray-500 text-theme-xs">
                      —
                    </span>
                  ),
              },
              {
                header: "Status",
                cell: (r) => <AttendanceStatusBadge status={r.status} />,
              },
              {
                header: "Actions",
                cell: (r) =>
                  r.recordId === null ? (
                    <span className="text-gray-400">—</span>
                  ) : (
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setDetailId(r.recordId as number)}
                        className="inline-flex items-center gap-1.5 text-theme-xs h-8 px-2.5"
                      >
                        <Eye className="h-3.5 w-3.5 text-gray-500" />
                        Details
                      </Button>
                      {canWrite ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditRecord(r)}
                          className="inline-flex items-center gap-1.5 text-theme-xs h-8 px-2 text-gray-500 hover:text-brand-600"
                          title="Edit record"
                          aria-label={`Edit attendance for employee ${r.employeeId}`}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      ) : null}
                    </div>
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

      {/* Attendance Detail Dialog */}
      {detailId !== null ? (
        <AttendanceDetailDialog
          open
          id={detailId}
          canEdit={canWrite}
          employee={selectedEmployee}
          onClose={() => setDetailId(null)}
          onEdit={() => {
            if (selectedRecord) setEditRecord(selectedRecord);
            setDetailId(null);
          }}
        />
      ) : null}

      {/* Manual Edit Attendance Dialog */}
      {editRecord ? (
        <ManualEditAttendanceDialog
          open
          record={editRecord}
          employee={editEmployee}
          onClose={() => setEditRecord(null)}
        />
      ) : null}
    </div>
  );
}
