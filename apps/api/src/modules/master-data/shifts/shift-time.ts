import { BusinessRuleViolationException } from "../../../common/exceptions/business.exception.js";

/** Wall-clock "HH:MM", 24-hour, zero-padded (mirrored by a DB CHECK). Shift
 * times carry no time zone: which zone they are read in is an Attendance
 * decision, not something HR data should guess. */
export const TIME_PATTERN = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;
export const MINUTES_PER_DAY = 1440;

export function timeToMinutes(time: string): number {
  if (!TIME_PATTERN.test(time)) {
    throw new BusinessRuleViolationException(
      `"${time}" is not a valid HH:MM time`,
      "SHIFT_TIME_INVALID",
    );
  }
  return Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
}

/** A shift crosses midnight exactly when it ends earlier than it starts. */
export function isOvernight(startTime: string, endTime: string): boolean {
  return timeToMinutes(endTime) < timeToMinutes(startTime);
}

/** Minutes between start and end, wrapping past midnight for overnight shifts. */
export function shiftSpanMinutes(startTime: string, endTime: string): number {
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  return end > start ? end - start : end + MINUTES_PER_DAY - start;
}

export interface ShiftTimes {
  startTime: string;
  endTime: string;
  workingMinutes: number;
}

/**
 * The whole set of shift-time rules, in one place (and mirrored by DB
 * CHECKs). Throws a 422 with a stable error code:
 *  - SHIFT_TIME_INVALID: a time is not HH:MM, or start equals end (zero-length
 *    or a full 24 h — ambiguous, so refused);
 *  - SHIFT_WORKING_MINUTES_INVALID: not a positive whole number, or longer
 *    than the window between start and end.
 * Returns the derived `isOvernight`.
 */
export function assertShiftTimes(times: ShiftTimes): { isOvernight: boolean } {
  const start = timeToMinutes(times.startTime);
  const end = timeToMinutes(times.endTime);
  if (start === end) {
    throw new BusinessRuleViolationException(
      "A shift's start and end times must differ",
      "SHIFT_TIME_INVALID",
    );
  }
  if (!Number.isInteger(times.workingMinutes) || times.workingMinutes < 1) {
    throw new BusinessRuleViolationException(
      "Working duration must be a whole number of minutes, at least 1",
      "SHIFT_WORKING_MINUTES_INVALID",
    );
  }
  const span = shiftSpanMinutes(times.startTime, times.endTime);
  if (times.workingMinutes > span) {
    throw new BusinessRuleViolationException(
      `Working duration (${times.workingMinutes} min) cannot exceed the shift window (${span} min)`,
      "SHIFT_WORKING_MINUTES_INVALID",
    );
  }
  return { isOvernight: end < start };
}
