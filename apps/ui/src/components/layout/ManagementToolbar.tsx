"use client";

import type { ReactNode } from "react";
import { TableToolbar } from "@texawave-erp/ui-kit";

export interface ManagementToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder: string;
  searchLabel?: string | undefined;
  filters?: ReactNode | undefined;
  onClearFilters?: (() => void) | undefined;
  hasActiveFilters?: boolean | undefined;
  className?: string | undefined;
}

export type HrToolbarProps = ManagementToolbarProps;

/**
 * Shared Management Toolbar backwards-compatibility wrapper.
 * Standardized on the global UI Kit TableToolbar primitive.
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
  className,
}: ManagementToolbarProps) {
  return (
    <TableToolbar
      search={{
        value: search,
        onChange: onSearchChange,
        placeholder: searchPlaceholder,
        ariaLabel: searchLabel,
        onClear: () => onSearchChange(""),
      }}
      filters={filters}
      hasActiveFilters={hasActiveFilters}
      onClearFilters={onClearFilters}
      clearFiltersLabel="Clear"
      className={className}
    />
  );
}

export const HrToolbar = ManagementToolbar;
