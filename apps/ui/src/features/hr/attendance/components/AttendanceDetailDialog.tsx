"use client";

import { useMemo } from "react";
import {
  Calendar,
  Clock,
  LogIn,
  LogOut,
  Pencil,
  Timer,
  TrendingUp,
} from "lucide-react";
import { ApiError } from "@texawave-erp/core";
import { Button, Dialog, ErrorState, Skeleton } from "@texawave-erp/ui-kit";
import { EmployeeIdentity } from "@/features/hr/components/EmployeeIdentity";
import { useAttendanceRecord } from "../hooks";
import { formatMinutes, formatTime } from "../status";
import { AttendanceStatusBadge } from "./AttendanceStatusBadge";

export interface AttendanceDetailDialogProps {
  open: boolean;
  onClose: () => void;
  id: number;
  canEdit: boolean;
  onEdit: () => void;
  employee?: {
    fullName: string;
    employeeCode: string;
    designation?: { name: string } | null;
  } | null;
}

function calculateSessionDuration(
  checkInIso: string,
  checkOutIso: string | null,
): string {
  if (!checkOutIso) return "In progress";
  const start = new Date(checkInIso).getTime();
  const end = new Date(checkOutIso).getTime();
  if (isNaN(start) || isNaN(end) || end <= start) return "—";
  const diffMinutes = Math.floor((end - start) / 60000);
  return formatMinutes(diffMinutes);
}

/** Read-only drill-down for one employee/day: punches and the derived hours.
 * Editing opens ManualEditAttendanceDialog, which is the only write path. */
