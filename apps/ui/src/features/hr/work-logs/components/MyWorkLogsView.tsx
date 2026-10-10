"use client";

import { useMemo, useState } from "react";
import {
  CheckCircle2,
  Clock,
  FileText,
  Hourglass,
  Plus,
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
  Pagination,
  Select,
} from "@texawave-erp/ui-kit";
import { usePermission } from "@/hooks/usePermission";
import {
  FilterChips,
  type FilterChipItem,
} from "@/features/hr/components/FilterChip";
import { TableSkeleton } from "@/features/hr/components/TableSkeleton";
import { useMyWorkLogs } from "../hooks";
import { SELF_SERVICE_CREATE, SELF_SERVICE_READ } from "../permissions";
import { STATUS_LABELS } from "../status";
import { WORK_LOG_STATUSES, type WorkLogStatus } from "../types";
import { CreateWorkLogDialog } from "./CreateWorkLogDialog";
import { WorkLogStatusBadge } from "./WorkLogStatusBadge";

const PAGE_SIZE = 20;

interface Filters {
  status: "" | WorkLogStatus;
  from: string;
  to: string;
}

const EMPTY_FILTERS: Filters = { status: "", from: "", to: "" };

/** The authenticated user's own work logs: submit new ones, see decisions. */
export function MyWorkLogsView() {
  const canRead = usePermission(SELF_SERVICE_READ);
  const canCreate = usePermission(SELF_SERVICE_CREATE);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [createOpen, setCreateOpen] = useState(false);

  const update = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
  };

  const query = {
    page,
    limit: PAGE_SIZE,
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.from ? { from: filters.from } : {}),
    ...(filters.to ? { to: filters.to } : {}),
  };

  const list = useMyWorkLogs(query);
  const hasFilters =
    filters.status !== "" || filters.from !== "" || filters.to !== "";

  // Summary metrics calculated safely from current data
  const metrics = useMemo(() => {
    if (!list.data) return null;
    const items = list.data.data;
    const totalHours = items.reduce((sum, w) => sum + w.hoursWorked, 0);
    const approvedCount = items.filter((w) => w.status === "APPROVED").length;
    const pendingCount = items.filter((w) => w.status === "PENDING").length;
    return {
      totalLogs: list.data.meta.total,
      pageHours: Number(totalHours.toFixed(2)),
      approvedCount,
      pendingCount,
    };
  }, [list.data]);

  // Active filter chips
  const activeChips = useMemo<FilterChipItem[]>(() => {
    const chips: FilterChipItem[] = [];
    if (filters.status) {
      chips.push({
        id: "status",
        label: "Status",
        value: STATUS_LABELS[filters.status],
        onRemove: () => update("status", ""),
      });
    }
    if (filters.from && filters.to) {
      chips.push({
        id: "dateRange",
        label: "Date Range",
        value: `${filters.from} to ${filters.to}`,
        onRemove: () => {
          setFilters((f) => ({ ...f, from: "", to: "" }));
          setPage(1);
        },
      });
    } else if (filters.from) {
      chips.push({
        id: "from",
        label: "From",
        value: filters.from,
        onRemove: () => update("from", ""),
      });
    } else if (filters.to) {
      chips.push({
        id: "to",
        label: "To",
        value: filters.to,
        onRemove: () => update("to", ""),
      });
    }
    return chips;
  }, [filters]);

  if (!canRead) {
    return (
      <Alert variant="warning" title="You don't have access to work logs">
        Ask an administrator for the{" "}
        <code>employee_self_service.work_log.read</code> permission.
      </Alert>
    );
  }

  const header = (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div>
        <div className="flex items-center gap-2.5">
          <h1 className="text-theme-xl font-bold tracking-tight text-gray-900 dark:text-white">
            My Work Logs
          </h1>
          {list.data ? (
            <span className="inline-flex items-center rounded-full bg-brand-50 px-2.5 py-0.5 text-theme-xs font-semibold text-brand-700 dark:bg-brand-950/70 dark:text-brand-300 border border-brand-200 dark:border-brand-800">
              {list.data.meta.total} work logs
            </span>
          ) : null}
        </div>
        <p className="text-theme-sm text-gray-500 dark:text-gray-400 mt-0.5">
          Track and manage your submitted work logs.
        </p>
      </div>
      {canCreate ? (
        <Button
          onClick={() => setCreateOpen(true)}
          className="inline-flex items-center gap-1.5 shadow-xs"
        >
          <Plus className="h-4 w-4" />
          Submit work log
        </Button>
      ) : null}
    </div>
  );

  return (
    <div className="flex flex-col gap-5">
      {header}

      {/* Summary metrics strip */}
      {metrics && metrics.totalLogs > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Card className="p-3.5">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-950/60 dark:text-brand-400 border border-brand-100 dark:border-brand-900">
                <FileText className="h-4.5 w-4.5" />
              </div>
              <div>
                <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400">
                  Total Logs
                </p>
                <p className="text-theme-base font-bold text-gray-900 dark:text-white">
                  {metrics.totalLogs}
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-3.5">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400 border border-blue-100 dark:border-blue-900">
                <Clock className="h-4.5 w-4.5" />
              </div>
              <div>
                <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400">
                  Page Hours
                </p>
                <p className="text-theme-base font-bold text-gray-900 dark:text-white">
                  {metrics.pageHours}h
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-3.5">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900">
                <CheckCircle2 className="h-4.5 w-4.5" />
              </div>
              <div>
                <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400">
                  Approved
                </p>
                <p className="text-theme-base font-bold text-gray-900 dark:text-white">
                  {metrics.approvedCount}
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-3.5">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-100 dark:border-amber-900">
                <Hourglass className="h-4.5 w-4.5" />
              </div>
              <div>
                <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400">
                  Pending
                </p>
                <p className="text-theme-base font-bold text-gray-900 dark:text-white">
                  {metrics.pendingCount}
                </p>
              </div>
            </div>
          </Card>
        </div>
      ) : null}

      {/* Filter toolbar */}
      <Card>
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4 items-center">
            <Select
              aria-label="Filter by status"
              value={filters.status}
              onChange={(e) =>
                update("status", e.target.value as "" | WorkLogStatus)
              }
            >
              <option value="">All statuses</option>
              {WORK_LOG_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </Select>

            <div className="xl:col-span-2">
              <DateRangePicker
                value={{ from: filters.from, to: filters.to }}
                onChange={(r) => {
                  setFilters((f) => ({ ...f, from: r.from, to: r.to }));
                  setPage(1);
                }}
                onClear={() => {
                  setFilters((f) => ({ ...f, from: "", to: "" }));
                  setPage(1);
                }}
                fromAriaLabel="Logged on or after"
                toAriaLabel="Logged on or before"
              />
            </div>

            {hasFilters ? (
              <div className="flex items-center">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setFilters(EMPTY_FILTERS);
                    setPage(1);
                  }}
                  className="text-theme-xs text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 inline-flex items-center gap-1.5"
                >
                  <X className="h-3.5 w-3.5" />
                  Reset filters
                </Button>
              </div>
            ) : null}
          </div>

          {activeChips.length > 0 ? (
            <FilterChips
              chips={activeChips}
              onClearAll={() => {
                setFilters(EMPTY_FILTERS);
                setPage(1);
              }}
              className="pt-2 border-t border-gray-100 dark:border-gray-800"
            />
          ) : null}
        </div>
      </Card>

      {/* Table states */}
      {list.isPending ? (
        <TableSkeleton rowsCount={6} columnsCount={5} />
      ) : list.isError ? (
        list.error instanceof ApiError &&
        list.error.errorCode === "NOT_AN_EMPLOYEE" ? (
          <Alert
            variant="warning"
            title="Administrator Account (Not an Employee)"
          >
            Your current account is an organization administrator and is not
            linked to an employee record. Personal work logs are recorded by
            company employees.
          </Alert>
        ) : list.error instanceof ApiError && list.error.isPermissionError ? (
          <Alert variant="warning" title="You don't have access to work logs">
            Your access to this list has changed. Contact an administrator.
          </Alert>
        ) : (
          <ErrorState onRetry={() => void list.refetch()} />
        )
      ) : list.data.data.length === 0 ? (
        <Card>
          <EmptyState
            title={
              hasFilters
                ? "No work logs match these filters"
                : "No work logs yet"
            }
            description={
              hasFilters
                ? "Try a different status or date range, or clear the filters."
                : canCreate
                  ? "Submit your first work log to see it here."
                  : "Your work logs will appear here."
            }
            action={
              hasFilters ? (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setFilters(EMPTY_FILTERS);
                    setPage(1);
                  }}
                >
                  Clear filters
                </Button>
              ) : canCreate ? (
                <Button
                  size="sm"
                  onClick={() => setCreateOpen(true)}
                  className="inline-flex items-center gap-1.5"
                >
                  <Plus className="h-4 w-4" />
                  Submit work log
                </Button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <>
          <DataTable
            caption="My work logs"
            rows={list.data.data}
            getRowKey={(w) => String(w.id)}
            columns={[
              {
                header: "Date",
                cell: (w) => (
                  <span className="font-medium text-gray-800 dark:text-gray-200 text-theme-xs">
                    {w.workDate}
                  </span>
                ),
              },
              {
                header: "Hours",
                cell: (w) => (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-theme-xs font-semibold bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200 font-mono">
                    {w.hoursWorked} hrs
                  </span>
                ),
              },
              {
                header: "Task",
                cell: (w) => (
                  <span
                    title={w.taskDescription}
                    className="block max-w-md truncate text-theme-xs text-gray-600 dark:text-gray-300"
                  >
                    {w.taskDescription}
                  </span>
                ),
              },
              {
                header: "Status",
                cell: (w) => <WorkLogStatusBadge status={w.status} />,
              },
              {
                header: "Note",
                cell: (w) => (
                  <div className="flex flex-col">
                    <span className="text-theme-xs text-gray-700 dark:text-gray-300">
                      {w.decisionNote ?? "—"}
                    </span>
                    {w.decidedBy ? (
                      <span className="text-[11px] text-gray-400">
                        by {w.decidedBy.fullName}
                      </span>
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

      {createOpen ? (
        <CreateWorkLogDialog open onClose={() => setCreateOpen(false)} />
      ) : null}
    </div>
  );
}
