"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

export interface PipelineStage {
  label: string;
  count: number | null;
}

export interface PipelineFunnelProps {
  stages: PipelineStage[];
  href?: string;
}

function pct(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
}

/**
 * Reusable Recruitment Pipeline Funnel.
 * Renders stage progression with conversion metrics, accessible ordered list, and footnotes.
 */
export function PipelineFunnel({
  stages,
  href = "/hr/recruitment",
}: PipelineFunnelProps) {
  return (
    <div className="flex flex-col gap-4">
      <ol
        className="grid grid-cols-1 items-stretch gap-3 sm:grid-cols-3 xl:grid-cols-5"
        aria-label="Recruitment pipeline stages"
      >
        {stages.map((stage, idx) => {
          const next = stages[idx + 1];
          const conv =
            stage.count !== null &&
            stage.count > 0 &&
            next?.count !== null &&
            next?.count !== undefined
              ? pct(next.count, stage.count)
              : null;

          return (
            <li key={stage.label} className="relative">
              <Link
                href={href}
                className="group flex h-full flex-col justify-between rounded-xl border border-gray-200 bg-gray-50/70 p-3.5 transition-all duration-200 hover:border-brand-300 hover:bg-white hover:shadow-theme-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:border-gray-800 dark:bg-white/2 dark:hover:border-brand-500/40 dark:hover:bg-gray-900"
              >
                <div>
                  <div className="flex items-center justify-between text-[11px] font-semibold text-gray-600 dark:text-gray-300">
                    <span className="truncate group-hover:text-brand-700 dark:group-hover:text-brand-400 transition-colors">
                      {stage.label}
                    </span>
                    <span className="rounded bg-white px-1.5 py-0.5 text-[10px] font-bold text-gray-500 shadow-theme-xs dark:bg-gray-800 dark:text-gray-400">
                      Step {idx + 1}
                    </span>
                  </div>

                  {stage.count === null ? (
                    <p className="mt-2 text-theme-xs font-semibold text-gray-400 dark:text-gray-500">
                      Not tracked
                    </p>
                  ) : (
                    <p className="mt-2 text-title-sm font-bold text-gray-900 dark:text-white/90">
                      {stage.count}
                    </p>
                  )}
                </div>

                <div className="mt-3 border-t border-gray-100 pt-2 dark:border-gray-800/80">
                  {conv !== null ? (
                    <div className="flex items-center gap-1 text-[11px] font-semibold text-brand-700 dark:text-brand-400">
                      <ArrowRight
                        className="h-3 w-3 shrink-0"
                        aria-hidden="true"
                      />
                      <span>{conv}% to next stage</span>
                    </div>
                  ) : (
                    <span className="text-[11px] text-gray-400 dark:text-gray-500">
                      {stage.count === null ? "Pipeline end" : "Active stage"}
                    </span>
                  )}
                </div>
              </Link>
            </li>
          );
        })}
      </ol>

      <p className="border-t border-gray-100 pt-3 text-[11px] text-gray-500 dark:border-gray-800 dark:text-gray-400">
        Scheduled, interviewed and selected come from interview records; offered
        counts offer letters. Applicants and hires are not tracked in production
        yet.
      </p>
    </div>
  );
}
