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
