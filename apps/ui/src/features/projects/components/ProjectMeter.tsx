import { cn } from "@texawave-erp/ui-kit";

interface ProjectMeterProps {
  label: string;
  /** Left caption, e.g. the amount used. */
  used: string;
  /** Right caption, e.g. "/ 120h". */
  total: string;
  /** 0–100; above 90 the bar turns to the error colour. */
  pct: number;
  className?: string;
}

/** A labelled usage bar (hours or budget) shared by the project table and board. */
export function ProjectMeter({
  label,
  used,
  total,
  pct,
  className,
}: ProjectMeterProps) {
  const clamped = Math.min(100, Math.max(0, pct));
  return (
    <div className={cn("min-w-32 space-y-1", className)}>
      <div className="flex items-baseline justify-between gap-2 text-theme-xs">
        <span className="font-semibold text-gray-800 dark:text-white/90">
          {used}
        </span>
        <span className="text-gray-500 dark:text-gray-400">
          {total} · {pct}%
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800"
      >
        <div
          className={cn(
            "h-full rounded-full",
            pct > 90 ? "bg-error-500" : "bg-brand-500",
          )}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}
