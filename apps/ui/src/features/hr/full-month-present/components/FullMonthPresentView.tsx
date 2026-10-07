"use client";

import { useState } from "react";
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
  Skeleton,
} from "@texawave-erp/ui-kit";
import { usePermission } from "@/hooks/usePermission";
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
 * every working day of the month was PRESENT. Backed by
 * GET /hr/attendance/reports/full-month-present — filtering, scoping and the
 * qualification rule are all decided server-side; this view only renders
 * what comes back.
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

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-theme-xl font-semibold text-gray-900 dark:text-white/90">
          Full Month Present
        </h1>
        {list.data ? (
          <p className="text-theme-sm text-gray-500 dark:text-gray-400">
            {list.data.meta.total} employee
            {list.data.meta.total === 1 ? "" : "s"} in scope for {filters.month}
          </p>
        ) : null}
      </div>

      <Card>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Input
            type="month"
            aria-label="Month"
            value={filters.month}
            onChange={(e) => update("month", e.target.value)}
          />
          <Input
            type="number"
            min="1"
            aria-label="Filter by employee id"
            placeholder="Employee ID"
            value={filters.employeeId}
            onChange={(e) => update("employeeId", e.target.value)}
          />
          <Input
            type="number"
            min="1"
            aria-label="Filter by team id"
            placeholder="Team ID"
            value={filters.teamId}
            onChange={(e) => update("teamId", e.target.value)}
          />
        </div>
      </Card>

      {list.data && rows.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <Card>
            <p className="text-theme-xs text-gray-500 dark:text-gray-400">
              Employees on this page
            </p>
            <p className="text-theme-xl font-semibold text-gray-900 dark:text-white/90">
              {rows.length}
            </p>
          </Card>
          <Card>
            <p className="text-theme-xs text-gray-500 dark:text-gray-400">
              Full Month Present
            </p>
            <p className="text-theme-xl font-semibold text-success-600">
              {qualifiedCount}
            </p>
          </Card>
          <Card>
            <p className="text-theme-xs text-gray-500 dark:text-gray-400">
              Not qualified
            </p>
            <p className="text-theme-xl font-semibold text-gray-900 dark:text-white/90">
              {rows.length - qualifiedCount}
            </p>
          </Card>
        </div>
      ) : null}

      {!monthValid ? (
        <Alert variant="warning" title="Invalid month">
          Choose a calendar month.
        </Alert>
      ) : list.isPending ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
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
                  <span>
                    {r.employee.fullName}{" "}
                    <span className="text-gray-400">
                      ({r.employee.employeeCode})
                    </span>
                  </span>
                ),
              },
              { header: "Present days", cell: (r) => r.presentDays },
              {
                header: "Month complete",
                cell: (r) => (r.monthComplete ? "Yes" : "No"),
              },
              {
                header: "Employed whole month",
                cell: (r) => (r.employedWholeMonth ? "Yes" : "No"),
              },
              {
                header: "Full Month Present",
                cell: (r) =>
                  r.fullMonthPresent ? (
                    <span className="font-medium text-success-600">Yes</span>
                  ) : (
                    <span className="text-gray-500 dark:text-gray-400">No</span>
                  ),
              },
              {
                header: "Actions",
                cell: (r) => (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setDetailRow(r)}
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
