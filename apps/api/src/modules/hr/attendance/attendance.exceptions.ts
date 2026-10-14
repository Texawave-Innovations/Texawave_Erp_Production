import { HttpStatus } from "@nestjs/common";
import { BusinessException } from "../../../common/exceptions/business.exception.js";

/** Check-in while a session is already open (409). */
export class AlreadyCheckedInException extends BusinessException {
  constructor() {
    super(
      "You are already checked in",
      HttpStatus.CONFLICT,
      "ALREADY_CHECKED_IN",
    );
  }
}

/** Check-out with no open session (409). */
export class NotCheckedInException extends BusinessException {
  constructor() {
    super("You are not checked in", HttpStatus.CONFLICT, "NOT_CHECKED_IN");
  }
}

/** Deciding a correction on one's own record (403). Same maker-checker rule
 * as leave requests. */
export class AttendanceSelfApprovalForbiddenException extends BusinessException {
  constructor() {
    super(
      "You cannot approve or reject your own attendance correction",
      HttpStatus.FORBIDDEN,
      "SELF_APPROVAL_FORBIDDEN",
    );
  }
}

/** A from→to window larger than the accepted maximum (422). */
export class AttendanceRangeTooLargeException extends BusinessException {
  constructor(maxDays: number) {
    super(
      `The date range may not exceed ${maxDays} days`,
      HttpStatus.UNPROCESSABLE_ENTITY,
      "RANGE_TOO_LARGE",
    );
  }
}

/** A change to a day whose month is submitted or approved (409). The month
 * must be returned or reopened first. */
export class AttendanceMonthLockedException extends BusinessException {
  constructor(month: string) {
    super(
      `Attendance for ${month} is submitted or approved and cannot change. Ask an approver to return or reopen the month first.`,
      HttpStatus.CONFLICT,
      "ATTENDANCE_MONTH_LOCKED",
    );
  }
}

/** Deciding the month close of one's own attendance (403). */
export class AttendanceMonthSelfDecisionException extends BusinessException {
  constructor() {
    super(
      "You cannot decide the attendance month of your own record",
      HttpStatus.FORBIDDEN,
      "SELF_APPROVAL_FORBIDDEN",
    );
  }
}

/** The user who submitted a month approving or returning it (403):
 * submitting and approving are two people's jobs. */
export class AttendanceMonthSubmitterDecisionException extends BusinessException {
  constructor() {
    super(
      "The person who submitted this month cannot also approve or return it",
      HttpStatus.FORBIDDEN,
      "SUBMITTER_CANNOT_DECIDE",
    );
  }
}
