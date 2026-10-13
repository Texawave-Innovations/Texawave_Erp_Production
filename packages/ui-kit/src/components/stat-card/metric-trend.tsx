import { cn } from "../../lib/cn";

export interface MetricTrendProps {
  value: number | string;
  direction: "up" | "down" | "neutral";
  label?: string | undefined;
  isPositive?: boolean | undefined;
  className?: string | undefined;
}

function TrendingUpIcon() {
  return (
    <svg
      className="h-3 w-3 shrink-0"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
      <polyline points="16 7 22 7 22 13" />
    </svg>
  );
}

function TrendingDownIcon() {
  return (
    <svg
      className="h-3 w-3 shrink-0"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="22 17 13.5 8.5 8.5 13.5 2 7" />
      <polyline points="16 17 22 17 22 11" />
    </svg>
  );
}

function MinusIcon() {
  return (
    <svg
      className="h-3 w-3 shrink-0"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

/**
 * MetricTrend displays trend changes with accessible semantic coloring.
 * Green for positive, red for negative, neutral gray for steady.
 */
export function MetricTrend({
  value,
  direction,
  label,
  isPositive,
  className = "",
}: MetricTrendProps) {
  const isGood = isPositive !== undefined ? isPositive : direction === "up";

  const colorClass =
    direction === "neutral"
      ? "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
      : isGood
        ? "bg-success-50 text-success-700 dark:bg-success-950 dark:text-success-300"
        : "bg-error-50 text-error-700 dark:bg-error-950 dark:text-error-300";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
        colorClass,
        className,
      )}
      aria-label={`Trend: ${direction} ${value}${label ? ` ${label}` : ""}`}
    >
      {direction === "up" && <TrendingUpIcon />}
      {direction === "down" && <TrendingDownIcon />}
      {direction === "neutral" && <MinusIcon />}
      <span>{value}</span>
      {label && <span className="text-[10px] opacity-75">{label}</span>}
    </span>
  );
}
