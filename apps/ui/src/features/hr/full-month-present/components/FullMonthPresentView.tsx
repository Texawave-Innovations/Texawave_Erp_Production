"use client";

import { useMemo, useState } from "react";
import {
  Calendar,
  CheckCircle2,
  Search,
  Trophy,
  Users,
  X,
  XCircle,
} from "lucide-react";
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
  StatusBadge,
} from "@texawave-erp/ui-kit";
import { usePermission } from "@/hooks/usePermission";
import { EmployeeIdentity } from "@/features/hr/components/EmployeeIdentity";
import {
  FilterChips,
  type FilterChipItem,
} from "@/features/hr/components/FilterChip";
import { TableSkeleton } from "@/features/hr/components/TableSkeleton";
import { useFullMonthPresentList } from "../hooks";
import { READ_ANY_SCOPE } from "../permissions";
import { currentMonth } from "../status";
import type { FullMonthPresentRow } from "../types";
import { FullMonthPresentDetailDialog } from "./FullMonthPresentDetailDialog";

const PAGE_SIZE = 20;
const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

interface Filters {
  month: string;
  employeeId: string;
  teamId: string;
}

/**
 * Full Month Present: for a chosen calendar month, every active employee in
 * the caller's own/team/all scope with a per-day derived status and whether
 * every working day of the month was PRESENT.
 */
