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

function getPageNumbers(
  currentPage: number,
  totalPages: number,
): (number | "...")[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  if (currentPage <= 4) {
    return [1, 2, 3, 4, 5, "...", totalPages];
  }

  if (currentPage >= totalPages - 3) {
    return [
      1,
      "...",
      totalPages - 4,
      totalPages - 3,
      totalPages - 2,
      totalPages - 1,
      totalPages,
    ];
  }

  return [
    1,
    "...",
    currentPage - 1,
    currentPage,
    currentPage + 1,
    "...",
    totalPages,
  ];
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

  const pageNumbers = getPageNumbers(page, Math.max(1, totalPages));

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

      <div className="flex flex-wrap items-center gap-1.5">
        <Button
          variant="secondary"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          aria-label="Previous page"
          className="cursor-pointer font-medium"
        >
          Previous
        </Button>

        {/* Numbered Page Buttons (1, 2, 3...) */}
        {totalPages > 1 && (
          <div className="flex items-center gap-1">
            {pageNumbers.map((item, idx) => {
              if (item === "...") {
                return (
                  <span
                    key={`ellipsis-${idx}`}
                    className="flex h-8 w-7 items-center justify-center text-xs font-bold text-slate-400 select-none"
                    aria-hidden="true"
                  >
                    …
                  </span>
                );
              }

              const isCurrent = item === page;
              return (
                <button
                  key={`page-${item}`}
                  type="button"
                  onClick={() => onPageChange(item)}
                  aria-current={isCurrent ? "page" : undefined}
                  aria-label={`Page ${item}`}
                  className={cn(
                    "flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-xs font-semibold transition-all cursor-pointer",
                    isCurrent
                      ? "bg-brand-500  text-white shadow-xs font-bold pointer-events-none"
                      : "border border-slate-200/90 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700/80",
                  )}
                >
                  {item}
                </button>
              );
            })}
          </div>
        )}

        <Button
          variant="secondary"
          size="sm"
          disabled={page >= totalPages || totalPages === 0}
          onClick={() => onPageChange(page + 1)}
          aria-label="Next page"
          className="cursor-pointer font-medium"
        >
          Next
        </Button>
      </div>
    </nav>
  );
}
