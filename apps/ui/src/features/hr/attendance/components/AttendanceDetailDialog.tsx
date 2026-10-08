"use client";

import { ApiError } from "@texawave-erp/core";
import { Button, Dialog, ErrorState, Skeleton } from "@texawave-erp/ui-kit";
import { useAttendanceRecord } from "../hooks";
import { formatMinutes, formatTime } from "../status";
import { AttendanceStatusBadge } from "./AttendanceStatusBadge";

export interface AttendanceDetailDialogProps {
  open: boolean;
  onClose: () => void;
  id: number;
  canEdit: boolean;
  onEdit: () => void;
}

/** Read-only drill-down for one employee/day: punches and the derived hours.
 * Editing opens ManualEditAttendanceDialog, which is the only write path. */
export function AttendanceDetailDialog({
  open,
  onClose,
  id,
  canEdit,
  onEdit,
}: AttendanceDetailDialogProps) {
  const record = useAttendanceRecord(id);

  return (
    <Dialog open={open} onClose={onClose} title="Attendance details">
      {record.isPending ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-5 w-1/2" />
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-full" />
        </div>
      ) : record.isError ? (
        record.error instanceof ApiError && record.error.statusCode === 404 ? (
          <p className="text-theme-sm text-gray-500 dark:text-gray-400">
            This record is no longer in your scope.
          </p>
        ) : (
          <ErrorState onRetry={() => void record.refetch()} />
        )
      ) : (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 text-theme-sm">
            <div>
              <div className="text-gray-500 dark:text-gray-400">Employee</div>
              <div className="font-medium">#{record.data.employeeId}</div>
            </div>
            <div>
              <div className="text-gray-500 dark:text-gray-400">Date</div>
              <div className="font-medium">{record.data.attendanceDate}</div>
            </div>
            <div>
              <div className="text-gray-500 dark:text-gray-400">Status</div>
              <AttendanceStatusBadge status={record.data.status} />
            </div>
            <div>
              <div className="text-gray-500 dark:text-gray-400">Worked</div>
              <div className="font-medium">
                {formatMinutes(record.data.workedMinutes)}
              </div>
            </div>
            <div>
              <div className="text-gray-500 dark:text-gray-400">Overtime</div>
              <div className="font-medium">
                {formatMinutes(record.data.overtimeMinutes)}
              </div>
            </div>
            <div>
              <div className="text-gray-500 dark:text-gray-400">Shortfall</div>
              <div className="font-medium">
                {formatMinutes(record.data.shortfallMinutes)}
              </div>
            </div>
          </div>

          <div>
            <div className="mb-2 text-theme-sm font-medium text-gray-700 dark:text-gray-300">
              Sessions
            </div>
            {record.data.sessions.length === 0 ? (
              <p className="text-theme-sm text-gray-500 dark:text-gray-400">
                No punches recorded.
              </p>
            ) : (
              <ul className="flex flex-col gap-1">
                {record.data.sessions.map((s) => (
                  <li key={s.id} className="text-theme-sm">
                    {formatTime(s.checkInAt)} –{" "}
                    {s.checkOutAt ? formatTime(s.checkOutAt) : "open"}{" "}
                    <span className="text-gray-400">({s.source})</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
            {canEdit ? <Button onClick={onEdit}>Edit</Button> : null}
          </div>
        </div>
      )}
    </Dialog>
  );
}
