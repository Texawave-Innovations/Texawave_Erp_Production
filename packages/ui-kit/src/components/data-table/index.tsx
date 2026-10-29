"use client";

import {
  type ChangeEvent,
  type MouseEvent,
  type ReactNode,
  useEffect,
  useRef,
} from "react";
import { cn } from "../../lib/cn";
import { TableSkeleton } from "../table-skeleton/index";

export type SortDirection = "asc" | "desc";

export interface DataTableColumn<T> {
  header: ReactNode | string;
  cell: (row: T, index: number) => ReactNode;
  className?: string | undefined;
  headerClassName?: string | undefined;
  align?: "left" | "center" | "right" | undefined;
  sortable?: boolean | undefined;
  sortKey?: string | undefined;
  width?: string | number | undefined;
}

export interface DataTableProps<T> {
  columns: ReadonlyArray<DataTableColumn<T>>;
  rows: readonly T[];
  getRowKey: (row: T) => string;
  caption?: string | undefined;
  className?: string | undefined;
  tableClassName?: string | undefined;
  density?: "comfortable" | "compact" | undefined;

  // Loading, Empty & Error States
  loading?: boolean | undefined;
  loadingRowsCount?: number | undefined;
  loadingSkeleton?: ReactNode | undefined;
  emptyState?: ReactNode | undefined;
  errorState?: ReactNode | undefined;

  // Sorting
  sortColumn?: string | undefined;
  sortDirection?: SortDirection | undefined;
  onSort?:
    ((columnKey: string, nextDirection: SortDirection) => void) | undefined;

  // Selection
  selectable?: boolean | undefined;
  selectedRowKeys?: ReadonlySet<string> | readonly string[] | undefined;
  onSelectRow?:
    ((rowKey: string, selected: boolean, row: T) => void) | undefined;
  onSelectAll?: ((selected: boolean) => void) | undefined;
  selectRowAriaLabel?: ((row: T) => string) | undefined;
  selectAllAriaLabel?: string | undefined;

  // Row Interaction
  onRowClick?: ((row: T) => void) | undefined;
}

function SortAscIcon() {
  return (
    <svg
      className="h-3.5 w-3.5 text-brand-600 dark:text-brand-400"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="18 15 12 9 6 15" />
    </svg>
  );
}

function SortDescIcon() {
  return (
    <svg
      className="h-3.5 w-3.5 text-brand-600 dark:text-brand-400"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function SortNeutralIcon() {
  return (
    <svg
      className="h-3.5 w-3.5 text-slate-400 opacity-60 dark:text-slate-500"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="7 15 12 20 17 15" />
      <polyline points="7 9 12 4 17 9" />
    </svg>
  );
}

const ALIGN_HEADER_CLASSES: Record<"left" | "center" | "right", string> = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
};

const ALIGN_CELL_CLASSES: Record<"left" | "center" | "right", string> = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
};

/**
 * Standardized Global DataTable component.
 * High-performance, responsive table with accessible sorting, optional row selection,
 * row click interactions, and unified loading, empty, and error state slots.
 */
