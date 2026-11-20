"use client";

import { type ReactNode, isValidElement } from "react";
import { cn } from "../../lib/cn";
import { SearchInput } from "../search-input/index";
import { Button } from "../button/index";

export interface TableToolbarSearchConfig {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string | undefined;
  onClear?: (() => void) | undefined;
  ariaLabel?: string | undefined;
  disabled?: boolean | undefined;
  className?: string | undefined;
}

export interface TableToolbarProps {
  search?: ReactNode | TableToolbarSearchConfig | undefined;
  filters?: ReactNode | undefined;
  chips?: ReactNode | undefined;
  actions?: ReactNode | undefined;
  bulkActions?: ReactNode | undefined;
  resultCount?: ReactNode | number | undefined;
  hasActiveFilters?: boolean | undefined;
  onClearFilters?: (() => void) | undefined;
  clearFiltersLabel?: string | undefined;
  className?: string | undefined;
  children?: ReactNode | undefined;
}

/**
 * Standardized Global TableToolbar for search, filter controls, filter chips,
 * count telemetry, and bulk/primary actions across all TexaOne ERP data grids.
 *
 * Layout: one row — search (grows), filters inline at a default width, then
 * the result count, "Clear filters" and actions at the right end. On small
 * screens search takes the full row and the filters wrap beneath it.
 */
export function TableToolbar({
  search,
  filters,
  chips,
  actions,
  bulkActions,
  resultCount,
  hasActiveFilters = false,
  onClearFilters,
  clearFiltersLabel = "Clear filters",
  className,
  children,
}: TableToolbarProps) {
  const isSearchConfig =
    search !== null &&
    typeof search === "object" &&
    !isValidElement(search) &&
    "value" in search &&
    "onChange" in search;

  const searchConfig = isSearchConfig
    ? (search as TableToolbarSearchConfig)
    : null;

  const searchNode = searchConfig ? (
    <SearchInput
      value={searchConfig.value}
      onChangeValue={searchConfig.onChange}
      placeholder={searchConfig.placeholder ?? "Search..."}
      onClear={searchConfig.onClear}
      aria-label={searchConfig.ariaLabel ?? "Search"}
      disabled={searchConfig.disabled}
      className={cn("w-full sm:max-w-sm", searchConfig.className)}
      sizeVariant="md"
    />
  ) : (
    (search as ReactNode)
  );

  const countLabel =
    typeof resultCount === "number"
      ? `${resultCount} ${resultCount === 1 ? "result" : "results"}`
      : resultCount;
  const showClear = Boolean(onClearFilters && hasActiveFilters);
  const hasMeta =
    resultCount !== undefined || showClear || bulkActions || actions;

  return (
    <div
      role="region"
      aria-label="Table management toolbar"
      className={cn(
        "flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-3 shadow-theme-xs dark:border-gray-800 dark:bg-gray-dark",
        className,
      )}
    >
      {/* Primary row: search, inline filters, then count / clear / actions */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="flex min-w-0 flex-1 flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center">
          {searchNode}
          {filters ? (
            // Select dropdowns (even when wrapped in a div) get a default
            // inline width on >= sm; below sm they stay full width.
            <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:[&_[data-select-root]]:w-44">
              {filters}
            </div>
          ) : null}
        </div>

        {hasMeta ? (
          <div className="flex flex-wrap items-center gap-2.5 md:justify-end">
            {countLabel !== undefined && countLabel !== null ? (
              <span className="text-theme-xs font-medium whitespace-nowrap text-gray-500 dark:text-gray-400">
                {countLabel}
              </span>
            ) : null}

            {bulkActions}

            {showClear ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onClearFilters}
                className="h-9 px-3 text-theme-xs text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
              >
                {clearFiltersLabel}
              </Button>
            ) : null}

            {actions}
          </div>
        ) : null}
      </div>

      {/* Children Custom Slots */}
      {children}

      {/* Filter Chips Row */}
      {chips && (
        <div className="border-t border-gray-100 pt-2.5 dark:border-gray-800">
          {chips}
        </div>
      )}
    </div>
  );
}
