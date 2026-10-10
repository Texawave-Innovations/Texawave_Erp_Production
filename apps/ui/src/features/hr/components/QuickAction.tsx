"use client";

import Link from "next/link";
import { ChevronRight, type LucideIcon } from "lucide-react";

export interface QuickActionProps {
  href: string;
  label: string;
  description: string;
  icon?: LucideIcon;
  badge?: string;
  tone?: "brand" | "info" | "warning" | "neutral";
}

const TONE_CLASSES = {
  brand:
    "bg-brand-50 text-brand-700 group-hover:bg-brand-100 dark:bg-brand-950 dark:text-brand-300 dark:group-hover:bg-brand-900",
  info: "bg-blue-50 text-blue-700 group-hover:bg-blue-100 dark:bg-blue-950/60 dark:text-blue-300 dark:group-hover:bg-blue-900",
  warning:
    "bg-warning-50 text-warning-700 group-hover:bg-warning-100 dark:bg-warning-950 dark:text-warning-300 dark:group-hover:bg-warning-900",
  neutral:
    "bg-gray-100 text-gray-700 group-hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:group-hover:bg-gray-700",
};

/**
 * Reusable Enterprise QuickAction Tile.
 * Supports icon, badge, label, description, and hover micro-animations.
 */
export function QuickAction({
  href,
  label,
  description,
  icon: Icon,
  badge,
  tone = "brand",
}: QuickActionProps) {
  return (
    <Link
      href={href}
      className="group relative flex items-center justify-between gap-3.5 rounded-xl border border-gray-200 bg-gray-50/70 p-3.5 transition-all duration-200 hover:border-brand-300 hover:bg-white hover:shadow-theme-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:border-gray-800 dark:bg-white/2 dark:hover:border-brand-500/40 dark:hover:bg-gray-900"
    >
      <div className="flex items-center gap-3 min-w-0">
        {Icon && (
          <div
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-transform duration-200 group-hover:scale-105 ${TONE_CLASSES[tone]}`}
          >
            <Icon className="h-4.5 w-4.5" aria-hidden="true" />
          </div>
        )}
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate text-theme-xs font-bold text-gray-900 group-hover:text-brand-700 dark:text-white/90 dark:group-hover:text-brand-400 transition-colors">
              {label}
            </span>
            {badge && (
              <span className="rounded bg-brand-50 px-1.5 py-0.5 text-[10px] font-semibold text-brand-700 dark:bg-brand-950 dark:text-brand-300">
                {badge}
              </span>
            )}
          </div>
          <p className="truncate text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
            {description}
          </p>
        </div>
      </div>

      <ChevronRight className="h-4 w-4 shrink-0 text-gray-400 transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-brand-600 dark:text-gray-500 dark:group-hover:text-brand-400" />
    </Link>
  );
}

export const QuickActionTile = QuickAction;
