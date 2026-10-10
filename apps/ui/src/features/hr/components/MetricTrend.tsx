"use client";

import { TrendingUp, TrendingDown, Minus } from "lucide-react";

export interface MetricTrendProps {
  value: number | string;
  direction: "up" | "down" | "neutral";
  label?: string;
  isPositive?: boolean;
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
}: MetricTrendProps) {
  // Determine if trend is positive or negative (defaults to up = positive)
  const isGood = isPositive !== undefined ? isPositive : direction === "up";

  const colorClass =
    direction === "neutral"
      ? "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
      : isGood
        ? "bg-success-50 text-success-700 dark:bg-success-950 dark:text-success-300"
        : "bg-error-50 text-error-700 dark:bg-error-950 dark:text-error-300";

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${colorClass}`}
      aria-label={`Trend: ${direction} ${value}${label ? ` ${label}` : ""}`}
    >
      {direction === "up" && (
        <TrendingUp className="h-3 w-3" aria-hidden="true" />
      )}
      {direction === "down" && (
        <TrendingDown className="h-3 w-3" aria-hidden="true" />
      )}
      {direction === "neutral" && (
        <Minus className="h-3 w-3" aria-hidden="true" />
      )}
      <span>{value}</span>
      {label && <span className="text-[10px] opacity-75">{label}</span>}
    </span>
  );
}
