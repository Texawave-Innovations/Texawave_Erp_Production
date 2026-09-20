import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

export interface DataTableColumn<T> {
  header: string;
  cell: (row: T) => ReactNode;
  className?: string;
  headerClassName?: string;
}

export interface DataTableProps<T> {
  columns: ReadonlyArray<DataTableColumn<T>>;
  rows: readonly T[];
  getRowKey: (row: T) => string;
  caption?: string;
}

/**
 * Generic, dumb table primitive — no API calls, no domain knowledge, no
 * built-in loading/empty/error rendering (those are the caller's job via
 * `Skeleton`/`EmptyState`/`ErrorState`, composed around this
 * — Docs/DESIGN_SYSTEM.md "Forms/tables/navigation"). Wrapped in its own
 * `overflow-x-auto` so a wide table scrolls horizontally on narrow
 * viewports instead of blowing out the page layout.
 */
export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  caption,
}: DataTableProps<T>) {
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
      <table className="w-full text-left text-theme-sm">
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        <thead className="border-b border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-800/50">
          <tr>
            {columns.map((column) => (
              <th
                key={column.header}
                scope="col"
                className={cn(
                  "px-4 py-3 font-medium text-gray-500 dark:text-gray-400",
                  column.headerClassName,
                )}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
          {rows.map((row) => (
            <tr
              key={getRowKey(row)}
              className="hover:bg-gray-50 dark:hover:bg-gray-800/40"
            >
              {columns.map((column) => (
                <td
                  key={column.header}
                  className={cn(
                    "px-4 py-3 text-gray-700 dark:text-white/80",
                    column.className,
                  )}
                >
                  {column.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
