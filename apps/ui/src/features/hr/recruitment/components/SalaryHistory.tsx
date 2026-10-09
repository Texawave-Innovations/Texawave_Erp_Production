"use client";

import { ApiError } from "@texawave-erp/core";
import {
  Alert,
  DataTable,
  ErrorState,
  Skeleton,
  StatusBadge,
} from "@texawave-erp/ui-kit";
import { useSalaryHistory } from "../hooks";
import type { SalaryHistoryEntry } from "../types";
import { formatDate, formatRupees } from "../utils";

/** One employee's past revision and promotion letters, newest effective date
 * first — the "sub-branch" under an expanded employee on the Promotion letter
 * tab. Fetched only while it is mounted. */
export function SalaryHistory({ employeeId }: { employeeId: number }) {
  const query = useSalaryHistory(employeeId);

  if (query.isPending) {
    return (
      <div role="status" aria-label="Loading salary history">
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }
  if (query.isError) {
    if (query.error instanceof ApiError && query.error.isNotFound) {
      return (
        <Alert variant="warning" title="Not available">
          This employee is outside your teams or no longer exists.
        </Alert>
      );
    }
    if (query.error instanceof ApiError && query.error.isPermissionError) {
      return (
        <Alert variant="warning" title="Access denied">
          You do not have permission to view salary history.
        </Alert>
      );
    }
    return <ErrorState onRetry={() => void query.refetch()} />;
  }

  const { employee, revisionsIncluded, entries } = query.data;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-theme-sm text-gray-600 dark:text-gray-300">
        Current designation:{" "}
        <span className="font-medium text-gray-900 dark:text-white/90">
          {employee.currentDesignation}
        </span>
      </p>
      {revisionsIncluded ? null : (
        <p className="text-theme-xs text-gray-500 dark:text-gray-400">
          Revision letters are hidden — you do not have access to them.
        </p>
      )}
      {entries.length === 0 ? (
        <p className="text-theme-sm text-gray-500 dark:text-gray-400">
          No previous revision or promotion letters.
        </p>
      ) : (
        <DataTable<SalaryHistoryEntry>
          caption={`Salary history of ${employee.fullName}`}
          rows={entries}
          getRowKey={(entry) => `${entry.kind}-${entry.id}`}
          columns={[
            {
              header: "Type",
              cell: (entry) =>
                entry.kind === "PROMOTION" ? (
                  <StatusBadge label="Promotion" colorToken="success" />
                ) : (
                  <StatusBadge label="Revision" colorToken="brand" />
                ),
            },
            {
              header: "Document no.",
              cell: (entry) => (
                <span className="font-mono text-theme-xs">
                  {entry.documentNo}
                </span>
              ),
            },
            {
              header: "Effective",
              cell: (entry) => (
                <span className="whitespace-nowrap">
                  {formatDate(entry.effectiveDate)}
                </span>
              ),
            },
            {
              header: "Designation",
              cell: (entry) =>
                entry.previousDesignation !== null ? (
                  <span>
                    {entry.previousDesignation} → {entry.designation}
                  </span>
                ) : (
                  entry.designation
                ),
            },
            {
              header: "Basic / DA / HRA / CA",
              cell: (entry) => (
                <span className="whitespace-nowrap text-theme-xs">
                  {[
                    entry.components.basic,
                    entry.components.da,
                    entry.components.hra,
                    entry.components.ca,
                  ]
                    .map((value) => formatRupees(value))
                    .join(" / ")}
                </span>
              ),
            },
            {
              header: "Gross monthly",
              cell: (entry) => (
                <span className="whitespace-nowrap font-medium">
                  {formatRupees(entry.grossMonthly)}
                </span>
              ),
            },
          ]}
        />
      )}
    </div>
  );
}
