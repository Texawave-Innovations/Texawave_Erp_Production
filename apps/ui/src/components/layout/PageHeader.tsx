"use client";

import type { ReactNode } from "react";

export interface PageHeaderProps {
  breadcrumbs: string[];
  title: string;
  description: string;
  action?: ReactNode;
}

export type HrPageHeaderProps = PageHeaderProps;

/**
 * Standardized Page Header & Breadcrumbs.
 * Used uniformly across Dashboard, Departments, Users, Roles, Navigation Menu.
 * Conforms to Docs/DESIGN_SYSTEM.md and Docs/CODING_STANDARDS.md.
 */
export function PageHeader({
  breadcrumbs,
  title,
  description,
  action,
}: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-3">
      {/* Breadcrumb Hierarchy */}
      <nav aria-label="Breadcrumb">
        <ol className="flex items-center gap-1.5 text-theme-xs font-medium text-gray-500 dark:text-gray-400">
          {breadcrumbs.map((crumb, idx) => {
            const isLast = idx === breadcrumbs.length - 1;
            return (
              <li key={crumb} className="flex items-center gap-1.5">
                {idx > 0 && (
                  <span className="text-gray-400 dark:text-gray-600">›</span>
                )}
                <span
                  className={
                    isLast
                      ? "font-semibold text-gray-900 dark:text-white/90"
                      : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                  }
                >
                  {crumb}
                </span>
              </li>
            );
          })}
        </ol>
      </nav>

      {/* Title, Subtitle, & Primary Action */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-title-sm font-bold tracking-tight text-gray-900 dark:text-white/90">
            {title}
          </h1>
          <p className="mt-1 text-theme-sm text-gray-500 dark:text-gray-400">
            {description}
          </p>
        </div>

        {action && <div className="shrink-0">{action}</div>}
      </div>
    </div>
  );
}

export const HrPageHeader = PageHeader;
