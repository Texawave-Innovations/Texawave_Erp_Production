"use client";

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Semantic3DIcon, type Icon3DName } from "@texawave-erp/ui-kit";

export interface ExecutiveSectionCardProps {
  title: string;
  description?: string;
  icon3d?: Icon3DName;
  icon?: LucideIcon;
  action?: ReactNode;
  badge?: ReactNode;
  bordered?: boolean;
  className?: string;
  children: ReactNode;
}

/**
 * Reusable Enterprise Section Card with Prime Blue light-contrast header,
 * dimensional 3D vector graphics, and bordered visual grid container.
 */
export function ExecutiveSectionCard({
  title,
  description,
  icon3d,
  icon: Icon,
  action,
  badge,
  bordered = true,
  className = "",
  children,
}: ExecutiveSectionCardProps) {
  return (
    <div
      className={`overflow-visible rounded-2xl border border-sky-200/90 bg-white shadow-[0_4px_24px_-4px_rgba(23,105,245,0.08)] transition-all duration-200 hover:shadow-[0_8px_30px_-6px_rgba(23,105,245,0.12)] dark:border-slate-700/80 dark:bg-gray-900 ${className}`}
    >
      {/* Prime Blue Light-Contrast Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-sky-200/90 bg-linear-to-r from-[#edf6ff] via-[#f0f8ff] to-[#e6f4fe] px-6 py-4.5 rounded-t-2xl dark:border-slate-700/80 dark:from-slate-800/90 dark:via-slate-850 dark:to-slate-900/60">
        <div className="flex items-center gap-3">
          {icon3d ? (
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-sky-200/90 bg-white/95 p-1.5 shadow-[0_2px_10px_rgba(23,105,245,0.1)] dark:border-gray-700/80 dark:bg-gray-800 select-none">
              <Semantic3DIcon name={icon3d} size={28} />
            </div>
          ) : Icon ? (
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-sky-200/90 bg-white/95 p-1.5 shadow-[0_2px_10px_rgba(23,105,245,0.1)] dark:border-gray-700/80 dark:bg-gray-800 select-none">
              <Icon className="h-5 w-5 text-brand-500 dark:text-cyan-400" />
            </div>
          ) : null}
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-theme-sm font-bold tracking-tight text-[#0a3271] dark:text-sky-100">
                {title}
              </h2>
              {badge}
            </div>
            {description ? (
              <p className="mt-0.5 text-[11px] font-medium text-[#2f6396] dark:text-sky-300/80">
                {description}
              </p>
            ) : null}
          </div>
        </div>
        {action}
      </div>

      {/* Card Body */}
      <div className="p-6">
        {bordered ? (
          <div className="rounded-xl border border-sky-200/80 bg-linear-to-b from-[#f8fbff]/60 to-white p-5 shadow-2xs dark:border-slate-700/80 dark:bg-slate-800/40">
            {children}
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}
