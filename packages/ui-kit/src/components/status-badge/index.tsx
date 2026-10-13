import { cn } from "../../lib/cn";

export type StatusColorToken =
  "brand" | "gray" | "success" | "warning" | "error";

export interface StatusBadgeProps {
  label: string;
  colorToken: StatusColorToken;
  className?: string;
}

// Complete literal map — see Docs/DESIGN_SYSTEM.md "Tailwind class literals".
const COLOR_CLASSES: Record<StatusColorToken, string> = {
  brand: "bg-brand-50 text-brand-800 dark:bg-brand-950 dark:text-brand-300",
  gray: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  success:
    "bg-success-50 text-success-700 dark:bg-success-950 dark:text-success-300",
  warning:
    "bg-warning-50 text-warning-700 dark:bg-warning-950 dark:text-warning-300",
  error: "bg-error-50 text-error-700 dark:bg-error-950 dark:text-error-300",
};

/**
 * The ONLY way a status/color_token renders in the app — every module reads
 * `color_token` off its `statuses` row (or, for the reference fixture, off
 * `Tag.colorToken`) and hands it here; there is no per-module reimplementation
 * (Docs/CODING_STANDARDS.md §12). Renders the label as text, never a bare
 * color swatch — see Docs/DESIGN_SYSTEM.md "never rely on color alone".
 */
const DOT_CLASSES: Record<StatusColorToken, string> = {
  brand: "bg-brand-500",
  gray: "bg-gray-400",
  success: "bg-success-500",
  warning: "bg-warning-500",
  error: "bg-error-500",
};

export function StatusBadge({
  label,
  colorToken,
  className,
}: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-theme-xs font-medium",
        COLOR_CLASSES[colorToken],
        className,
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full shrink-0",
          DOT_CLASSES[colorToken],
        )}
        aria-hidden="true"
      />
      {label}
    </span>
  );
}
