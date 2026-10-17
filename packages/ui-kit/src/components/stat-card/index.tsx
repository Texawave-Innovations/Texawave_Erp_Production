import type { ComponentType } from "react";
import { cn } from "../../lib/cn";
import { AnimatedNumber } from "./animated-number";
import { MetricTrend, type MetricTrendProps } from "./metric-trend";

export * from "./animated-number";
export * from "./metric-trend";

export type StatCardTone =
  | "neutral"
  | "brand"
  | "info"
  | "warning"
  | "error"
  | "success"
  | "blue"
  | "purple"
  | "emerald"
  | "amber";

export type StatCardVariant = "standard" | "kpi";

export interface StatCardProps {
  headingId: string;
  label: string;
  value: string | number;
  note: string;
  tone?: StatCardTone | undefined;
  icon?: ComponentType<{ className?: string }> | undefined;
  trend?: MetricTrendProps | undefined;
  href?: string | undefined;
  onClick?: ((e: React.MouseEvent<HTMLElement>) => void) | undefined;
  LinkComponent?:
    | ComponentType<{
        href: string;
        className?: string | undefined;
        children?: React.ReactNode | undefined;
        "aria-label"?: string | undefined;
        onClick?: ((e: React.MouseEvent<HTMLElement>) => void) | undefined;
      }>
    | undefined;
  variant?: StatCardVariant | undefined;
  className?: string | undefined;
}

const TONE_VALUE_CLASS: Record<StatCardTone, string> = {
  neutral: "text-gray-900 dark:text-white/90",
  brand: "text-brand-700 dark:text-brand-400",
  info: "text-chart-1 dark:text-chart-1",
  warning: "text-warning-700 dark:text-warning-400",
  error: "text-error-700 dark:text-error-400",
  success: "text-success-700 dark:text-success-400",
  blue: "text-blue-700 dark:text-blue-400",
  purple: "text-sky-700 dark:text-sky-400",
  emerald: "text-emerald-700 dark:text-emerald-400",
  amber: "text-amber-700 dark:text-amber-400",
};

const TONE_EDGE_CLASS: Record<StatCardTone, string> = {
  neutral: "bg-gray-300 dark:bg-gray-700",
  brand: "bg-brand-500",
  info: "bg-chart-1",
  warning: "bg-warning-500",
  error: "bg-error-500",
  success: "bg-success-500",
  blue: "bg-blue-500",
  purple: "bg-sky-500",
  emerald: "bg-emerald-500",
  amber: "bg-amber-500",
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
  blue: "bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-300",
  purple: "bg-sky-50 text-sky-600 dark:bg-sky-950 dark:text-sky-300",
  emerald:
    "bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-300",
  amber: "bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-300",
};

const TONE_BORDER_CLASS: Record<StatCardTone, string> = {
  neutral: "gradient-card-border",
  brand: "gradient-card-border",
  info: "gradient-card-border-info",
  warning: "gradient-card-border-warning",
  error: "gradient-card-border-error",
  success: "gradient-card-border-success",
  blue: "gradient-card-border-info",
  purple: "gradient-card-border-info",
  emerald: "gradient-card-border-success",
  amber: "gradient-card-border-warning",
};

const TONE_GRADIENT_CLASS: Record<StatCardTone, string> = {
  blue: "stat-card-gradient-blue border-blue-100/70 dark:border-blue-900/40",
  purple: "stat-card-gradient-cyan border-sky-100/70 dark:border-sky-900/40",
  emerald:
    "stat-card-gradient-emerald border-emerald-100/70 dark:border-emerald-900/40",
  amber:
    "stat-card-gradient-amber border-amber-100/70 dark:border-amber-900/40",
  brand: "stat-card-gradient-blue border-sky-100/70 dark:border-sky-900/40",
  info: "stat-card-gradient-blue border-cyan-100/70 dark:border-cyan-900/40",
  warning:
    "stat-card-gradient-amber border-amber-100/70 dark:border-amber-900/40",
  error: "stat-card-gradient-rose border-rose-100/70 dark:border-rose-900/40",
  success:
    "stat-card-gradient-emerald border-emerald-100/70 dark:border-emerald-900/40",
  neutral:
    "stat-card-gradient-neutral border-slate-100/80 dark:border-gray-800",
};

const KPI_ICON_GRADIENTS: Record<
  StatCardTone,
  { bg: string; shadow: string; aura: string }
