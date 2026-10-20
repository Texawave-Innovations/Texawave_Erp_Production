"use client";

import { ApiError } from "@texawave-erp/core";
import {
  Alert,
  Button,
  DataTable,
  ErrorState,
  PageHeader,
  TableSkeleton,
  type DataTableColumn,
} from "@texawave-erp/ui-kit";
import type { UseQueryResult } from "@tanstack/react-query";
import { Download, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import type { CsvColumn } from "../../shared/csv";
import { downloadCsv, toCsv } from "../../shared/csv";

export interface ReportTableViewProps<T> {
  title: string;
  description: string;
  icon: LucideIcon;
  noun: string;
  query: UseQueryResult<T[]>;
  columns: ReadonlyArray<DataTableColumn<T>>;
  csvColumns: readonly CsvColumn<T>[];
  getRowKey: (row: T) => string;
  fileName: string;
  filters?: ReactNode;
  emptyDescription?: string;
}

/** The one report-screen shell every SCM report page uses: a capped,
 * read-only row list with a "Download CSV" export of the exact rows shown
 * (Docs/SCM_LEGACY_PARITY.md section 10 — reports are snapshots, not
 * documents, so there is no pagination to match). */
export function ReportTableView<T>(props: ReportTableViewProps<T>) {
  const { query } = props;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        variant="banner"
        icon={props.icon}
        title={props.title}
        description={props.description}
        badge={
          query.data ? (
            <span className="rounded-full bg-white/70 px-3 py-1 text-xs font-semibold text-[#0a3271] dark:bg-gray-800/70 dark:text-sky-100">
              {query.data.length} {props.noun}
            </span>
          ) : undefined
        }
        action={
          query.data && query.data.length > 0 ? (
            <Button
              size="sm"
              variant="secondary"
              className="gap-2"
              onClick={() =>
                downloadCsv(
                  props.fileName,
                  toCsv(props.csvColumns, query.data!),
                )
              }
            >
              <Download className="h-4 w-4" />
              Download CSV
            </Button>
          ) : null
        }
      />
      {props.filters}
      {query.isPending ? (
        <TableSkeleton
          rowsCount={8}
          columnsCount={Math.max(4, props.columns.length)}
        />
      ) : query.isError ? (
        query.error instanceof ApiError && query.error.isPermissionError ? (
          <Alert
            variant="warning"
            title={`You don't have access to ${props.noun}`}
          >
            Ask an administrator for the <code>scm.reports.read</code>{" "}
            permission.
          </Alert>
        ) : (
          <ErrorState onRetry={() => void query.refetch()} />
        )
      ) : query.data.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center shadow-xs dark:border-gray-800 dark:bg-gray-dark">
          <props.icon className="mx-auto mb-4 h-10 w-10 stroke-[1.5] text-gray-400" />
          <h3 className="text-theme-base font-semibold text-gray-900 dark:text-white/90">
            Nothing to report yet
          </h3>
          <p className="mx-auto mt-1 max-w-sm text-theme-xs text-gray-500 dark:text-gray-400">
            {props.emptyDescription ??
              `${props.noun} will appear here once there is data.`}
          </p>
        </div>
      ) : (
        <DataTable<T>
          caption={props.title}
          columns={props.columns}
          rows={query.data}
          getRowKey={props.getRowKey}
        />
      )}
    </div>
  );
}
