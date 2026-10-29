"use client";

import { useCallback, useMemo, useState } from "react";
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
  DataTable,
  DateRangePicker,
  EmptyState,
  ErrorState,
  Input,
  Pagination,
  Select,
} from "@texawave-erp/ui-kit";
import { usePermission } from "@/hooks/usePermission";
import { useRegionalFormatter } from "@/features/settings/preferences/hooks";
import { EmployeeIdentity } from "@/features/hr/components/EmployeeIdentity";
import {
  FilterChips,
  type FilterChipItem,
} from "@/features/hr/components/FilterChip";
import { TableSkeleton } from "@/features/hr/components/TableSkeleton";
import { useEmployees } from "@/features/hr/employees/hooks";
import { useAttendanceList } from "../hooks";
import { WRITE_ANY_SCOPE } from "../permissions";
import { formatMinutes, STATUS_LABELS } from "../status";
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
 * Records tab: stored attendance days in the caller's own/team/all scope,
 * filtered by date range, employee id and stored status. Filtering and
 * paging happen server-side. (The page header and the read-permission gate
 * live in AttendanceView.)
 */
export function AttendanceRecordsTab() {
  const canWrite = usePermission(WRITE_ANY_SCOPE);
  const { formatDate, formatTime: regionalFormatTime } = useRegionalFormatter();
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

  const update = useCallback(
    <K extends keyof Filters>(key: K, value: Filters[K]) => {
      setFilters((prev) => {
        const next = { ...prev, [key]: value };
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
        return next;
      });
      setPage(1);
    },
    [],
  );

  const updateRange = useCallback((from: string, to: string) => {
    setFilters((prev) => {
      const next = { ...prev, from, to };
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
      return next;
    });
    setPage(1);
  }, []);

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
  }, [filters, employeeMap, update, updateRange]);

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

  return (
    <div className="flex flex-col gap-5">
      {/* Summary Metrics - Executive Presence KPI Tiles */}
      {summaryMetrics ? (
        <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
          {/* Total Records */}
          <div className="flex items-center justify-between rounded-2xl border border-sky-200/80 bg-linear-to-r from-[#edf6ff] to-[#f0f8ff] p-4 shadow-xs dark:border-sky-900/40 dark:from-slate-900 dark:to-slate-800">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#0a3271] dark:text-sky-300">
                Total Records
              </p>
              <h3 className="mt-1 text-2xl font-extrabold text-[#0a3271] dark:text-white">
                {summaryMetrics.total}
              </h3>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                Matching current query
              </p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-sky-300/80 bg-white text-brand-500 shadow-xs dark:border-sky-800 dark:bg-slate-800 dark:text-sky-300">
              <CalendarCheck className="h-5 w-5" />
            </div>
          </div>

          {/* Present */}
          <div className="flex items-center justify-between rounded-2xl border border-emerald-200/80 bg-linear-to-r from-[#f0fdf4] to-[#ecfdf5] p-4 shadow-xs dark:border-emerald-900/40 dark:from-slate-900 dark:to-slate-800">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                Present
              </p>
              <h3 className="mt-1 text-2xl font-extrabold text-emerald-800 dark:text-white">
                {summaryMetrics.present}
              </h3>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                In current view
              </p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-emerald-300/80 bg-white text-emerald-600 shadow-xs dark:border-emerald-800 dark:bg-slate-800 dark:text-emerald-300">
              <UserCheck className="h-5 w-5" />
            </div>
          </div>

          {/* Absent */}
          <div className="flex items-center justify-between rounded-2xl border border-rose-200/80 bg-linear-to-r from-[#fff1f2] to-[#fff5f5] p-4 shadow-xs dark:border-rose-900/40 dark:from-slate-900 dark:to-slate-800">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-rose-800 dark:text-rose-300">
                Absent
              </p>
              <h3 className="mt-1 text-2xl font-extrabold text-rose-800 dark:text-white">
                {summaryMetrics.absent}
              </h3>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                In current view
              </p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-rose-300/80 bg-white text-rose-600 shadow-xs dark:border-rose-800 dark:bg-slate-800 dark:text-rose-300">
              <UserX className="h-5 w-5" />
            </div>
          </div>

          {/* Half Day / Leave */}
          <div className="flex items-center justify-between rounded-2xl border border-amber-200/80 bg-linear-to-r from-[#fffbeb] to-[#fef3c7] p-4 shadow-xs dark:border-amber-900/40 dark:from-slate-900 dark:to-slate-800">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">
                Half Day / Leave
              </p>
              <h3 className="mt-1 text-2xl font-extrabold text-amber-800 dark:text-white">
                {summaryMetrics.other}
              </h3>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                In current view
              </p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-amber-300/80 bg-white text-amber-600 shadow-xs dark:border-amber-800 dark:bg-slate-800 dark:text-amber-300">
              <Clock className="h-5 w-5" />
            </div>
          </div>
        </div>
      ) : null}

      {/* Filters Toolbar Card */}
      <div className="relative z-20 focus-within:z-30 rounded-2xl border border-sky-100/90 bg-white/95 p-4 shadow-2xs backdrop-blur-md dark:border-sky-950/40 dark:bg-gray-900/90">
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
      </div>

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
        <div className="rounded-2xl border border-sky-100/90 bg-white/95 p-6 shadow-2xs backdrop-blur-md dark:border-sky-950/40 dark:bg-gray-900/90">
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
        </div>
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
                    {formatDate(r.attendanceDate)}
                  </span>
                ),
              },
              {
                header: "Check-in",
                cell: (r) => {
                  const firstSession = r.sessions[0];
                  return (
                    <span className="font-mono text-theme-xs text-gray-600 dark:text-gray-400">
                      {firstSession
                        ? regionalFormatTime(firstSession.checkInAt)
                        : "—"}
                    </span>
                  );
                },
              },
              {
                header: "Check-out",
                cell: (r) => {
                  const lastSession = r.sessions[r.sessions.length - 1];
                  return (
                    <span className="text-theme-xs font-semibold text-gray-700 dark:text-gray-300">
                      {lastSession?.checkOutAt ? (
                        regionalFormatTime(lastSession.checkOutAt)
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
                  <span className="font-semibold text-gray-800 dark:text-gray-200 text-theme-xs">
                    {formatMinutes(r.workedMinutes)}
                  </span>
                ),
              },
              {
                header: "Overtime",
                cell: (r) =>
                  r.overtimeMinutes > 0 ? (
                    <span className="font-semibold text-cyan-700 dark:text-cyan-400 text-theme-xs">
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
