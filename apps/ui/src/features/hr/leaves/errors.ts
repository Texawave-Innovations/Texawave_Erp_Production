import { ApiError } from "@texawave-erp/core";

/** One place that turns the leave API's error codes (Docs/HR_API.md §8,
 * Docs/HR_LEAVE.md §6) into words for a dialog or a toast. */
export function leaveErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof ApiError)) return "Something went wrong. Try again.";
  switch (error.errorCode) {
    case "SELF_APPROVAL_FORBIDDEN":
      return "You cannot decide your own leave, or a request you applied for on someone's behalf.";
    case "LEAVE_AWAITING_HR":
      return "This request already has its first approval. It now needs an HR approver.";
    case "LEAVE_SAME_APPROVER":
      return "You gave the first approval. A different HR approver must give the second.";
    case "LEAVE_OWN_VIA_SELF_SERVICE":
      return "Use My leave for your own leave requests.";
    case "ATTENDANCE_MONTH_LOCKED":
      return error.message;
    case "LEAVE_BALANCE_INSUFFICIENT":
      return "The employee's balance does not cover this request.";
    case "LEAVE_OVERLAP":
      return error.message;
    case "LEAVE_NO_WORKING_DAYS":
      return "This range has no working day — it falls entirely on holidays or weekly offs.";
    case "LEAVE_SPANS_YEAR":
      return "A leave request cannot span two calendar years. Split it into two requests.";
    case "INVALID_STATE_TRANSITION":
      return "This request has already changed. Refresh to see its current status.";
    case "LEAVE_DELEGATION_OVERLAP":
    case "DELEGATE_CANNOT_APPROVE":
    case "INVALID_DELEGATE":
    case "DELEGATION_DATES_INVALID":
    case "DELEGATION_TOO_LONG":
    case "EXPORT_TOO_LARGE":
      return error.message;
    default:
      break;
  }
  if (error.statusCode === 404) {
    return "This item is no longer available to you. It may be outside your scope.";
  }
  if (error.isPermissionError) return fallback;
  if (error.isValidationError) {
    return error.fieldErrors.length > 0
      ? error.fieldErrors.join(" ")
      : error.message;
  }
  return error.message;
}
