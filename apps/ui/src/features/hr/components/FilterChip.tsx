"use client";

import { X } from "lucide-react";

export interface FilterChipItem {
  id: string;
  label: string;
  value: string;
  onRemove: () => void;
}

export interface FilterChipsProps {
  chips: FilterChipItem[];
  onClearAll?: () => void;
  className?: string;
}

/**
 * Reusable Filter Chip component conforming to TEXA Design System.
 * Displays active filter tokens with quick-dismiss action and optional "Clear all".
 */
export function FilterChip({
  label,
  value,
  onRemove,
}: {
  label: string;
  value: string;
  onRemove: () => void;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50/80 px-2.5 py-1 text-[11px] font-semibold text-gray-700 dark:border-gray-800 dark:bg-gray-800/60 dark:text-gray-300 transition-colors">
      <span className="text-gray-400 dark:text-gray-500 font-normal">
        {label}:
      </span>
      <span className="text-gray-900 dark:text-white font-bold">{value}</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove filter for ${label}: ${value}`}
        className="ml-0.5 rounded-full p-0.5 text-gray-400 hover:bg-gray-200 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-white transition-colors focus-visible:outline-2 focus-visible:outline-brand-500"
      >
        <X className="h-3 w-3" aria-hidden="true" />
      </button>
    </span>
  );
}

export function FilterChips({
  chips,
  onClearAll,
  className = "",
}: FilterChipsProps) {
  if (chips.length === 0) return null;

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 mr-0.5">
        Active filters:
      </span>

      {chips.map((chip) => (
        <FilterChip
          key={chip.id}
          label={chip.label}
          value={chip.value}
          onRemove={chip.onRemove}
        />
      ))}

      {onClearAll && (
        <button
          type="button"
          onClick={onClearAll}
          className="rounded-md px-2 py-0.5 text-[11px] font-bold text-brand-700 hover:text-brand-800 hover:underline dark:text-brand-400 dark:hover:text-brand-300 transition-colors focus-visible:outline-2 focus-visible:outline-brand-500"
        >
          Clear all
        </button>
      )}
    </div>
  );
}
