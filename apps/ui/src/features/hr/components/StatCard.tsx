"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { AnimatedNumber } from "./AnimatedNumber";
import { MetricTrend, type MetricTrendProps } from "./MetricTrend";

export type StatCardTone =
  "neutral" | "brand" | "info" | "warning" | "error" | "success";

export interface StatCardProps {
  headingId: string;
  label: string;
  value: string | number;
  note: string;
  tone?: StatCardTone;
  icon?: LucideIcon;
  trend?: MetricTrendProps;
  href?: string;
  className?: string;
}

const TONE_VALUE_CLASS: Record<StatCardTone, string> = {
  neutral: "text-gray-900 dark:text-white/90",
  brand: "text-brand-700 dark:text-brand-400",
  info: "text-chart-1 dark:text-chart-1",
  warning: "text-warning-700 dark:text-warning-400",
  error: "text-error-700 dark:text-error-400",
  success: "text-success-700 dark:text-success-400",
};

const TONE_EDGE_CLASS: Record<StatCardTone, string> = {
  neutral: "bg-gray-300 dark:bg-gray-700",
  brand: "bg-brand-500",
  info: "bg-chart-1",
  warning: "bg-warning-500",
  error: "bg-error-500",
  success: "bg-success-500",
};

const TONE_ICON_BG: Record<StatCardTone, string> = {
  neutral: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300",
  brand: "bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300",
  info: "bg-blue-50 text-chart-1 dark:bg-blue-950/60 dark:text-chart-1",
  warning:
    "bg-warning-50 text-warning-700 dark:bg-warning-950 dark:text-warning-300",
  error: "bg-error-50 text-error-700 dark:bg-error-950 dark:text-error-300",
  success:
    "bg-success-50 text-success-700 dark:bg-success-950 dark:text-success-300",
};

/**
 * Reusable Enterprise StatCard component conforming to TEXA Design System.
 * Strictly maintains accessible heading and DOM structure tested across ERP modules.
 */
export function StatCard({
  headingId,
  label,
  value,
  note,
  tone = "neutral",
  icon: Icon,
  trend,
  href,
  className = "",
}: StatCardProps) {
  const valueClass = TONE_VALUE_CLASS[tone];
  const edgeClass = TONE_EDGE_CLASS[tone];
  const iconBg = TONE_ICON_BG[tone];

  const numericValue =
    typeof value === "number"
      ? value
      : !isNaN(Number(value)) && value.trim() !== ""
        ? Number(value)
        : null;

  return (
    <section
      aria-labelledby={headingId}
      className={`group relative overflow-hidden rounded-2xl border border-gray-200 bg-white p-5 shadow-theme-xs transition-all duration-200 hover:border-gray-300 hover:shadow-theme-sm dark:border-gray-800 dark:bg-gray-900 dark:hover:border-gray-700 ${className}`}
    >
      {/* Top accent hairline */}
      <span
        className={`absolute inset-x-0 top-0 h-1 transition-all group-hover:h-1.5 ${edgeClass}`}
        aria-hidden="true"
      />

      <div className="flex items-start justify-between gap-3">
        <h3
          id={headingId}
          className="text-theme-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400"
        >
          {label}
        </h3>

        {Icon && (
          <div
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-105 ${iconBg}`}
          >
            <Icon className="h-4.5 w-4.5" aria-hidden="true" />
          </div>
        )}
      </div>

      {/* Primary Value with count-up animation */}
      <p
        className={`mt-2 text-title-sm font-bold tracking-tight ${valueClass}`}
      >
        {numericValue !== null ? (
          <AnimatedNumber value={numericValue} />
        ) : (
          value
        )}
      </p>

      {/* Secondary note and optional trend badge */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-3 dark:border-gray-800">
        <p className="text-theme-xs font-medium text-gray-500 dark:text-gray-400">
          {note}
        </p>

        {trend && <MetricTrend {...trend} />}
      </div>

      {/* Accessible Stretched link overlay */}
      {href && (
        <Link
          href={href}
          aria-label={`${label}: ${value}. ${note}`}
          className="absolute inset-0 z-10 rounded-2xl transition-colors hover:bg-gray-50/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:hover:bg-white/2"
        />
      )}
    </section>
  );
}
