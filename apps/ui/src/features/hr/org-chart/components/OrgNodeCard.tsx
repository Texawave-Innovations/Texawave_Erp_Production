"use client";

import { cn } from "@texawave-erp/ui-kit";
import type { OrgChartNode } from "../types";

function initials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase();
}

interface OrgNodeCardProps {
  node: OrgChartNode;
  isMatched: boolean;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onSelect: () => void;
}

export function OrgNodeCard({
  node,
  isMatched,
  isCollapsed,
  onToggleCollapse,
  onSelect,
}: OrgNodeCardProps) {
  const hasChildren = node.directReportCount > 0;

  return (
    <div className="flex w-36 flex-col items-center gap-1 sm:w-40">
      <button
        type="button"
        onClick={onSelect}
        aria-label={`View ${node.fullName}'s details`}
        className={cn(
          "flex w-full flex-col items-center gap-1.5 rounded-xl border bg-white px-3 py-3 text-center shadow-theme-xs transition-transform hover:-translate-y-0.5 hover:shadow-theme-sm dark:bg-gray-900",
          isMatched
            ? "border-brand-500 ring-2 ring-brand-200 dark:ring-brand-900"
            : "border-gray-200 dark:border-gray-800",
        )}
      >
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-300 text-theme-sm font-semibold text-white">
          {initials(node.fullName)}
        </span>
        <span className="line-clamp-1 w-full text-theme-xs font-semibold text-gray-900 dark:text-white/90">
          {node.fullName}
        </span>
        <span className="line-clamp-1 w-full rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300">
          {node.designation.name}
        </span>
      </button>

      {hasChildren ? (
        <button
          type="button"
          onClick={onToggleCollapse}
          aria-expanded={!isCollapsed}
          aria-label={
            isCollapsed
              ? `Expand ${node.fullName}'s reports`
              : `Collapse ${node.fullName}'s reports`
          }
          className="flex items-center gap-1 rounded-full border border-gray-200 bg-white px-2 py-0.5 text-[11px] font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          <svg
            className={cn(
              "h-3 w-3 transition-transform",
              isCollapsed ? "" : "rotate-90",
            )}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
          {node.directReportCount}
        </button>
      ) : null}
    </div>
  );
}
