"use client";

import type { PaginatedEnvelope } from "@texawave-erp/api-types";
import { ApiError } from "@texawave-erp/core";
import {
  Alert,
  DataTable,
  ErrorState,
  PageHeader,
  Pagination,
  TableSkeleton,
  TableToolbar,
  Button,
  type DataTableColumn,
} from "@texawave-erp/ui-kit";
import type { UseQueryResult } from "@tanstack/react-query";
import { RotateCcw, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export interface ScmListViewProps<T> {
  title: string;
  description: string;
  icon: LucideIcon;
  /** Plural noun for counts and copy, e.g. "transfers". */
  noun: string;
  /** Permission code named in the access-denied message. */
  readPermission: string;
  query: UseQueryResult<PaginatedEnvelope<T>>;
  columns: ReadonlyArray<DataTableColumn<T>>;
  getRowKey: (row: T) => string;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  /** Primary header actions (e.g. an "Add" button). */
  actions?: ReactNode;
  /** Optional strip above the toolbar (KPI cards, notices). */
  summary?: ReactNode;
  search?: {
    value: string;
    onChange: (value: string) => void;
    placeholder: string;
  };
  filters?: ReactNode;
  hasActiveFilters?: boolean;
  onResetFilters?: () => void;
  emptyTitle: string;
  emptyDescription: string;
  /** Dialogs and other siblings rendered below the table. */
  children?: ReactNode;
  onRowClick?: (row: T) => void;
}

/** The one list-screen shell every SCM page uses, so loading / error /
 * permission-denied / empty / no-results / pagination behave identically
 * (Docs/DESIGN_SYSTEM.md "Screen interaction states"). */
export function ScmListView<T>(props: ScmListViewProps<T>) {
  const { query } = props;

  if (query.isPending) {
    return (
      <div className="flex flex-col gap-5">
        <div className="h-24 w-full animate-pulse rounded-2xl bg-gray-200 dark:bg-gray-800" />
        <TableSkeleton
          rowsCount={6}
          columnsCount={Math.max(4, props.columns.length)}
        />
      </div>
    );
  }

  if (query.isError) {
    const error = query.error;
    if (error instanceof ApiError && error.isPermissionError) {
      return (
        <Alert
          variant="warning"
          title={`You don't have access to ${props.noun}`}
        >
          Ask an administrator for the <code>{props.readPermission}</code>{" "}
          permission.
        </Alert>
      );
    }
    return <ErrorState onRetry={() => void query.refetch()} />;
  }

  const rows = query.data.data;
  const meta = query.data.meta;
  const filtered = Boolean(props.hasActiveFilters);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        variant="banner"
        icon={props.icon}
        title={props.title}
        description={props.description}
        badge={
          <span className="rounded-full bg-white/70 px-3 py-1 text-xs font-semibold text-[#0a3271] dark:bg-gray-800/70 dark:text-sky-100">
            {meta.total} {props.noun}
          </span>
        }
        action={props.actions}
      />

      {props.summary}

      {props.search || props.filters ? (
        <TableToolbar
          {...(props.search
            ? {
                search: {
                  value: props.search.value,
                  onChange: props.search.onChange,
                  onClear: () => props.search?.onChange(""),
                  placeholder: props.search.placeholder,
                  ariaLabel: `Search ${props.noun}`,
                },
              }
            : {})}
          filters={props.filters}
          hasActiveFilters={filtered}
          onClearFilters={props.onResetFilters}
          clearFiltersLabel="Reset"
        />
      ) : null}

      {rows.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center shadow-xs dark:border-gray-800 dark:bg-gray-dark">
          <props.icon className="mx-auto mb-4 h-10 w-10 stroke-[1.5] text-gray-400" />
          <h3 className="text-theme-base font-semibold text-gray-900 dark:text-white/90">
            {filtered
              ? `No ${props.noun} match the current filters`
              : props.emptyTitle}
          </h3>
          <p className="mx-auto mt-1 max-w-sm text-theme-xs text-gray-500 dark:text-gray-400">
            {filtered
              ? "Try a different search or reset the active filters."
              : props.emptyDescription}
          </p>
          {filtered && props.onResetFilters ? (
            <div className="mt-5 flex justify-center">
              <Button
                variant="secondary"
                size="sm"
                onClick={props.onResetFilters}
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset filters
              </Button>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <DataTable<T>
            caption={props.title}
            columns={props.columns}
            rows={rows}
            getRowKey={props.getRowKey}
            {...(props.onRowClick ? { onRowClick: props.onRowClick } : {})}
          />
          <div className="flex flex-col gap-3 px-1 py-1 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-theme-xs text-gray-500 dark:text-gray-400">
              Showing {(meta.page - 1) * props.pageSize + 1} to{" "}
              {Math.min(meta.page * props.pageSize, meta.total)} of {meta.total}{" "}
              {props.noun}
            </span>
            <Pagination
              page={meta.page}
              totalPages={meta.totalPages}
              onPageChange={props.onPageChange}
            />
          </div>
        </div>
      )}

      {props.children}
    </div>
  );
}
