"use client";

import { History } from "lucide-react";
import { Dialog, EmptyState, ErrorState, Skeleton } from "@texawave-erp/ui-kit";
import { useTaskHistory } from "../hooks";
import { shiftDate } from "../week-grid";
import {
  ATTENDANCE_CLASS,
  ATTENDANCE_DEFAULT_CLASS,
  ATTENDANCE_LABEL,
  formatMinutes,
  formatShortDate,
} from "./format";

/** How many days back from the selected day the panel shows (API max 62). */
const HISTORY_DAYS = 14;
/** A full bar is a standard 8-hour day. */
const FULL_DAY_MINUTES = 8 * 60;

/**
 * One task's time, day by day, for the two weeks up to the selected day:
 * minutes worked each day against an 8-hour day, the task's progress that
 * day and HR's status for it. Days with no work on the task are listed
 * (0 minutes) so a gap is visible. Read-only.
 */
export function TaskHistoryDialog({
  taskId,
  title,
  toDate,
  onClose,
  onOpenDay,
}: {
  taskId: number;
  title: string;
  toDate: string;
  onClose: () => void;
  onOpenDay: (date: string) => void;
}) {
  const from = shiftDate(toDate, -(HISTORY_DAYS - 1));
  const { data, isLoading, isError, refetch } = useTaskHistory(
    taskId,
    from,
    toDate,
  );
  const days = data ? [...data.days].reverse() : [];

  return (
    <Dialog
      open
      onClose={onClose}
      size="2xl"
      icon={<History className="h-5 w-5" />}
      title="Task time history"
      subtitle={
        data
          ? `${data.task.taskCode} · ${data.task.title}${data.task.projectName ? ` · ${data.task.projectName}` : ""}`
          : title
      }
    >
      {isLoading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
      ) : isError ? (
        <ErrorState
          title="Could not load the task history"
          onRetry={() => void refetch()}
        />
      ) : data ? (
        <div className="flex flex-col gap-4">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {formatShortDate(data.from)} – {formatShortDate(data.to)}:{" "}
            <span className="text-sm font-extrabold text-gray-900 dark:text-white">
              {formatMinutes(data.totalMinutes)}
            </span>{" "}
            on this task over{" "}
            {days.filter((d) => !d.carried && d.minutes > 0).length} day(s).
            Each bar is measured against an 8-hour day.
          </p>
          {days.length === 0 ? (
            <EmptyState
              title="No history in this range"
              description="Nothing was recorded on this task in the last two weeks."
            />
          ) : (
            <ul className="flex flex-col divide-y divide-gray-100 dark:divide-gray-800">
              {days.map((d) => {
                const worked = !d.carried && d.minutes > 0;
                const width = `${Math.min(d.minutes / FULL_DAY_MINUTES, 1) * 100}%`;
                return (
                  <li
                    key={d.date}
                    className="grid grid-cols-[6.5rem_1fr_4.5rem] items-center gap-3 py-2 sm:grid-cols-[6.5rem_1fr_4.5rem_9rem]"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        onOpenDay(d.date);
                        onClose();
                      }}
                      className="text-left text-xs font-semibold text-gray-700 hover:underline dark:text-gray-200"
                      aria-label={`Open ${formatShortDate(d.date)} in the day view`}
                    >
                      {formatShortDate(d.date)}
                    </button>
                    <div
                      className="h-3 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800"
                      role="img"
                      aria-label={`${formatMinutes(d.minutes)} of an 8-hour day`}
                    >
                      {worked ? (
                        <span
                          className="block h-full rounded-full bg-brand-500"
                          style={{ width }}
                        />
                      ) : null}
                    </div>
                    <span
                      className={`text-right text-xs font-bold ${worked ? "text-gray-900 dark:text-white" : "text-gray-400 dark:text-gray-500"}`}
                    >
                      {formatMinutes(d.minutes)}
                    </span>
                    <span className="col-span-3 flex flex-wrap items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400 sm:col-span-1">
                      <span className="truncate">{d.label}</span>
                      {d.attendanceStatus &&
                      d.attendanceStatus !== "PRESENT" ? (
                        <span
                          className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${ATTENDANCE_CLASS[d.attendanceStatus] ?? ATTENDANCE_DEFAULT_CLASS}`}
                        >
                          {ATTENDANCE_LABEL[d.attendanceStatus] ??
                            d.attendanceStatus}
                        </span>
                      ) : null}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
    </Dialog>
  );
}
