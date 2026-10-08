import type { ReactNode } from "react";
import Link from "next/link";
import { ErrorState, Skeleton } from "@texawave-erp/ui-kit";

/** Full class strings only: Tailwind cannot see classes built from a variable (CODING_STANDARDS §12). */
export const SEGMENT_STROKE = {
  brand: "stroke-brand-500",
  error: "stroke-error-500",
  warning: "stroke-warning-500",
  chart1: "stroke-chart-1",
  chart2: "stroke-chart-2",
  chart3: "stroke-chart-3",
  chart4: "stroke-chart-4",
  chart5: "stroke-chart-5",
} as const;

export const SEGMENT_FILL = {
  brand: "bg-brand-500",
  error: "bg-error-500",
  warning: "bg-warning-500",
  chart1: "bg-chart-1",
  chart2: "bg-chart-2",
  chart3: "bg-chart-3",
  chart4: "bg-chart-4",
  chart5: "bg-chart-5",
} as const;

export type SegmentTone = keyof typeof SEGMENT_STROKE;

/** Shared loading / error / content switch so every card fails the same way. */
export function WidgetState({
  isPending,
  isError,
  onRetry,
  label,
  children,
}: {
  isPending: boolean;
  isError: boolean;
  onRetry?: () => void;
  label: string;
  children: ReactNode;
}) {
  if (isError) {
    return (
      <ErrorState
        title={`${label} could not be loaded`}
        description="Figures are hidden rather than shown as zero."
        {...(onRetry ? { onRetry } : {})}
      />
    );
  }
  if (isPending) {
    return (
      <div role="status" className="space-y-2">
        <span className="sr-only">Loading {label}</span>
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }
  return <>{children}</>;
}

export function SectionCard({
  title,
  headingId,
  aside,
  children,
  className = "",
}: {
  title: string;
  headingId: string;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      aria-labelledby={headingId}
      className={`rounded-2xl border border-gray-200 bg-white p-6 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900 ${className}`}
    >
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h2
          id={headingId}
          className="text-theme-lg font-semibold text-gray-900 dark:text-white/90"
        >
          {title}
        </h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

export function KpiCard({
  label,
  value,
  note,
  tone,
  headingId,
  href,
}: {
  label: string;
  value: string;
  note: string;
  tone: "neutral" | "brand" | "info" | "warning" | "error";
  headingId: string;
  /** Optional destination for the figure's source page (e.g. the employee directory). Omit when there is no page to land on yet. */
  href?: string;
}) {
  const valueClass = {
    neutral: "text-gray-900 dark:text-white/90",
    brand: "text-brand-600 dark:text-brand-400",
    info: "text-chart-1 dark:text-chart-1",
    warning: "text-warning-600 dark:text-warning-400",
    error: "text-error-600 dark:text-error-400",
  }[tone];
  const edgeClass = {
    neutral: "bg-gray-300 dark:bg-gray-700",
    brand: "bg-brand-500",
    info: "bg-chart-1",
    warning: "bg-warning-500",
    error: "bg-error-500",
  }[tone];
  const body = (
    <>
      <span
        className={`absolute inset-x-0 top-0 h-1 ${edgeClass}`}
        aria-hidden="true"
      />
      <h3
        id={headingId}
        className="text-theme-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400"
      >
        {label}
      </h3>
      <p className={`mt-2 text-title-sm font-semibold ${valueClass}`}>
        {value}
      </p>
      <p className="mt-3 border-t border-gray-100 pt-3 text-theme-xs text-gray-500 dark:border-gray-800 dark:text-gray-400">
        {note}
      </p>
    </>
  );
  const boxClass =
    "relative overflow-hidden rounded-2xl border border-gray-200 bg-white p-5 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900";
  return (
    <section aria-labelledby={headingId} className={boxClass}>
      {body}
      {href && (
        // Stretched-link overlay: keeps the outer element a <section> (so its
        // accessible name and test hooks are unchanged) while making the whole
        // card a single tab stop that navigates to the figure's source page.
        <Link
          href={href}
          aria-label={`${label}: ${value}. ${note}`}
          className="absolute inset-0 z-10 rounded-2xl transition-colors hover:bg-gray-50/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:hover:bg-white/[0.03]"
        />
      )}
    </section>
  );
}

/** Navigation tile for the dashboard's "Quick actions" card. Styling matches KpiCard/SectionCard so it reads as the same family. */
export function QuickActionTile({
  href,
  label,
  description,
}: {
  href: string;
  label: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="flex flex-col gap-1 rounded-xl border border-gray-200 bg-gray-50 p-4 transition-colors hover:border-brand-300 hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:border-gray-800 dark:bg-white/[0.03] dark:hover:border-brand-500/40 dark:hover:bg-gray-900"
    >
      <span className="text-theme-sm font-semibold text-gray-900 dark:text-white/90">
        {label}
      </span>
      <span className="text-theme-xs text-gray-500 dark:text-gray-400">
        {description}
      </span>
    </Link>
  );
}

export interface DonutSegment {
  label: string;
  value: number;
  tone: SegmentTone;
}

/** Dependency-free SVG donut. Segments are drawn as dash arcs on one circle. */
export function Donut({
  segments,
  centerValue,
  centerLabel,
  label,
}: {
  segments: DonutSegment[];
  centerValue: string;
  centerLabel: string;
  label: string;
}) {
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  let offset = 0;
  return (
    <div className="relative h-40 w-40 shrink-0" role="img" aria-label={label}>
      <svg
        viewBox="0 0 100 100"
        className="h-full w-full -rotate-90"
        aria-hidden="true"
      >
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          strokeWidth="14"
          className="stroke-gray-100 dark:stroke-gray-800"
        />
        {total > 0 &&
          segments.map((s) => {
            if (s.value <= 0) return null;
            const length = (s.value / total) * circumference;
            const dash = `${length} ${circumference - length}`;
            const dashOffset = -offset;
            offset += length;
            return (
              <circle
                key={s.label}
                cx="50"
                cy="50"
                r={radius}
                fill="none"
                strokeWidth="14"
                strokeDasharray={dash}
                strokeDashoffset={dashOffset}
                className={SEGMENT_STROKE[s.tone]}
              />
            );
          })}
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-title-sm font-semibold text-gray-900 dark:text-white/90">
          {centerValue}
        </span>
        <span className="text-theme-xs text-gray-500 dark:text-gray-400">
          {centerLabel}
        </span>
      </div>
    </div>
  );
}

export function Legend({
  items,
}: {
  items: Array<{
    label: string;
    value: number;
    tone: SegmentTone;
    detail?: string;
  }>;
}) {
  const total = items.reduce((sum, i) => sum + i.value, 0);
  return (
    <ul className="min-w-0 flex-1 space-y-2">
      {items.map((item) => {
        const pct = total > 0 ? Math.round((item.value / total) * 100) : 0;
        return (
          <li
            key={item.label}
            className="flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5 dark:border-gray-800 dark:bg-white/[0.03]"
          >
            <span
              className={`h-2.5 w-2.5 shrink-0 rounded-full ${SEGMENT_FILL[item.tone]}`}
              aria-hidden="true"
            />
            <span className="min-w-0 flex-1">
              <span className="block text-theme-sm font-medium text-gray-800 dark:text-white/90">
                {item.label}
              </span>
              {item.detail ? (
                <span className="block text-theme-xs text-gray-500 dark:text-gray-400">
                  {item.detail}
                </span>
              ) : null}
            </span>
            <span className="text-theme-sm font-semibold text-gray-900 dark:text-white/90">
              {item.value}
              <span className="ml-1 text-theme-xs font-normal text-gray-500 dark:text-gray-400">
                ({pct}%)
              </span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
