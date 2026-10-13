"use client";

import { type ReactNode } from "react";
import { cn } from "../../lib/cn";

export interface FilterChipItem {
  id: string;
  label: string;
  value: string;
  onRemove: () => void;
  disabled?: boolean | undefined;
  icon?: ReactNode | undefined;
}

export interface FilterChipProps {
  label: string;
  value: string;
  onRemove: () => void;
  disabled?: boolean | undefined;
  icon?: ReactNode | undefined;
  className?: string | undefined;
}

export interface FilterChipsProps {
  chips: FilterChipItem[];
  onClearAll?: () => void | undefined;
  clearAllLabel?: string | undefined;
  activeFiltersLabel?: string | undefined;
  className?: string | undefined;
}

function CloseIcon({
  className = "h-3 w-3",
}: {
  className?: string | undefined;
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

/**
 * Reusable single FilterChip component conforming to TexaOne design system.
 * Displays active filter token with quick-dismiss action.
 */
export function FilterChip({
  label,
  value,
  onRemove,
  disabled = false,
  icon,
  className,
}: FilterChipProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50/80 px-2.5 py-1 text-[11px] font-semibold text-gray-700 dark:border-gray-800 dark:bg-gray-800/60 dark:text-gray-300 transition-colors",
        disabled && "opacity-60 cursor-not-allowed",
        className,
      )}
    >
      {icon && (
        <span className="flex h-3 w-3 shrink-0 items-center justify-center text-gray-400 dark:text-gray-500">
          {icon}
        </span>
      )}
      <span className="text-gray-400 dark:text-gray-500 font-normal">
        {label}:
      </span>
      <span className="text-gray-900 dark:text-white font-bold">{value}</span>
      <button
        type="button"
        disabled={disabled}
        onClick={onRemove}
        aria-label={`Remove filter for ${label}: ${value}`}
        className={cn(
          "ml-0.5 rounded-full p-0.5 text-gray-400 hover:bg-gray-200 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-white transition-colors focus-visible:outline-2 focus-visible:outline-brand-500",
          disabled && "pointer-events-none opacity-50",
        )}
      >
        <CloseIcon className="h-3 w-3" />
      </button>
    </span>
  );
}

/**
 * Reusable FilterChips group component conforming to TexaOne design system.
 * Displays a collection of active filter tokens with an optional "Clear all" action.
 */
export function FilterChips({
  chips,
  onClearAll,
  clearAllLabel = "Clear all",
  activeFiltersLabel = "Active filters:",
  className,
}: FilterChipsProps) {
  if (chips.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 mr-0.5">
        {activeFiltersLabel}
      </span>

      {chips.map((chip) => (
        <FilterChip
          key={chip.id}
          label={chip.label}
          value={chip.value}
          onRemove={chip.onRemove}
          disabled={chip.disabled}
          icon={chip.icon}
        />
      ))}

      {onClearAll && (
        <button
          type="button"
          onClick={onClearAll}
          className="rounded-md px-2 py-0.5 text-[11px] font-bold text-brand-700 hover:text-brand-800 hover:underline dark:text-brand-400 dark:hover:text-brand-300 transition-colors focus-visible:outline-2 focus-visible:outline-brand-500"
        >
          {clearAllLabel}
        </button>
      )}
    </div>
  );
}
