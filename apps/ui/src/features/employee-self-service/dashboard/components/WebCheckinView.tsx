"use client";

import { Alert } from "@texawave-erp/ui-kit";
import { useTodayAttendance } from "../useTodayAttendance";
import { AttendanceClockCard } from "./AttendanceClockCard";

/**
 * The legacy "Check In / Out" page (TexaWave_ERP_old
 * src/modules/employee/WebCheckin.tsx): a centered "Attendance" heading with
 * today's date, then the clock card with today's sessions. Uses the same
 * self-service check-in/out API as My Attendance.
 */
export function WebCheckinView() {
  const attendance = useTodayAttendance();

  if (!attendance.canPunch) {
    return (
      <Alert variant="warning" title="You don't have access to check in">
        Ask an administrator for the{" "}
        <code>employee_self_service.attendance.punch</code> permission.
      </Alert>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-5">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Attendance
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {new Intl.DateTimeFormat("en-IN", {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric",
          }).format(new Date())}
        </p>
      </div>
      <AttendanceClockCard attendance={attendance} centered />
    </div>
  );
}