export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  caption,
  className,
  tableClassName,
  density = "comfortable",
  loading = false,
  loadingRowsCount = 6,
  loadingSkeleton,
  emptyState,
  errorState,
  sortColumn,
  sortDirection,
  onSort,
  selectable = false,
  selectedRowKeys,
  onSelectRow,
  onSelectAll,
  selectRowAriaLabel,
  selectAllAriaLabel = "Select all rows",
  onRowClick,
}: DataTableProps<T>) {
  const selectAllCheckboxRef = useRef<HTMLInputElement>(null);

  // Normalise selected keys lookup
  const selectedSet =
    selectedRowKeys instanceof Set
      ? selectedRowKeys
      : new Set(selectedRowKeys ?? []);

  const totalRowCount = rows.length;
  const selectedCount = rows.reduce(
    (acc, row) => (selectedSet.has(getRowKey(row)) ? acc + 1 : acc),
    0,
  );
  const allSelected = totalRowCount > 0 && selectedCount === totalRowCount;
  const someSelected = selectedCount > 0 && selectedCount < totalRowCount;

  useEffect(() => {
    if (selectAllCheckboxRef.current) {
      selectAllCheckboxRef.current.indeterminate = someSelected;
    }
  }, [someSelected]);

  // Error state rendering
  if (errorState) {
    return <div className={className}>{errorState}</div>;
  }

  // Loading state rendering
  if (loading) {
    if (loadingSkeleton) {
      return <div className={className}>{loadingSkeleton}</div>;
    }
    return (
      <TableSkeleton
        rowsCount={loadingRowsCount}
        columnsCount={columns.length + (selectable ? 1 : 0)}
        className={className}
      />
    );
  }

  // Empty state rendering when provided and row count is 0
  if (totalRowCount === 0 && emptyState) {
    return <div className={className}>{emptyState}</div>;
  }

  const handleSelectAllChange = (e: ChangeEvent<HTMLInputElement>) => {
    onSelectAll?.(e.target.checked);
  };

  const handleRowClick = (e: MouseEvent<HTMLTableRowElement>, row: T) => {
    if (!onRowClick) return;
    const target = e.target as HTMLElement | null;
    if (
      target?.closest(
        "button, a, input, select, textarea, [role='button'], [role='menuitem'], [data-prevent-row-click]",
      )
    ) {
      return;
    }
    onRowClick(row);
  };

  const isCompact = density === "compact";
  const paddingClass = isCompact ? "px-3 py-2.5" : "px-5 py-3.5";

  return (
    <div
      className={cn(
        "overflow-x-auto rounded-2xl border border-slate-200/90 bg-white card-light-shadow dark:border-gray-800 dark:bg-gray-dark",
        className,
      )}
    >
      <table className={cn("w-full text-left text-theme-sm", tableClassName)}>
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        <thead className="border-b border-sky-200/90 bg-linear-to-r from-sky-200/80 via-cyan-100/90 to-sky-100/80 dark:border-gray-800 dark:from-gray-800 dark:via-gray-800 dark:to-gray-850">
          <tr>
            {/* Row Selection Header Checkbox */}
            {selectable && (
              <th
                scope="col"
                className="w-12 px-4 py-3.5 text-center"
                style={{ width: 48 }}
              >
                <input
                  ref={selectAllCheckboxRef}
                  type="checkbox"
                  aria-label={selectAllAriaLabel}
                  checked={allSelected}
                  onChange={handleSelectAllChange}
                  className="h-4 w-4 rounded border-gray-400 text-brand-600 focus:ring-brand-500 focus:ring-2 dark:border-gray-600 dark:bg-[#161B26] transition-colors"
                />
              </th>
            )}

            {/* Column Headers */}
            {columns.map((column, colIdx) => {
              const alignClass = column.align
                ? ALIGN_HEADER_CLASSES[column.align]
                : "text-left";
              const columnKey =
                column.sortKey ??
                (typeof column.header === "string"
                  ? column.header
                  : `col-${colIdx}`);

              const isCurrentSort =
                sortColumn !== undefined && sortColumn === columnKey;
              const nextDirection: SortDirection =
                isCurrentSort && sortDirection === "asc" ? "desc" : "asc";

              return (
                <th
                  key={columnKey}
                  scope="col"
                  aria-sort={
                    column.sortable
                      ? isCurrentSort
                        ? sortDirection === "asc"
                          ? "ascending"
                          : "descending"
                        : "none"
                      : undefined
                  }
                  style={
                    column.width !== undefined
                      ? { width: column.width }
                      : undefined
                  }
                  className={cn(
                    paddingClass,
                    "text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200",
                    alignClass,
                    column.headerClassName,
                  )}
                >
                  {column.sortable && onSort ? (
                    <button
                      type="button"
                      onClick={() => onSort(columnKey, nextDirection)}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded p-0.5 font-bold uppercase tracking-wider text-slate-800 hover:text-brand-700 dark:text-slate-200 dark:hover:text-brand-300 transition-colors focus-visible:outline-2 focus-visible:outline-brand-500",
                        column.align === "right" && "ml-auto",
                        column.align === "center" && "mx-auto",
                      )}
                    >
                      <span>{column.header}</span>
                      <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center">
                        {isCurrentSort ? (
                          sortDirection === "asc" ? (
                            <SortAscIcon />
                          ) : (
                            <SortDescIcon />
                          )
                        ) : (
                          <SortNeutralIcon />
                        )}
                      </span>
                    </button>
                  ) : (
                    column.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200/80 dark:divide-gray-800">
          {totalRowCount === 0 ? (
            <tr>
              <td
                colSpan={columns.length + (selectable ? 1 : 0)}
                className="px-5 py-12 text-center text-theme-sm text-gray-500 dark:text-gray-400"
              >
                No records found
              </td>
            </tr>
          ) : (
            rows.map((row, rowIdx) => {
              const rowKey = getRowKey(row);
              const isRowSelected = selectedSet.has(rowKey);

              return (
                <tr
                  key={rowKey}
                  onClick={(e) => handleRowClick(e, row)}
                  className={cn(
                    "transition-colors",
                    isRowSelected
                      ? "bg-blue-50/50 dark:bg-blue-950/30"
                      : "hover:bg-sky-50/30 dark:hover:bg-[#161B26]",
                    onRowClick && "cursor-pointer",
                  )}
                >
                  {/* Row Checkbox Cell */}
                  {selectable && (
                    <td
                      className="w-12 px-4 py-3.5 text-center"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        aria-label={
                          selectRowAriaLabel
                            ? selectRowAriaLabel(row)
                            : `Select row ${rowKey}`
                        }
                        checked={isRowSelected}
                        onChange={(e) =>
                          onSelectRow?.(rowKey, e.target.checked, row)
                        }
                        className="h-4 w-4 rounded border-gray-400 text-brand-600 focus:ring-brand-500 focus:ring-2 dark:border-gray-600 dark:bg-[#161B26] transition-colors"
                      />
                    </td>
                  )}

                  {/* Row Data Cells */}
                  {columns.map((column, colIdx) => {
                    const alignClass = column.align
                      ? ALIGN_CELL_CLASSES[column.align]
                      : "text-left";
                    const columnKey =
                      column.sortKey ??
                      (typeof column.header === "string"
                        ? column.header
                        : `col-${colIdx}`);

                    return (
                      <td
                        key={columnKey}
                        className={cn(
                          paddingClass,
                          "text-theme-xs text-slate-700 dark:text-white/80",
                          alignClass,
                          column.className,
                        )}
                      >
                        {column.cell(row, rowIdx)}
                      </td>
                    );
                  })}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
