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
 * Conforms to Section 6, 8 & Docs/DESIGN_SYSTEM.md.
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
      className={`rounded-2xl border border-gray-200 bg-white p-5 shadow-theme-xs transition-shadow duration-200 hover:shadow-theme-sm dark:border-gray-800 dark:bg-gray-900 ${className}`}
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-3 dark:border-gray-800">
        <div className="flex items-center gap-2.5">
          {Icon && (
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300">
              <Icon className="h-4 w-4" aria-hidden="true" />
            </div>
          )}
          <div>
            <h2
              id={headingId}
              className="text-theme-sm font-bold text-gray-900 dark:text-white/90"
            >
              {title}
            </h2>
            {description && (
              <p className="text-[11px] text-gray-500 dark:text-gray-400">
                {description}
              </p>
            )}
          </div>
        </div>

        {aside && <div className="flex items-center gap-2">{aside}</div>}
      </div>

      {children}
    </section>
  );
}

export const SectionCard = DashboardSection;
