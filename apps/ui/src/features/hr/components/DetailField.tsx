"use client";

import type { ReactNode, ComponentType } from "react";

export interface DetailFieldProps {
  label: string;
  children?: ReactNode;
  value?: ReactNode;
  icon?: ComponentType<{ className?: string }>;
  className?: string;
}

/**
 * Standard enterprise DetailField component for displaying key-value pairs
 * with Prime Blue uppercase labels, font-semibold values, and subtle elevation.
 */
export function DetailField({
  label,
  children,
  value,
  icon: Icon,
  className = "",
}: DetailFieldProps) {
  const content = children ?? value ?? "—";

  return (
    <div
      className={`flex min-w-0 flex-col gap-1 rounded-xl border border-sky-200/90 bg-white p-3.5 shadow-2xs transition-all hover:border-brand-400 hover:shadow-xs dark:border-slate-700 dark:bg-slate-900/80 dark:hover:border-slate-600 ${className}`}
    >
      <dt className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#2f6396] dark:text-sky-300">
        {Icon ? (
          <Icon className="h-3.5 w-3.5 text-brand-500 dark:text-sky-400" />
        ) : null}
        {label}
      </dt>
      <dd className="wrap-break-word text-theme-sm font-semibold text-[#0a3271] dark:text-white">
        {content}
      </dd>
    </div>
  );
}
