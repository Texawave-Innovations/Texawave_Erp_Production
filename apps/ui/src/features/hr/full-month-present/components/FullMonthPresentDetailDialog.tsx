"use client";

import { Dialog } from "@texawave-erp/ui-kit";
import type { FullMonthPresentRow } from "../types";
import { FullMonthPresentStatusBadge } from "./FullMonthPresentStatusBadge";

export interface FullMonthPresentDetailDialogProps {
  open: boolean;
  onClose: () => void;
  row: FullMonthPresentRow;
}

/** Read-only drill-down: the per-day derived status behind one row's
 * qualification for the month. No separate fetch — the list row already
 * carries every day. */
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
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3 text-theme-sm">
          <div>
            <div className="text-gray-500 dark:text-gray-400">
              Employee code
            </div>
            <div className="font-medium">{row.employee.employeeCode}</div>
          </div>
          <div>
            <div className="text-gray-500 dark:text-gray-400">
              Full Month Present
            </div>
            <div className="font-medium">
              {row.fullMonthPresent ? "Yes" : "No"}
            </div>
          </div>
          <div>
            <div className="text-gray-500 dark:text-gray-400">
              Month complete
            </div>
            <div className="font-medium">
              {row.monthComplete ? "Yes" : "No"}
            </div>
          </div>
          <div>
            <div className="text-gray-500 dark:text-gray-400">
              Employed whole month
            </div>
            <div className="font-medium">
              {row.employedWholeMonth ? "Yes" : "No"}
            </div>
          </div>
        </div>

        <div>
          <div className="mb-2 text-theme-sm font-medium text-gray-700 dark:text-gray-300">
            Days
          </div>
          {row.days.length === 0 ? (
            <p className="text-theme-sm text-gray-500 dark:text-gray-400">
              No days counted yet for this month.
            </p>
          ) : (
            <ul className="grid max-h-64 grid-cols-2 gap-1 overflow-y-auto sm:grid-cols-3">
              {row.days.map((d) => (
                <li
                  key={d.attendanceDate}
                  className="flex items-center justify-between gap-2 text-theme-xs"
                >
                  <span>{d.attendanceDate.slice(-2)}</span>
                  <FullMonthPresentStatusBadge status={d.status} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Dialog>
  );
}
