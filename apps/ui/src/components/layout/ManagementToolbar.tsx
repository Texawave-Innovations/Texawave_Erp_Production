"use client";

import type { ReactNode } from "react";
import { Search } from "lucide-react";
import { Button, Input } from "@texawave-erp/ui-kit";

export interface ManagementToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder: string;
  searchLabel?: string;
  filters?: ReactNode;
  onClearFilters?: () => void;
  hasActiveFilters?: boolean;
}

export type HrToolbarProps = ManagementToolbarProps;

/**
 * Shared Management Toolbar.
 * Encapsulates search and filter dropdowns in a calm enterprise card.
 * Conforms to Docs/DESIGN_SYSTEM.md and Docs/CODING_STANDARDS.md.
 */
export function ManagementToolbar({
  search,
  onSearchChange,
  searchPlaceholder,
  searchLabel = "Search",
  filters,
  onClearFilters,
  hasActiveFilters = false,
}: ManagementToolbarProps) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-3.5 shadow-theme-xs dark:border-gray-800 dark:bg-gray-dark md:flex-row md:items-center md:justify-between">
      {/* Search Input with Icon */}
      <div className="relative flex-1 md:max-w-xs">
        <label htmlFor="management-toolbar-search" className="sr-only">
          {searchLabel}
        </label>
        <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
          <Search className="h-4 w-4" />
        </span>
        <Input
          id="management-toolbar-search"
          placeholder={searchPlaceholder}
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full pl-8 text-theme-xs h-9"
        />
      </div>

      {/* Filter Slots & Clear Button */}
      <div className="flex flex-wrap items-center gap-2.5">
        {filters}

        {onClearFilters && hasActiveFilters && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClearFilters}
            className="h-9 px-3 text-theme-xs text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
          >
            Clear
          </Button>
        )}
      </div>
    </div>
  );
}

export const HrToolbar = ManagementToolbar;