export function FullMonthPresentView() {
  const canRead = usePermission(READ_ANY_SCOPE);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<Filters>({
    month: currentMonth(),
    employeeId: "",
    teamId: "",
  });
  const [detailRow, setDetailRow] = useState<FullMonthPresentRow | null>(null);

  function update<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  }

  const monthValid = MONTH_PATTERN.test(filters.month);
  const employeeIdNum = Number(filters.employeeId);
  const teamIdNum = Number(filters.teamId);
  const query = {
    page,
    limit: PAGE_SIZE,
    month: filters.month,
    ...(filters.employeeId &&
    Number.isInteger(employeeIdNum) &&
    employeeIdNum > 0
      ? { employeeId: employeeIdNum }
      : {}),
    ...(filters.teamId && Number.isInteger(teamIdNum) && teamIdNum > 0
      ? { teamId: teamIdNum }
      : {}),
  };

  const list = useFullMonthPresentList(query);

  const hasExtraFilters =
    filters.employeeId !== "" ||
    filters.teamId !== "" ||
    filters.month !== currentMonth();

  // Active filter chips
  const activeChips = useMemo<FilterChipItem[]>(() => {
    const chips: FilterChipItem[] = [];
    if (filters.month && filters.month !== currentMonth()) {
      chips.push({
        id: "month",
        label: "Month",
        value: filters.month,
        onRemove: () => update("month", currentMonth()),
      });
    }
    if (filters.employeeId) {
      chips.push({
        id: "employeeId",
        label: "Employee ID",
        value: `#${filters.employeeId}`,
        onRemove: () => update("employeeId", ""),
      });
    }
    if (filters.teamId) {
      chips.push({
        id: "teamId",
        label: "Team ID",
        value: `#${filters.teamId}`,
        onRemove: () => update("teamId", ""),
      });
    }
    return chips;
  }, [filters]);

  if (!canRead) {
    return (
      <Alert
        variant="warning"
        title="You don't have access to Full Month Present"
      >
        Ask an administrator for the <code>hr.attendance_report.read</code>{" "}
        permission.
      </Alert>
    );
  }

  const rows = list.data?.data ?? [];
  const qualifiedCount = rows.filter((r) => r.fullMonthPresent).length;
  const notQualifiedCount = rows.length - qualifiedCount;

  return (
    <div className="flex flex-col gap-6">
      {/* Page Header */}
      <div>
        <div className="flex items-center gap-2.5">
          <h1 className="text-theme-xl font-bold tracking-tight text-gray-900 dark:text-white">
            Full Month Present
          </h1>
          {list.data ? (
            <span className="inline-flex items-center rounded-full bg-brand-50 px-2.5 py-0.5 text-theme-xs font-semibold text-brand-700 dark:bg-brand-950/70 dark:text-brand-300 border border-brand-200 dark:border-brand-800">
              {list.data.meta.total} in scope
            </span>
          ) : null}
        </div>
        <p className="text-theme-sm text-gray-500 dark:text-gray-400 mt-0.5">
          Review employee attendance and full-month qualification.
        </p>
      </div>

      {/* Summary Metrics (Preserving exact 3 metrics) */}
      {list.data && rows.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card className="p-4">
            <div className="flex items-center gap-3.5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-950/60 dark:text-brand-400 border border-brand-100 dark:border-brand-900">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <p className="text-theme-xs font-medium text-gray-500 dark:text-gray-400">
                  Employees on this page
                </p>
                <p className="text-theme-xl font-bold tracking-tight text-gray-900 dark:text-white mt-0.5">
                  {rows.length}
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-3.5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900">
                <Trophy className="h-5 w-5" />
              </div>
              <div>
                <p className="text-theme-xs font-medium text-gray-500 dark:text-gray-400">
                  Full Month Present
                </p>
                <p className="text-theme-xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400 mt-0.5">
                  {qualifiedCount}
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-3.5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 border border-gray-200 dark:border-gray-700">
                <XCircle className="h-5 w-5" />
              </div>
              <div>
                <p className="text-theme-xs font-medium text-gray-500 dark:text-gray-400">
                  Not qualified
                </p>
                <p className="text-theme-xl font-bold tracking-tight text-gray-700 dark:text-gray-300 mt-0.5">
                  {notQualifiedCount}
                </p>
              </div>
            </div>
          </Card>
        </div>
      ) : null}

      {/* Filter toolbar */}
      <Card className="p-4">
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 items-center">
            <div className="relative">
              <Input
                type="month"
                aria-label="Month"
                value={filters.month}
                onChange={(e) => update("month", e.target.value)}
                className="font-medium"
              />
            </div>

            <div className="relative">
              <Input
                type="number"
                min="1"
                aria-label="Filter by employee id"
                placeholder="Employee ID"
                value={filters.employeeId}
                onChange={(e) => update("employeeId", e.target.value)}
              />
            </div>

            <div className="relative">
              <Input
                type="number"
                min="1"
                aria-label="Filter by team id"
                placeholder="Team ID"
                value={filters.teamId}
                onChange={(e) => update("teamId", e.target.value)}
              />
            </div>
          </div>

          {activeChips.length > 0 ? (
            <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-800">
              <FilterChips
                chips={activeChips}
                onClearAll={() => {
                  setFilters({
                    month: currentMonth(),
                    employeeId: "",
                    teamId: "",
                  });
                  setPage(1);
                }}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setFilters({
                    month: currentMonth(),
                    employeeId: "",
                    teamId: "",
                  });
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
      </Card>

      {/* Main Table & States */}
      {!monthValid ? (
        <Alert variant="warning" title="Invalid month">
          Choose a calendar month in YYYY-MM format.
        </Alert>
      ) : list.isPending ? (
        <TableSkeleton rowsCount={6} columnsCount={6} />
      ) : list.isError ? (
        list.error instanceof ApiError && list.error.isPermissionError ? (
          <Alert
            variant="warning"
            title="You don't have access to Full Month Present"
          >
            Your access to this report has changed. Contact an administrator.
          </Alert>
        ) : list.error instanceof ApiError && list.error.isValidationError ? (
          <Alert variant="warning" title="Invalid filters">
            {list.error.message}
          </Alert>
        ) : list.error instanceof ApiError && list.error.isNotFound ? (
          <Alert variant="warning" title="Not found">
            {list.error.message}
          </Alert>
        ) : (
          <ErrorState onRetry={() => void list.refetch()} />
        )
      ) : rows.length === 0 ? (
        <Card>
          <EmptyState
            title="No employees match these filters"
            description="Try a different month, employee or team."
            action={
              hasExtraFilters ? (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setFilters({
                      month: currentMonth(),
                      employeeId: "",
                      teamId: "",
                    });
                    setPage(1);
                  }}
                >
                  Reset filters
                </Button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <>
          <DataTable
            caption="Full Month Present"
            rows={rows}
            getRowKey={(r) => `${r.employee.id}-${r.month}`}
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
                header: "Present days",
                cell: (r) => (
                  <span className="font-mono text-theme-xs font-semibold px-2 py-0.5 rounded bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200">
                    {r.presentDays} days
                  </span>
                ),
              },
              {
                header: "Month complete",
                cell: (r) => (
                  <StatusBadge
                    label={r.monthComplete ? "Yes" : "No"}
                    colorToken={r.monthComplete ? "success" : "gray"}
                  />
                ),
              },
              {
                header: "Employed whole month",
                cell: (r) => (
                  <StatusBadge
                    label={r.employedWholeMonth ? "Yes" : "No"}
                    colorToken={r.employedWholeMonth ? "success" : "gray"}
                  />
                ),
              },
              {
                header: "Full Month Present",
                cell: (r) =>
                  r.fullMonthPresent ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-theme-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                      Yes
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-theme-xs font-semibold bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 border border-gray-200 dark:border-gray-700">
                      <XCircle className="h-3.5 w-3.5 text-gray-400" />
                      No
                    </span>
                  ),
              },
              {
                header: "Actions",
                cell: (r) => (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setDetailRow(r)}
                    className="text-theme-xs font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400"
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

      {detailRow ? (
        <FullMonthPresentDetailDialog
          open
          row={detailRow}
          onClose={() => setDetailRow(null)}
        />
      ) : null}
    </div>
  );
}