export function AttendanceDetailDialog({
  open,
  onClose,
  id,
  canEdit,
  onEdit,
  employee,
}: AttendanceDetailDialogProps) {
  const record = useAttendanceRecord(id);

  const { firstIn, lastOut } = useMemo(() => {
    if (!record.data || record.data.sessions.length === 0) {
      return { firstIn: "—", lastOut: "—" };
    }
    const first = record.data.sessions[0];
    const last = record.data.sessions[record.data.sessions.length - 1];
    return {
      firstIn: first ? formatTime(first.checkInAt) : "—",
      lastOut: last?.checkOutAt
        ? formatTime(last.checkOutAt)
        : record.data.hasOpenSession
          ? "Open"
          : "—",
    };
  }, [record.data]);

  return (
    <Dialog open={open} onClose={onClose} title="Attendance details" size="lg">
      {record.isPending ? (
        <div className="flex flex-col gap-4 py-2">
          <div className="flex items-center gap-3">
            <Skeleton className="h-12 w-12 rounded-full" />
            <div className="flex flex-col gap-2 flex-1">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-28 w-full rounded-xl" />
        </div>
      ) : record.isError ? (
        record.error instanceof ApiError && record.error.statusCode === 404 ? (
          <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/40 text-center">
            <p className="text-theme-sm text-gray-500 dark:text-gray-400">
              This record is no longer in your scope.
            </p>
          </div>
        ) : (
          <ErrorState onRetry={() => void record.refetch()} />
        )
      ) : (
        <div className="flex flex-col gap-5">
          {/* Employee Header */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl border border-gray-100 bg-gray-50/70 dark:border-gray-800 dark:bg-gray-800/40">
            <EmployeeIdentity
              name={employee?.fullName ?? `Employee #${record.data.employeeId}`}
              code={employee?.employeeCode ?? `#${record.data.employeeId}`}
              subtext={employee?.designation?.name ?? "Company Employee"}
              size="md"
            />
            <AttendanceStatusBadge status={record.data.status} />
          </div>

          {/* Attendance Summary Grid */}
          <div>
            <h3 className="text-theme-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2.5">
              Day Summary
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              <div className="p-3 rounded-xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900 flex flex-col gap-1">
                <span className="flex items-center gap-1.5 text-theme-xs text-gray-500 dark:text-gray-400">
                  <Calendar className="h-3.5 w-3.5 text-gray-400" />
                  Date
                </span>
                <span className="font-semibold text-theme-sm text-gray-900 dark:text-white">
                  {record.data.attendanceDate}
                </span>
              </div>

              <div className="p-3 rounded-xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900 flex flex-col gap-1">
                <span className="flex items-center gap-1.5 text-theme-xs text-gray-500 dark:text-gray-400">
                  <LogIn className="h-3.5 w-3.5 text-emerald-500" />
                  First Check-in
                </span>
                <span className="font-semibold text-theme-sm text-gray-900 dark:text-white font-mono">
                  {firstIn}
                </span>
              </div>

              <div className="p-3 rounded-xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900 flex flex-col gap-1">
                <span className="flex items-center gap-1.5 text-theme-xs text-gray-500 dark:text-gray-400">
                  <LogOut className="h-3.5 w-3.5 text-amber-500" />
                  Last Check-out
                </span>
                <span className="font-semibold text-theme-sm text-gray-900 dark:text-white font-mono">
                  {lastOut}
                </span>
              </div>

              <div className="p-3 rounded-xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900 flex flex-col gap-1">
                <span className="flex items-center gap-1.5 text-theme-xs text-gray-500 dark:text-gray-400">
                  <Clock className="h-3.5 w-3.5 text-brand-500" />
                  Worked Time
                </span>
                <span className="font-semibold text-theme-sm text-emerald-700 dark:text-emerald-400">
                  {formatMinutes(record.data.workedMinutes)}
                </span>
              </div>

              <div className="p-3 rounded-xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900 flex flex-col gap-1">
                <span className="flex items-center gap-1.5 text-theme-xs text-gray-500 dark:text-gray-400">
                  <TrendingUp className="h-3.5 w-3.5 text-purple-500" />
                  Overtime
                </span>
                <span className="font-semibold text-theme-sm text-purple-700 dark:text-purple-400">
                  {formatMinutes(record.data.overtimeMinutes)}
                </span>
              </div>

              <div className="p-3 rounded-xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900 flex flex-col gap-1">
                <span className="flex items-center gap-1.5 text-theme-xs text-gray-500 dark:text-gray-400">
                  <Timer className="h-3.5 w-3.5 text-gray-400" />
                  Target / Shortfall
                </span>
                <span className="font-semibold text-theme-sm text-gray-700 dark:text-gray-300">
                  {record.data.shortfallMinutes > 0
                    ? `-${formatMinutes(record.data.shortfallMinutes)}`
                    : record.data.targetMinutes
                      ? formatMinutes(record.data.targetMinutes)
                      : "0h 00m"}
                </span>
              </div>
            </div>
          </div>

          {/* Sessions Section */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <h3 className="text-theme-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                Recorded Sessions ({record.data.sessions.length})
              </h3>
            </div>

            {record.data.sessions.length === 0 ? (
              <div className="p-4 text-center rounded-xl border border-dashed border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
                <p className="text-theme-sm text-gray-500 dark:text-gray-400">
                  No punches recorded for this date.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {record.data.sessions.map((s, idx) => (
                  <div
                    key={s.id}
                    className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900/60"
                  >
                    <div className="flex items-center gap-3">
                      <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-brand-50 text-[11px] font-bold text-brand-700 dark:bg-brand-950 dark:text-brand-300">
                        {idx + 1}
                      </span>
                      <div className="flex items-center gap-2 text-theme-sm font-mono text-gray-800 dark:text-gray-200">
                        <span>{formatTime(s.checkInAt)}</span>
                        <span className="text-gray-400">→</span>
                        <span>
                          {s.checkOutAt ? (
                            formatTime(s.checkOutAt)
                          ) : (
                            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                              Open
                            </span>
                          )}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-theme-xs font-medium text-gray-500 dark:text-gray-400">
                        {calculateSessionDuration(s.checkInAt, s.checkOutAt)}
                      </span>
                      <span className="rounded-md bg-gray-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                        {s.source}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Dialog Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-gray-100 dark:border-gray-800">
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
            {canEdit ? (
              <Button
                onClick={onEdit}
                className="inline-flex items-center gap-1.5"
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit Attendance
              </Button>
            ) : null}
          </div>
        </div>
      )}
    </Dialog>
  );
}
