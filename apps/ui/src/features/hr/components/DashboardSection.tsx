"use client";

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export interface DashboardSectionProps {
  title: string;
  headingId: string;
  description?: string;
  icon?: LucideIcon;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}

/**
 * Enterprise Dashboard Section Container.
 * Standardizes card, grid, and widget containers with distinct visible borders
 * and a cohesive light sky-cloud header theme matching the TexaOne banner palette.
 */
export function DashboardSection({
  title,
  headingId,
  description,
  icon: Icon,
  aside,
  children,
  className = "",
}: DashboardSectionProps) {
  return (
    <section
      aria-labelledby={headingId}
      className={`overflow-hidden rounded-2xl border border-sky-200/80 bg-white card-light-shadow hover:border-sky-300 dark:border-sky-900/60 dark:bg-gray-900 ${className}`}
    >
      {/* Cohesive Light Sky-Cloud Tinted Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-sky-200/70 bg-linear-to-r from-sky-50/90 via-[#f0f8ff] to-sky-50/60 px-5 py-3.5 dark:border-sky-900/60 dark:from-sky-950/40 dark:via-gray-900 dark:to-sky-950/20">
        <div className="flex items-center gap-2.5 min-w-0">
          {Icon && (
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white text-brand-600 border border-sky-200/70 shadow-2xs dark:bg-gray-800 dark:text-sky-300 dark:border-sky-800/60">
              <Icon className="h-4 w-4" aria-hidden="true" />
            </div>
          )}
          <div className="min-w-0">
            <h2
              id={headingId}
              className="text-theme-sm font-bold text-[#0a3271] dark:text-sky-100 truncate"
            >
              {title}
            </h2>
            {description && (
              <p className="text-[11px] font-medium text-[#2f6396] dark:text-sky-300/80 truncate">
                {description}
              </p>
            )}
          </div>
        </div>

        {aside && (
          <div className="flex items-center gap-2 shrink-0">{aside}</div>
        )}
      </div>

      {/* Card Content Body */}
      <div className="p-5">{children}</div>
    </section>
  );
}

export const SectionCard = DashboardSection;
