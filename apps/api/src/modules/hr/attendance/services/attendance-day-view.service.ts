import { Injectable } from "@nestjs/common";
import {
  AttendanceCalculationService,
  type EffectiveStatus,
  type StoredStatus,
} from "./attendance-calculation.service.js";
import {
  resolveCalendar,
  resolveTargetMinutes,
  type DayContext,
  type EmployeeRef,
} from "./attendance-day-resolver.js";

/** A stored attendance day as read from the database. `record` is null for a
 * day with no row (an unmarked day), so the view can still be computed. */
export interface StoredDay {
  recordId: number | null;
  employeeId: number;
  attendanceDate: string;
  storedStatus: StoredStatus | null;
  sessions: {
    id: number;
    checkInAt: Date;
    checkOutAt: Date | null;
    source: string;
  }[];
}

export interface DayView {
  recordId: number | null;
  employeeId: number;
  attendanceDate: string;
  storedStatus: StoredStatus | null;
  status: EffectiveStatus;
  targetMinutes: number | null;
  workedMinutes: number;
  overtimeMinutes: number;
  shortfallMinutes: number;
  hasOpenSession: boolean;
  sessions: StoredDay["sessions"];
}

/** Turns stored days into displayable views. This is the single consumer of
 * the calculation service on the read side: records, reports and corrections
 * all go through here, so no caller can derive a figure its own way. */
@Injectable()
export class AttendanceDayViewService {
  constructor(private readonly calculation: AttendanceCalculationService) {}

  build(
    ctx: DayContext,
    employees: ReadonlyMap<number, EmployeeRef>,
    days: readonly StoredDay[],
    asOf: Date,
  ): DayView[] {
    return days.map((day) => {
      const employee = employees.get(day.employeeId);
      if (!employee) {
        throw new Error(
          `AttendanceDayViewService: no employee ${day.employeeId} supplied for ${day.attendanceDate}`,
        );
      }
      const targetMinutes = resolveTargetMinutes(
        ctx,
        employee,
        day.attendanceDate,
      );
      const result = this.calculation.calculate({
        storedStatus: day.storedStatus,
        sessions: day.sessions,
        targetMinutes,
        calendar: resolveCalendar(ctx, employee, day.attendanceDate),
        asOf,
      });
      return {
        recordId: day.recordId,
        employeeId: day.employeeId,
        attendanceDate: day.attendanceDate,
        storedStatus: day.storedStatus,
        status: result.status,
        targetMinutes,
        workedMinutes: result.workedMinutes,
        overtimeMinutes: result.overtimeMinutes,
        shortfallMinutes: result.shortfallMinutes,
        hasOpenSession: result.hasOpenSession,
        sessions: day.sessions,
      };
    });
  }
}
