"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowUpRight,
  Lock,
  Minus,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { AnimatedNumber } from "@texawave-erp/ui-kit";
import { WidgetState } from "@/features/hr/components";
import { formatValue } from "../format";
import type { Kpi, Part } from "../types";

/** Striped fill used for "pending / nothing recorded" marks, as in the reference. */
export const STRIPES =
  "repeating-linear-gradient(135deg, rgba(100,116,139,0.55) 0 2.5px, transparent 2.5px 8px)";

export function DashboardCard({
  title,
  headingId,
  action,
  children,
  className = "",
}: {
  title: string;
  headingId: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      aria-labelledby={headingId}
      className={`flex flex-col rounded-3xl border border-gray-100 bg-white p-5 shadow-theme-xs transition-shadow duration-300 hover:shadow-theme-md dark:border-[#1C2029] dark:bg-[#0D1117] ${className}`}
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2
          id={headingId}
          className="truncate text-lg font-semibold text-[#0a3271] dark:text-sky-100"
        >
          {title}
        </h2>
        {action}
      </div>
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </section>
  );
}

/** Small outlined pill link used as a card action ("View all", "+ New"). */
export function PillLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="inline-flex shrink-0 items-center gap-1 rounded-full border border-sky-200 bg-white px-3 py-1 text-xs font-semibold text-[#0284c7] transition-colors hover:bg-sky-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:border-sky-800/60 dark:bg-transparent dark:text-sky-300 dark:hover:bg-sky-950/40"
    >
      {children}
    </Link>
  );
}

/**
 * Loading / error / no-access wrapper for one widget part. A part whose query
 * is disabled (no permission) has no data and is not loading.
 */
export function PartView<T>({
  part,
  label,
  skeletonHeight,
  children,
}: {
  part: Part<T>;
  label: string;
  skeletonHeight: string;
  children: (data: T) => ReactNode;
}) {
  if (!part.loading && !part.error && part.data === null) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 py-8 text-center">
        <Lock className="h-5 w-5 text-gray-400" aria-hidden="true" />
        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">
          You don&apos;t have access to {label}.
        </p>
      </div>
    );
  }
  return (
    <WidgetState
      isPending={part.loading && part.data === null}
      isError={part.error}
      onRetry={part.retry}
      label={label}
      skeletonHeight={skeletonHeight}
    >
      {part.data !== null ? children(part.data) : null}
    </WidgetState>
  );
}

const TREND_ICON = { up: TrendingUp, down: TrendingDown, flat: Minus } as const;

export function KpiCard({
  kpi,
  highlighted,
  className = "",
}: {
  kpi: Kpi;
  highlighted: boolean;
  className?: string;
}) {
  const Trend = TREND_ICON[kpi.direction ?? "flat"];
  const headingId = `kpi-${kpi.id}`;
  return (
    <Link
      href={kpi.href}
      aria-labelledby={headingId}
      className={`group relative flex min-h-[150px] flex-col overflow-hidden rounded-3xl p-5 transition-all duration-300 hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 motion-reduce:transition-none motion-reduce:hover:translate-y-0 ${
        highlighted
          ? "bg-linear-135 from-blue-600 via-sky-500 to-cyan-400 text-white shadow-lg shadow-sky-500/25"
          : "border border-gray-100 bg-white text-[#0a3271] shadow-theme-xs hover:shadow-theme-md dark:border-[#1C2029] dark:bg-[#0D1117] dark:text-sky-100"
      } ${className}`}
    >
      {highlighted && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -left-10 -top-16 h-44 w-44 rounded-full bg-white/25 blur-3xl"
        />
      )}
      <div className="relative flex items-start justify-between gap-3">
        <h3 id={headingId} className="text-base font-semibold leading-tight">
          {kpi.label}
        </h3>
        <span
          aria-hidden="true"
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-transform duration-300 group-hover:rotate-45 motion-reduce:transition-none ${
            highlighted
              ? "bg-white text-[#0284c7]"
              : "border border-sky-200 bg-sky-50 text-[#0284c7] dark:border-sky-800/60 dark:bg-sky-950/40 dark:text-sky-300"
          }`}
        >
          <ArrowUpRight className="h-4.5 w-4.5" />
        </span>
      </div>

      <p className="relative mt-3 text-[2.6rem] font-semibold leading-none tracking-tight tabular-nums">
        {kpi.value === null ? (
          <span aria-label="Not available">—</span>
        ) : (
          <AnimatedNumber
            value={kpi.value}
            duration={900}
            formatter={(v) => formatValue(v, kpi.format)}
          />
        )}
      </p>

      <p
        className={`relative mt-auto flex items-center gap-1.5 pt-4 text-xs font-medium ${
          highlighted
            ? "text-white/90"
            : kpi.direction === "down"
              ? "text-error-600 dark:text-error-400"
              : "text-[#0284c7] dark:text-sky-300"
        }`}
      >
        <span
          aria-hidden="true"
          className={`flex h-4 w-5 items-center justify-center rounded border ${
            highlighted ? "border-white/60" : "border-current/60"
          }`}
        >
          <Trend className="h-3 w-3" />
        </span>
        <span className="truncate">{kpi.note}</span>
      </p>
    </Link>
  );
}
