"use client";

import { Skeleton } from "@texawave-erp/ui-kit";

export interface TableSkeletonProps {
  rowsCount?: number;
  columnsCount?: number;
  className?: string;
}

/**
 * Realistic Table Skeleton Loader matching DataTable column anatomy.
 * Replaces generic loading flashes with consistent row placeholders.
 */
export function TableSkeleton({
  rowsCount = 6,
  columnsCount = 7,
  className = "",
}: TableSkeletonProps) {
  return (
    <div
      role="status"
      aria-label="Loading table data"
      className={`overflow-x-auto rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 ${className}`}
    >
      <span className="sr-only">Loading table records...</span>
      <table className="w-full text-left">
        <thead className="border-b border-gray-100 bg-gray-50/70 dark:border-gray-800 dark:bg-gray-800/40">
          <tr>
            {Array.from({ length: columnsCount }, (_, i) => (
              <th key={i} className="px-4 py-3.5">
                <Skeleton className="h-3.5 w-20 rounded-md" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
          {Array.from({ length: rowsCount }, (_, r) => (
            <tr key={r} className="transition-colors">
              {/* Primary column with avatar placeholder */}
              <td className="px-4 py-3.5">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                  <div className="flex flex-col gap-1.5 w-28">
                    <Skeleton className="h-3.5 w-full rounded-md" />
                    <Skeleton className="h-2.5 w-16 rounded-md" />
                  </div>
                </div>
              </td>

              {/* Remaining cell columns */}
              {Array.from({ length: columnsCount - 1 }, (_, c) => (
                <td key={c} className="px-4 py-3.5">
                  <Skeleton
                    className={`h-3.5 rounded-md ${
                      c % 2 === 0 ? "w-24" : "w-16"
                    }`}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
