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
      className={cn("w-full md:max-w-xs", searchConfig.className)}
      sizeVariant="sm"
    />
  ) : (
    (search as ReactNode)
  );

  return (
    <div
      role="region"
      aria-label="Table management toolbar"
      className={cn(
        "flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-3.5 shadow-theme-xs dark:border-gray-800 dark:bg-gray-dark",
        className,
      )}
    >
      {/* Primary Row: Search, Filters, Result Count, and Action Slots */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        {/* Left Side: Search, Filters, and Optional Count */}
        <div className="flex flex-1 flex-wrap items-center gap-2.5">
          {searchNode}
          {filters}
          {resultCount !== undefined && (
            <span className="text-theme-xs font-medium text-gray-500 dark:text-gray-400 self-center">
              {typeof resultCount === "number"
                ? `${resultCount} results`
                : resultCount}
            </span>
          )}
        </div>

        {/* Right Side: Clear Filters, Bulk Actions, Actions */}
        <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
          {bulkActions}

          {onClearFilters && hasActiveFilters && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClearFilters}
              className="h-9 px-3 text-theme-xs text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
            >
              {clearFiltersLabel}
            </Button>
          )}

          {actions}
        </div>
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
