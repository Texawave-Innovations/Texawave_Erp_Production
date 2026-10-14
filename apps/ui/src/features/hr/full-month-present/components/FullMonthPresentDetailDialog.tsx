"use client";

import { Calendar, CheckCircle2, Clock, User, XCircle } from "lucide-react";
import { Button, Card, Dialog } from "@texawave-erp/ui-kit";
import { EmployeeIdentity } from "@/features/hr/components/EmployeeIdentity";
import type { FullMonthPresentRow } from "../types";
import { FullMonthPresentStatusBadge } from "./FullMonthPresentStatusBadge";

export interface FullMonthPresentDetailDialogProps {
  open: boolean;
  onClose: () => void;
  row: FullMonthPresentRow;
}

/** Read-only drill-down: the per-day derived status behind one row's
 * qualification for the month. */
export function FullMonthPresentDetailDialog({
  open,
  onClose,
  row,
}: FullMonthPresentDetailDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`${row.employee.fullName} — ${row.month}`}
      size="lg"
    >
      <div className="flex flex-col gap-5">
        {/* Employee Header Panel */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl border border-gray-100 bg-gray-50/70 dark:border-gray-800 dark:bg-gray-900/60">
          <EmployeeIdentity
            name={row.employee.fullName}
            code={row.employee.employeeCode}
            avatarSize="md"
            size="md"
          />
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400">
              Month:
            </span>
            <span className="font-mono text-theme-xs font-semibold px-2 py-0.5 rounded bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white">
              {row.month}
            </span>
          </div>
        </div>

        {/* Qualification Indicators Grid (Preserving exact texts) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="p-3 rounded-lg border border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/40">
            <div className="text-[11px] font-medium text-gray-500 dark:text-gray-400">
              Employee code
            </div>
            <div className="font-semibold text-theme-xs text-gray-900 dark:text-white mt-0.5">
              {row.employee.employeeCode}
            </div>
          </div>

          <div
            className={`p-3 rounded-lg border transition-all ${
              row.fullMonthPresent
                ? "border-emerald-200/80 bg-emerald-50/60 text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300"
                : "border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/40 text-gray-900 dark:text-white"
            }`}
          >
            <div className="text-[11px] font-medium opacity-80">
              Full Month Present
            </div>
            <div className="font-bold text-theme-xs mt-0.5 inline-flex items-center gap-1">
              {row.fullMonthPresent ? (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  Yes
                </>
              ) : (
                <>
                  <XCircle className="h-3.5 w-3.5 text-gray-400" />
                  No
                </>
              )}
            </div>
          </div>

          <div className="p-3 rounded-lg border border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/40">
            <div className="text-[11px] font-medium text-gray-500 dark:text-gray-400">
              Month complete
            </div>
            <div className="font-semibold text-theme-xs text-gray-900 dark:text-white mt-0.5">
              {row.monthComplete ? "Yes" : "No"}
            </div>
          </div>

          <div className="p-3 rounded-lg border border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/40">
            <div className="text-[11px] font-medium text-gray-500 dark:text-gray-400">
              Employed whole month
            </div>
            <div className="font-semibold text-theme-xs text-gray-900 dark:text-white mt-0.5">
              {row.employedWholeMonth ? "Yes" : "No"}
            </div>
          </div>
        </div>

        {/* Attendance Days Section (Preserving exact text 'Days') */}
        <div>
          <div className="flex items-center justify-between mb-2.5">
            <h3 className="text-theme-sm font-semibold text-gray-900 dark:text-white">
              Days
            </h3>
            <span className="text-[11px] text-gray-500 dark:text-gray-400">
              {row.days.length} days counted • {row.presentDays} present
            </span>
          </div>

          {row.days.length === 0 ? (
            <div className="py-8 text-center border rounded-xl border-dashed border-gray-200 dark:border-gray-800">
              <p className="text-theme-sm text-gray-500 dark:text-gray-400">
                No days counted yet for this month.
              </p>
            </div>
          ) : (
            <ul
              className="grid max-h-72 grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3 md:grid-cols-4 p-0.5"
              role="list"
            >
              {row.days.map((d) => (
                <li
                  key={d.attendanceDate}
                  className="flex items-center justify-between gap-2 rounded-lg border border-gray-100 bg-gray-50/60 px-3 py-2 text-theme-xs dark:border-gray-800 dark:bg-gray-800/40"
                >
                  <span className="font-mono font-medium text-gray-700 dark:text-gray-300">
                    Day {d.attendanceDate.slice(-2)}
                  </span>
                  <FullMonthPresentStatusBadge status={d.status} />
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex justify-end pt-2 border-t border-gray-100 dark:border-gray-800">
          <Button type="button" variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
