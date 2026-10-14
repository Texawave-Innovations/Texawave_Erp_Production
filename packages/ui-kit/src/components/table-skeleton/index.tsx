import { cn } from "../../lib/cn";
import { Skeleton } from "../skeleton/index";

export interface TableSkeletonProps {
  rowsCount?: number | undefined;
  columnsCount?: number | undefined;
  className?: string | undefined;
}

/**
 * Realistic Table Skeleton Loader matching DataTable column anatomy.
 * Replaces generic loading flashes with consistent row placeholders.
 * Respects prefers-reduced-motion via the underlying Skeleton primitive.
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
      className={cn(
        "overflow-x-auto rounded-2xl border border-sky-100 bg-white shadow-xs dark:border-gray-800 dark:bg-gray-dark",
        className,
      )}
    >
      <span className="sr-only">Loading table records...</span>
      <table className="w-full text-left">
        <thead className="border-b border-sky-100/80 bg-linear-to-r from-sky-200/80 via-cyan-100/90 to-emerald-100/80 dark:border-gray-800 dark:from-gray-800 dark:via-gray-800 dark:to-gray-850">
          <tr>
            {Array.from({ length: columnsCount }, (_, i) => (
              <th key={i} className="px-5 py-3.5">
                <Skeleton className="h-3.5 w-20 rounded-md" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-gray-800">
          {Array.from({ length: rowsCount }, (_, r) => (
            <tr key={r} className="transition-colors">
              {/* Primary column with avatar placeholder */}
              <td className="px-5 py-3.5">
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
                <td key={c} className="px-5 py-3.5">
                  <Skeleton
                    className={cn(
                      "h-3.5 rounded-md",
                      c % 2 === 0 ? "w-24" : "w-16",
                    )}
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