> = {
  blue: {
    bg: "bg-linear-135 from-blue-600 via-sky-500 to-cyan-400 text-white",
    shadow: "shadow-md shadow-blue-500/25",
    aura: "bg-sky-400/25",
  },
  purple: {
    bg: "bg-linear-135 from-sky-600 via-cyan-500 to-blue-500 text-white",
    shadow: "shadow-md shadow-sky-500/25",
    aura: "bg-sky-400/25",
  },
  emerald: {
    bg: "bg-linear-135 from-emerald-600 via-teal-500 to-cyan-400 text-white",
    shadow: "shadow-md shadow-emerald-500/25",
    aura: "bg-emerald-400/25",
  },
  amber: {
    bg: "bg-linear-135 from-amber-500 via-orange-400 to-yellow-400 text-white",
    shadow: "shadow-md shadow-amber-500/25",
    aura: "bg-amber-400/25",
  },
  brand: {
    bg: "bg-linear-135 from-blue-600 via-sky-500 to-cyan-400 text-white",
    shadow: "shadow-md shadow-blue-500/25",
    aura: "bg-sky-400/25",
  },
  info: {
    bg: "bg-linear-135 from-cyan-600 to-blue-500 text-white",
    shadow: "shadow-md shadow-cyan-500/25",
    aura: "bg-cyan-400/25",
  },
  success: {
    bg: "bg-linear-135 from-emerald-600 to-teal-400 text-white",
    shadow: "shadow-md shadow-emerald-500/25",
    aura: "bg-emerald-400/25",
  },
  warning: {
    bg: "bg-linear-135 from-amber-500 to-orange-400 text-white",
    shadow: "shadow-md shadow-amber-500/25",
    aura: "bg-amber-400/25",
  },
  error: {
    bg: "bg-linear-135 from-rose-600 to-pink-500 text-white",
    shadow: "shadow-md shadow-rose-500/25",
    aura: "bg-rose-400/25",
  },
  neutral: {
    bg: "bg-linear-135 from-slate-600 to-gray-500 text-white",
    shadow: "shadow-md shadow-slate-500/20",
    aura: "bg-slate-400/15",
  },
};

/**
 * Reusable Enterprise StatCard component conforming to TEXA Design System.
 * Supports standard enterprise cards and rich KPI horizontal cards.
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
  onClick,
  LinkComponent,
  variant = "standard",
  className = "",
}: StatCardProps) {
  const valueClass = TONE_VALUE_CLASS[tone];
  const edgeClass = TONE_EDGE_CLASS[tone];
  const borderClass = TONE_BORDER_CLASS[tone];
  const iconBg = TONE_ICON_BG[tone];
  const kpiTheme = KPI_ICON_GRADIENTS[tone];
  const gradientBg = TONE_GRADIENT_CLASS[tone];

  const numericValue =
    typeof value === "number"
      ? value
      : !isNaN(Number(value)) && String(value).trim() !== ""
        ? Number(value)
        : null;

  if (variant === "kpi") {
    return (
      <section
        aria-labelledby={headingId}
        className={cn(
          "group relative flex items-center gap-4 overflow-hidden rounded-2xl p-5 border border-sky-100/90 card-light-shadow transition-all duration-300 hover:-translate-y-0.5 hover:border-sky-300/80 dark:border-sky-950/60 dark:hover:border-sky-700/60",
          gradientBg,
          className,
        )}
      >
        {Icon && (
          <div className="relative shrink-0">
            <span
              className={cn(
                "absolute -inset-1.5 rounded-2xl blur-md -z-10",
                kpiTheme.aura,
              )}
              aria-hidden="true"
            />
            <div
              className={cn(
                "flex h-14 w-14 items-center justify-center rounded-2xl transition-transform duration-200 group-hover:scale-105",
                kpiTheme.bg,
                kpiTheme.shadow,
              )}
            >
              <Icon className="h-7 w-7" />
            </div>
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h3
              id={headingId}
              className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-gray-400 truncate"
            >
              {label}
            </h3>
            {trend && <MetricTrend {...trend} />}
          </div>

          <p className="mt-1 text-2xl sm:text-[28px] font-extrabold tracking-tight text-slate-900 dark:text-white leading-none">
            {numericValue !== null ? (
              <AnimatedNumber value={numericValue} />
            ) : (
              value
            )}
          </p>

          <p className="mt-1.5 text-xs font-medium text-slate-500 dark:text-gray-400 truncate">
            {note}
          </p>
        </div>

        {(href || onClick) &&
          (LinkComponent && href ? (
            <LinkComponent
              href={href}
              {...(onClick ? { onClick } : {})}
              aria-label={`${label}: ${value}. ${note}`}
              className="absolute inset-0 z-10 rounded-2xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
            />
          ) : (
            <a
              href={href || "#"}
              {...(onClick ? { onClick } : {})}
              aria-label={`${label}: ${value}. ${note}`}
              className="absolute inset-0 z-10 rounded-2xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
            />
          ))}
      </section>
    );
  }

  return (
    <section
      aria-labelledby={headingId}
      className={cn(
        "group relative overflow-hidden rounded-2xl p-5 card-light-shadow transition-all duration-200 border",
        gradientBg,
        borderClass,
        className,
      )}
    >
      {/* Subtle top accent hairline */}
      <span
        className={cn(
          "absolute inset-x-0 top-0 h-1 transition-all group-hover:h-1.5 opacity-40",
          edgeClass,
        )}
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
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-105",
              iconBg,
            )}
          >
            <Icon className="h-4.5 w-4.5" />
          </div>
        )}
      </div>

      {/* Primary Value with count-up animation */}
      <p
        className={cn(
          "mt-2 text-title-sm font-bold tracking-tight",
          valueClass,
        )}
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
      {(href || onClick) &&
        (LinkComponent && href ? (
          <LinkComponent
            href={href}
            {...(onClick ? { onClick } : {})}
            aria-label={`${label}: ${value}. ${note}`}
            className="absolute inset-0 z-10 rounded-2xl transition-colors hover:bg-gray-50/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:hover:bg-white/2"
          />
        ) : (
          <a
            href={href || "#"}
            {...(onClick ? { onClick } : {})}
            aria-label={`${label}: ${value}. ${note}`}
            className="absolute inset-0 z-10 rounded-2xl transition-colors hover:bg-gray-50/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:hover:bg-white/2"
          />
        ))}
    </section>
  );
}
