import { businessToday } from "../../common/dates/business-date.js";
import { BusinessRuleViolationException } from "../../common/exceptions/business.exception.js";
import { AttendanceService } from "../hr/attendance/attendance.service.js";
import { QueryMyAttendanceDto } from "../hr/attendance/dto/attendance.dto.js";

/** Today's attendance as the stopwatch sees it (legacy My Work read the
 * same day's `hr/attendance` node). */
export interface AttendanceGateStatus {
  /** An open (not checked-out) attendance session exists right now. */
  checkedIn: boolean;
  /** The employee has an attendance record for today at all. */
  hasRecordToday: boolean;
  /** Latest check-out instant today, if any. */
  lastCheckOutAt: Date | null;
}

/** The caller's attendance today, read through HR Attendance's public service
 * (Docs/CODING_STANDARDS.md §11 — no access to its repository). Shared by the
 * legacy timer service and the task lifecycle so both apply the same gate. */
export async function readMyAttendanceStatus(
  attendance: AttendanceService,
  now: Date = new Date(),
): Promise<AttendanceGateStatus> {
  const today = businessToday(now);
  const query = Object.assign(new QueryMyAttendanceDto(), {
    from: today,
    to: today,
    page: 1,
    limit: 5,
  });
  const page = await attendance.findMine(query);
  const day =
    page.items.find((v) => v.attendanceDate === today) ?? page.items[0];
  if (!day) {
    return { checkedIn: false, hasRecordToday: false, lastCheckOutAt: null };
  }
  const checkOuts = day.sessions
    .map((s) => s.checkOutAt)
    .filter((d): d is Date => d instanceof Date);
  const lastCheckOutAt =
    checkOuts.length > 0
      ? new Date(Math.max(...checkOuts.map((d) => d.getTime())))
      : null;
  return {
    checkedIn: day.hasOpenSession,
    hasRecordToday: true,
    lastCheckOutAt,
  };
}

/** The stopwatch only runs while the employee is checked in (legacy gate). */
export function assertCheckedIn(status: AttendanceGateStatus): void {
  if (status.checkedIn) return;
  throw new BusinessRuleViolationException(
    status.hasRecordToday
      ? "You are checked out — check in again to start a timer"
      : "Check in for today before starting a timer",
    "ATTENDANCE_CHECK_IN_REQUIRED",
  );
}
