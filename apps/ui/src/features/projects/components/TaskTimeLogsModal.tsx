"use client";

import { Clock, History, Pause, Play } from "lucide-react";
import { Button, Dialog, ErrorState, Skeleton } from "@texawave-erp/ui-kit";
import { useTaskTimeEntries } from "../hooks";
import { formatDate } from "../format";
import type { ProjectTask } from "../types";
import { StatusBadge } from "./HealthBadge";

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "Running...";
  return new Date(value).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function formatDuration(mins: number, live: boolean, startedAt: string) {
  if (live) {
    const elapsed = Math.max(
      1,
      Math.round((Date.now() - new Date(startedAt).getTime()) / 60000),
    );
    return `${elapsed} mins (Live)`;
  }
  if (mins < 60) return `${mins} mins`;
  return `${(mins / 60).toFixed(1)} hrs (${mins} mins)`;
}

export interface TaskTimeLogsModalProps {
  open: boolean;
  onClose: () => void;
  task: ProjectTask | null;
  /** Shown in the summary line when the task row lacks an embedded project. */
  projectLabel?: string;
}

/** Legacy `components/TaskTimeLogsModal.tsx` — start/stop session history
 * for one task, fed by `GET /projects/tasks/:taskId/time-entries`. */
export function TaskTimeLogsModal({
  open,
  onClose,
  task,
  projectLabel,
}: TaskTimeLogsModalProps) {
  const entriesQuery = useTaskTimeEntries(open && task ? task.id : undefined);
  const entries = entriesQuery.data ?? [];
  const totalMinutes = entries.reduce(
    (sum, e) => sum + (e.durationMinutes || 0),
    0,
  );

  return (
    <Dialog
      open={open && Boolean(task)}
      onClose={onClose}
      size="3xl"
      title={
        <span className="flex flex-wrap items-center justify-between gap-3">
          <span className="flex items-center gap-3">
            <span className="rounded-xl bg-sky-50 p-2 text-brand-600 dark:bg-sky-950/40 dark:text-cyan-400">
              <History className="h-5 w-5" />
            </span>
            <span>
              <span className="block text-base font-bold text-gray-900 dark:text-white">
                Timer Logs &amp; Activity History
              </span>
              <span className="block text-xs font-medium text-gray-500 dark:text-gray-400">
                Detailed record of start, stop &amp; total working sessions
              </span>
            </span>
          </span>
          <span className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-black text-brand-700 dark:border-sky-900/50 dark:bg-sky-950/40 dark:text-cyan-300">
            Total Logged: {(totalMinutes / 60).toFixed(1)}h
          </span>
        </span>
      }
    >
      {task ? (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-gray-100 bg-gray-50 p-3.5 text-xs dark:border-gray-800 dark:bg-gray-800/40">
            <div>
              <span className="mr-2 rounded-lg border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] font-black text-brand-700 dark:border-sky-900/50 dark:bg-sky-950/40 dark:text-cyan-300">
                {task.taskCode}
              </span>
              <span className="font-bold text-gray-800 dark:text-gray-200">
                {task.title}
              </span>
              <p className="mt-0.5 text-[10px] font-semibold text-gray-400">
                Assigned: {task.assignedTo?.fullName ?? "Unassigned"}
                {task.project
                  ? ` • Project: ${task.project.name} (${task.project.projectCode})`
                  : projectLabel
                    ? ` • Project: ${projectLabel}`
                    : ""}
              </p>
            </div>
            <StatusBadge status={task.status} />
          </div>

          <div className="flex flex-col gap-2">
            <h4 className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-gray-500 dark:text-gray-400">
              <Clock className="h-3.5 w-3.5 text-gray-400" />
              Start &amp; Stop Session Records ({entries.length})
            </h4>

            {entriesQuery.isPending ? (
              <div className="flex flex-col gap-2" aria-busy="true">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            ) : entriesQuery.isError ? (
              <ErrorState
                title="Could not load time logs"
                onRetry={() => entriesQuery.refetch()}
              />
            ) : entries.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/50 py-10 text-center text-xs italic text-gray-400 dark:border-gray-700 dark:bg-gray-800/30">
                No timer sessions recorded yet for this deliverable.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-gray-100 dark:border-gray-800">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50 text-[11px] font-black uppercase text-gray-500 dark:bg-gray-800/60 dark:text-gray-400">
                    <tr>
                      <th className="px-3 py-2.5">Session Date</th>
                      <th className="px-3 py-2.5">Start Time</th>
                      <th className="px-3 py-2.5">Stop Time</th>
                      <th className="px-3 py-2.5 text-center">Duration</th>
                      <th className="px-3 py-2.5 text-right">Logged By</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {entries.map((entry) => {
                      const running = !entry.endedAt;
                      return (
                        <tr
                          key={entry.id}
                          className="hover:bg-gray-50/70 dark:hover:bg-gray-800/30"
                        >
                          <td className="px-3 py-3 font-semibold text-gray-700 dark:text-gray-300">
                            {formatDate(entry.entryDate)}
                          </td>
                          <td className="px-3 py-3">
                            <span className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300">
                              <Play className="h-2.5 w-2.5 fill-current" />
                              {formatDateTime(entry.startedAt)}
                            </span>
                          </td>
                          <td className="px-3 py-3">
                            {running ? (
                              <span className="inline-flex items-center gap-1 rounded-md border border-emerald-300 bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200">
                                <span className="h-1.5 w-1.5 animate-ping rounded-full bg-emerald-600 motion-reduce:animate-none" />
                                Running Now
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
                                <Pause className="h-2.5 w-2.5 fill-current" />
                                {formatDateTime(entry.endedAt)}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-3 text-center font-extrabold text-gray-800 dark:text-gray-200">
                            {formatDuration(
                              entry.durationMinutes || 0,
                              running,
                              entry.startedAt,
                            )}
                          </td>
                          <td className="px-3 py-3 text-right font-medium text-gray-500 dark:text-gray-400">
                            {entry.employee?.fullName ?? "Staff"}
                            {entry.notes ? (
                              <span className="block text-[10px] italic text-gray-400">
                                {entry.notes}
                              </span>
                            ) : null}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="flex justify-end border-t border-gray-100 pt-4 dark:border-gray-800">
            <Button type="button" variant="secondary" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      ) : null}
    </Dialog>
  );
}
