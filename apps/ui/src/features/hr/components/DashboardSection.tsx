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
      className={`rounded-2xl border border-gray-200 bg-white p-5 shadow-theme-xs transition-shadow duration-200 hover:shadow-theme-sm dark:border-[#1C2029] dark:bg-[#0D1117] ${className}`}
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-3 dark:border-[#1C2029]">
        <div className="flex items-center gap-2.5">
          {Icon && (
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gray-100 text-gray-600 dark:border dark:border-[#1C2029] dark:bg-[#161B26] dark:text-[#A78BFA]">
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
