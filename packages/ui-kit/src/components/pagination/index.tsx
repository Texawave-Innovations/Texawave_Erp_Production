import { Button } from "../button/index";
import { cn } from "../../lib/cn";

export interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems?: number | undefined;
  pageSize?: number | undefined;
  onPageSizeChange?: ((pageSize: number) => void) | undefined;
  pageSizeOptions?: readonly number[] | undefined;
  className?: string | undefined;
}

export function Pagination({
  page,
  totalPages,
  onPageChange,
  totalItems,
  pageSize,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50, 100],
  className,
}: PaginationProps) {
  if (totalPages <= 1 && totalItems === undefined) {
    return null;
  }

  const effectivePageSize = pageSize ?? 10;
  const startItem = totalItems === 0 ? 0 : (page - 1) * effectivePageSize + 1;
  const endItem =
    totalItems !== undefined
      ? Math.min(page * effectivePageSize, totalItems)
      : null;

  return (
    <nav
      aria-label="Pagination"
      className={cn(
        "flex flex-wrap items-center justify-between gap-4",
        className,
      )}
    >
      <div className="flex items-center gap-3">
        <p className="text-theme-xs text-gray-500 dark:text-gray-400">
          {totalItems !== undefined ? (
            <>
              Showing{" "}
              <span className="font-semibold text-gray-900 dark:text-white">
                {startItem}
              </span>
              –
              <span className="font-semibold text-gray-900 dark:text-white">
                {endItem}
              </span>{" "}
              of{" "}
              <span className="font-semibold text-gray-900 dark:text-white">
                {totalItems}
              </span>{" "}
              results
            </>
          ) : (
            <>
              Page {page} of {totalPages}
            </>
          )}
        </p>

        {onPageSizeChange && pageSize && (
          <div className="flex items-center gap-1.5 text-theme-xs text-gray-500 dark:text-gray-400">
            <label htmlFor="pagination-page-size" className="sr-only">
              Items per page
            </label>
            <select
              id="pagination-page-size"
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="rounded-lg border border-gray-500 bg-white px-2 py-1 text-theme-xs text-gray-700 shadow-theme-xs focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-gray-600 dark:bg-gray-dark dark:text-gray-300"
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt} / page
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          aria-label="Previous page"
        >
          Previous
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={page >= totalPages || totalPages === 0}
          onClick={() => onPageChange(page + 1)}
          aria-label="Next page"
        >
          Next
        </Button>
      </div>
    </nav>
  );
}
