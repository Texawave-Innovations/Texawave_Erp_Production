"use client";

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export interface FormSectionProps {
  stepNumber: string;
  title: string;
  description?: string;
  icon?: LucideIcon;
  children: ReactNode;
  className?: string;
}

/**
 * Reusable Form Section component for multi-part enterprise forms.
 * Displays numbered step badges, titles, descriptions, and grid layouts.
 */
export function FormSection({
  stepNumber,
  title,
  description,
  icon: Icon,
  children,
  className = "",
}: FormSectionProps) {
  return (
    <div
      className={`rounded-2xl border border-gray-200 bg-white p-5 shadow-theme-xs transition-shadow duration-200 hover:shadow-theme-sm dark:border-gray-800 dark:bg-gray-900 ${className}`}
    >
      {/* Header with Step Badge */}
      <div className="mb-4 flex items-center justify-between border-b border-gray-100 pb-3.5 dark:border-gray-800">
        <div className="flex items-center gap-3">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-50 text-[11px] font-bold text-brand-800 dark:bg-brand-950 dark:text-brand-300">
            {stepNumber}
          </span>
          <div>
            <h2 className="text-theme-sm font-bold text-gray-900 dark:text-white/90">
              {title}
            </h2>
            {description && (
              <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                {description}
              </p>
            )}
          </div>
        </div>

        {Icon && (
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400">
            <Icon className="h-4 w-4" aria-hidden="true" />
          </div>
        )}
      </div>

      {/* Form Content */}
      {children}
    </div>
  );
}
