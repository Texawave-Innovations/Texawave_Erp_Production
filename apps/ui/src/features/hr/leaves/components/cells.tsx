"use client";

import { DAY_PORTION_LABELS } from "../status";
import type { LeaveRequestItem } from "../types";

/** Table cells shared by every leave list, so they read the same everywhere. */
export function LeaveTypeCell({
  r,
}: {
  r: Pick<LeaveRequestItem, "leaveType">;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="font-medium text-gray-900 dark:text-white/90">
        {r.leaveType.name}
      </span>
      <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[11px] font-semibold text-gray-600 dark:bg-gray-800 dark:text-gray-400">
        {r.leaveType.code}
      </span>
    </div>
  );
}

export function LeaveDatesCell({
  r,
}: {
  r: Pick<LeaveRequestItem, "startDate" | "endDate" | "dayPortion">;
}) {
  return (
    <div className="flex flex-col">
      <span className="font-medium whitespace-nowrap text-gray-900 dark:text-white/90">
        {r.startDate === r.endDate
          ? r.startDate
          : `${r.startDate} – ${r.endDate}`}
      </span>
      {r.dayPortion !== "FULL" ? (
        <span className="text-[11px] font-medium text-brand-600 dark:text-brand-400">
          {DAY_PORTION_LABELS[r.dayPortion]}
        </span>
      ) : null}
    </div>
  );
}

export function LeaveDaysCell({
  r,
}: {
  r: Pick<LeaveRequestItem, "leaveDays">;
}) {
  return (
    <span className="font-semibold text-gray-900 dark:text-white/90">
      {r.leaveDays}{" "}
      <span className="text-theme-xs font-normal text-gray-500 dark:text-gray-400">
        {r.leaveDays === 1 ? "day" : "days"}
      </span>
    </span>
  );
}

/** "Applied by HR" when someone other than the employee submitted it. */
export function appliedByOther(
  r: Pick<LeaveRequestItem, "requestedBy" | "employee">,
): string | null {
  return r.requestedBy.fullName !== r.employee.fullName
    ? r.requestedBy.fullName
    : null;
}
