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
  size?: "sm" | "md" | undefined;
  className?: string | undefined;
}

export interface FilterChipsProps {
  chips: FilterChipItem[];
  onClearAll?: () => void | undefined;
  clearAllLabel?: string | undefined;
  activeFiltersLabel?: string | undefined;
  size?: "sm" | "md" | undefined;
  className?: string | undefined;
}

function CloseIcon({
  className = "h-3.5 w-3.5",
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
  size = "md",
  className,
}: FilterChipProps) {
  const isSm = size === "sm";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-sky-100/90 bg-sky-50/80 font-medium text-slate-800 dark:border-slate-800 dark:bg-slate-800/80 dark:text-slate-200 transition-all shadow-2xs hover:border-sky-200 dark:hover:border-slate-700",
        isSm ? "px-2.5 py-0.5 text-[11px]" : "px-3 py-1 text-xs",
        disabled && "opacity-60 cursor-not-allowed",
        className,
      )}
    >
      {icon && (
        <span
          className={cn(
            "flex shrink-0 items-center justify-center text-slate-400 dark:text-slate-500",
            isSm ? "h-3 w-3" : "h-3.5 w-3.5",
          )}
        >
          {icon}
        </span>
      )}
      <span className="text-slate-500 dark:text-slate-400 font-normal">
        {label}:
      </span>
      <span className="text-slate-900 dark:text-white font-bold">{value}</span>
      <button
        type="button"
        disabled={disabled}
        onClick={onRemove}
        aria-label={`Remove filter for ${label}: ${value}`}
        className={cn(
          "ml-0.5 rounded-full p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-800 dark:hover:bg-slate-700 dark:hover:text-white transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-brand-500",
          disabled && "pointer-events-none opacity-50",
        )}
      >
        <CloseIcon className={isSm ? "h-3 w-3" : "h-3.5 w-3.5"} />
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
  size = "md",
  className,
}: FilterChipsProps) {
  if (chips.length === 0) return null;
  const isSm = size === "sm";

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <span
        className={cn(
          "font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mr-0.5",
          isSm ? "text-[10px]" : "text-xs",
        )}
      >
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
          size={size}
        />
      ))}

      {onClearAll && (
        <button
          type="button"
          onClick={onClearAll}
          className={cn(
            "inline-flex items-center gap-1 rounded-full border border-rose-200/90 bg-rose-50/90 font-bold text-rose-700 hover:bg-rose-100 hover:border-rose-300 dark:border-rose-900/60 dark:bg-rose-950/50 dark:text-rose-300 dark:hover:bg-rose-900/70 transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-rose-500 shadow-2xs",
            isSm ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs",
          )}
        >
          <CloseIcon className={isSm ? "h-3 w-3" : "h-3.5 w-3.5"} />
          <span>{clearAllLabel}</span>
        </button>
      )}
    </div>
  );
}
