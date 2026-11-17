import { NON_WORKING_ATTENDANCE } from "./timesheet-views.js";

/**
 * Pure rules that compare a day's recorded work with HR's attendance for that
 * day and say what a reviewer should look at. No I/O, so each rule is
 * unit-tested (timesheet-flags.spec.ts).
 *
 * Flags are DERIVED every time the day is read — nothing is stored, so there is
 * nothing to fall out of date when HR later edits attendance, and a flag never
 * changes recorded hours or attendance. They tell people; they do not block
 * the employee from recording work.
 */

export const DAY_FLAG_CODES = [
  "WORK_ON_ABSENT_DAY",
  "WORK_ON_LEAVE",
  "WORK_ON_HOLIDAY",
  "WORK_ON_WEEKLY_OFF",
  "WORK_WITHOUT_ATTENDANCE",
  "STALE_SESSION",
  "SESSION_NEEDS_REVIEW",
  "ATTENDANCE_CHANGED_AFTER_SUBMIT",
] as const;
export type DayFlagCode = (typeof DAY_FLAG_CODES)[number];

/** "warning" needs a reviewer's attention; "info" is unusual but legitimate
 * (working on a holiday or a weekly off). */
export type DayFlagSeverity = "warning" | "info";

export interface DayFlag {
  code: DayFlagCode;
  severity: DayFlagSeverity;
  message: string;
}

export interface FlagInput {
  /** IST work date. */
  date: string;
  /** IST today, so an unmarked TODAY (HR has not recorded it yet) is not
   * flagged. */
  today: string;
  /** HR's effective status for the day; null if it could not be determined. */
  attendanceStatus: string | null;
  /** Closed minutes recorded on the day (tasks + custom activities). */
  totalMinutes: number;
  /** `review_state` of every session on the day. */
  sessionReviewStates: readonly string[];
  /** HR's status when the day was submitted (kept on the rows, never
   * rewritten); null for a day that was never submitted. */
  attendanceStatusAtSubmit?: string | null;
}

export function flagsForDay(input: FlagInput): DayFlag[] {
  const flags: DayFlag[] = [];
  const worked = input.totalMinutes > 0;

  if (worked) {
    switch (input.attendanceStatus) {
      case "ABSENT":
        flags.push({
          code: "WORK_ON_ABSENT_DAY",
          severity: "warning",
          message:
            "Work is recorded on a day HR has marked absent. Attendance or the timesheet needs to be checked.",
        });
        break;
      case "ON_LEAVE":
        flags.push({
          code: "WORK_ON_LEAVE",
          severity: "warning",
          message: "Work is recorded on a day of approved leave.",
        });
        break;
      case "HOLIDAY":
        flags.push({
          code: "WORK_ON_HOLIDAY",
          severity: "info",
          message: "Work is recorded on a holiday.",
        });
        break;
      case "WEEKLY_OFF":
        flags.push({
          code: "WORK_ON_WEEKLY_OFF",
          severity: "info",
          message: "Work is recorded on a weekly off.",
        });
        break;
      case "NOT_MARKED":
        if (input.date < input.today) {
          flags.push({
            code: "WORK_WITHOUT_ATTENDANCE",
            severity: "warning",
            message:
              "Work is recorded on a day with no attendance. HR has nothing marked for it.",
          });
        }
        break;
      default:
        break;
    }
  }

  if (input.sessionReviewStates.includes("STALE_UNRESOLVED")) {
    flags.push({
      code: "STALE_SESSION",
      severity: "warning",
      message:
        "A timer was left running and was closed with no time counted. The real end time needs to be confirmed.",
    });
  }
  if (input.sessionReviewStates.includes("REVIEW_REQUIRED")) {
    flags.push({
      code: "SESSION_NEEDS_REVIEW",
      severity: "warning",
      message: "A work session on this day needs a reviewer's check.",
    });
  }
  // HR edited attendance after the day was submitted: the reviewer decides on
  // what was submitted, and is told the picture has moved since.
  const atSubmit = input.attendanceStatusAtSubmit ?? null;
  if (
    atSubmit !== null &&
    input.attendanceStatus !== null &&
    atSubmit !== input.attendanceStatus
  ) {
    flags.push({
      code: "ATTENDANCE_CHANGED_AFTER_SUBMIT",
      severity: "warning",
      message: `HR attendance for this day has changed since it was submitted (it was ${atSubmit
        .replace(/_/g, " ")
        .toLowerCase()}, it is now ${input.attendanceStatus.replace(/_/g, " ").toLowerCase()}).`,
    });
  }
  return flags;
}

/** True when HR expects no work on the day (used by screens for wording). */
export function isNonWorkingDay(attendanceStatus: string | null): boolean {
  return (
    attendanceStatus !== null &&
    NON_WORKING_ATTENDANCE.includes(attendanceStatus)
  );
}
