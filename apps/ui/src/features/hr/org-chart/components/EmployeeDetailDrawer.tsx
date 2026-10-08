"use client";

import Link from "next/link";
import { useEffect } from "react";
import { cn } from "@texawave-erp/ui-kit";
import type { OrgChartNode } from "../types";

interface EmployeeDetailDrawerProps {
  node: OrgChartNode | null;
  onClose: () => void;
}

/** Right-side drawer, off-canvas on every width (mobile included) — simpler
 * than a modal dialog for "glance at this person, then dismiss" and avoids
 * fighting the tree's own horizontal scroll container. */
export function EmployeeDetailDrawer({
  node,
  onClose,
}: EmployeeDetailDrawerProps) {
  useEffect(() => {
    if (!node) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [node, onClose]);

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-40 bg-gray-900/50 transition-opacity",
          node ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        role={node ? "dialog" : undefined}
        aria-modal={node ? true : undefined}
        aria-label={node ? `${node.fullName} details` : undefined}
        aria-hidden={node ? undefined : true}
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex w-full max-w-sm flex-col gap-4 overflow-y-auto border-l border-gray-200 bg-white p-5 shadow-theme-xl transition-transform dark:border-gray-800 dark:bg-gray-900",
          node ? "translate-x-0" : "translate-x-full",
        )}
      >
        {node ? (
          <>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-theme-sm font-semibold text-gray-900 dark:text-white/90">
                  {node.fullName}
                </h2>
                <p className="text-theme-xs text-gray-500 dark:text-gray-400">
                  {node.employeeCode}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800"
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <dl className="flex flex-col gap-3 text-theme-sm">
              <div>
                <dt className="text-theme-xs text-gray-500 dark:text-gray-400">
                  Designation
                </dt>
                <dd className="text-gray-900 dark:text-white/90">
                  {node.designation.name}
                </dd>
              </div>
              <div>
                <dt className="text-theme-xs text-gray-500 dark:text-gray-400">
                  Department
                </dt>
                <dd className="text-gray-900 dark:text-white/90">
                  {node.department?.name ?? "—"}
                </dd>
              </div>
              <div>
                <dt className="text-theme-xs text-gray-500 dark:text-gray-400">
                  Team
                </dt>
                <dd className="text-gray-900 dark:text-white/90">
                  {node.team.name}
                </dd>
              </div>
              <div>
                <dt className="text-theme-xs text-gray-500 dark:text-gray-400">
                  Direct reports
                </dt>
                <dd className="text-gray-900 dark:text-white/90">
                  {node.directReportCount}
                </dd>
              </div>
            </dl>

            <Link
              href={`/hr/employees/${node.id}/profile`}
              className="mt-auto inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-brand-500 px-4 text-theme-sm font-medium text-gray-900 shadow-theme-xs transition-colors hover:bg-brand-600 dark:bg-brand-400 dark:text-gray-900 dark:hover:bg-brand-300"
            >
              View full profile
            </Link>
          </>
        ) : null}
      </aside>
    </>
  );
}
