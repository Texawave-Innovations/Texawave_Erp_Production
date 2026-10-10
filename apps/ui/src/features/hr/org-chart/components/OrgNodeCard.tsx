"use client";

import { ChevronDown, ChevronRight, Users } from "lucide-react";
import { cn } from "@texawave-erp/ui-kit";
import { EmployeeIdentity } from "@/features/hr/components/EmployeeIdentity";
import type { OrgChartNode } from "../types";

export interface OrgNodeCardProps {
  node: OrgChartNode;
  isMatched: boolean;
  isSelected?: boolean;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onSelect: () => void;
}

/**
 * Enterprise organization chart node card.
 * Displays employee identity, code, designation, department/team, and direct reports count.
 * Connects seamlessly to parent and child hierarchy connectors.
 */
export function OrgNodeCard({
  node,
  isMatched,
  isSelected = false,
  isCollapsed,
  onToggleCollapse,
  onSelect,
}: OrgNodeCardProps) {
  const hasChildren = node.directReportCount > 0;

  return (
    <div className="relative flex flex-col items-center">
      {/* Main Node Card Button — Triggers Employee Detail Drawer */}
      <button
        type="button"
        onClick={onSelect}
        aria-label={`View ${node.fullName}'s details`}
        className={cn(
          "group relative flex w-60 flex-col rounded-xl border bg-white p-3.5 text-left shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md dark:bg-neutral-900",
          isSelected
            ? "border-brand-600 ring-2 ring-brand-500/25 shadow-sm dark:border-brand-500 dark:ring-brand-500/30"
            : isMatched
              ? "border-brand-500 ring-2 ring-brand-400/40 dark:ring-brand-800"
              : "border-neutral-200/90 hover:border-neutral-300 dark:border-neutral-800 dark:hover:border-neutral-700",
        )}
      >
        {/* Top Header: Employee Identity (Avatar + Name + Code) */}
        <div className="flex items-center gap-3 w-full">
          <EmployeeIdentity
            name={node.fullName}
            code={node.employeeCode}
            avatarSize="md"
          />
        </div>

        {/* Role & Placement Details */}
        <div className="mt-3 flex w-full flex-col gap-0.5 border-t border-neutral-100 pt-2.5 dark:border-neutral-800">
          <span className="line-clamp-1 text-xs font-semibold text-neutral-900 dark:text-neutral-100">
            {node.designation.name}
          </span>
          <span className="line-clamp-1 text-[11px] text-neutral-500 dark:text-neutral-400">
            {node.department?.name ?? "General"} · {node.team.name}
          </span>
        </div>

        {/* Direct Reports & Inspection Hint */}
        {hasChildren ? (
          <div className="mt-2.5 flex w-full items-center justify-between border-t border-neutral-50 pt-2 text-[11px] font-medium text-neutral-500 dark:border-neutral-800/60 dark:text-neutral-400">
            <span className="inline-flex items-center gap-1 text-neutral-600 dark:text-neutral-300">
              <Users className="h-3 w-3 text-neutral-400 dark:text-neutral-500" />
              {node.directReportCount}{" "}
              {node.directReportCount === 1
                ? "direct report"
                : "direct reports"}
            </span>
            <span className="text-[10px] text-brand-600 group-hover:underline dark:text-brand-400">
              Details →
            </span>
          </div>
        ) : null}
      </button>

      {/* Expand / Collapse Button Pill underneath parent card */}
      {hasChildren ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleCollapse();
          }}
          aria-expanded={!isCollapsed}
          aria-label={
            isCollapsed
              ? `Expand ${node.fullName}'s reports`
              : `Collapse ${node.fullName}'s reports`
          }
          className="relative z-10 -mt-2 inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-white px-2.5 py-0.5 text-[11px] font-semibold text-neutral-700 shadow-xs transition-colors hover:bg-neutral-50 hover:border-neutral-300 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
        >
          {isCollapsed ? (
            <ChevronRight className="h-3 w-3 text-neutral-400" />
          ) : (
            <ChevronDown className="h-3 w-3 text-neutral-400" />
          )}
          <span>{node.directReportCount}</span>
        </button>
      ) : null}
    </div>
  );
}
