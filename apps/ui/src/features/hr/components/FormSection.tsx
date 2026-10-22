"use client";

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Semantic3DIcon, type Icon3DName } from "@texawave-erp/ui-kit";

export interface FormSectionProps {
  stepNumber: string;
  title: string;
  description?: string;
  icon?: LucideIcon;
  icon3d?: Icon3DName;
  children: ReactNode;
  className?: string;
}

/**
 * Reusable Form Section component for multi-part enterprise forms.
 * Displays executive prime-blue with light-contrast headers, numbered step badges,
 * dimensional 3D vector graphics, descriptions, and grid layouts.
 */
export function FormSection({
  stepNumber,
  title,
  description,
  icon: Icon,
  icon3d,
  children,
  className = "",
}: FormSectionProps) {
  return (
    <div
      className={`relative focus-within:z-30 rounded-2xl border border-sky-200/90 bg-white shadow-[0_4px_24px_-4px_rgba(23,105,245,0.08)] dark:border-sky-800/80 dark:bg-gray-900 transition-all duration-200 hover:shadow-[0_8px_30px_-6px_rgba(23,105,245,0.12)] ${className}`}
    >
      {/* Prime Blue Header with Light Contrast */}
      <div className="flex items-center justify-between border-b border-sky-200/90 bg-linear-to-r from-[#edf6ff] via-[#f0f8ff] to-[#e6f4fe] px-6 py-4.5 rounded-t-2xl dark:border-slate-700/80 dark:from-slate-800/90 dark:via-slate-850 dark:to-slate-900/60">
        <div className="flex items-center gap-3.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-[#1769F5] to-[#0284c7] text-[12px] font-black text-white shadow-xs ring-2 ring-sky-200/80 dark:ring-sky-800/60">
            {stepNumber}
          </span>
          <div>
            <h2 className="text-theme-sm font-bold tracking-tight text-[#0a3271] dark:text-sky-100">
              {title}
            </h2>
            {description && (
              <p className="mt-0.5 text-[11px] font-medium text-[#2f6396] dark:text-sky-300/80">
                {description}
              </p>
            )}
          </div>
        </div>

        {icon3d ? (
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-sky-200/90 bg-white/95 p-1.5 shadow-[0_2px_10px_rgba(23,105,245,0.1)] dark:border-gray-700/80 dark:bg-gray-800 select-none">
            <Semantic3DIcon name={icon3d} size={28} />
          </div>
        ) : Icon ? (
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-sky-200/90 bg-white/90 text-brand-600 shadow-xs dark:border-gray-700/80 dark:bg-gray-800 dark:text-sky-300">
            <Icon className="h-4 w-4" aria-hidden="true" />
          </div>
        ) : null}
      </div>

      {/* Form Content */}
      <div className="p-6">
        {children}
      </div>
    </div>
  );
}
