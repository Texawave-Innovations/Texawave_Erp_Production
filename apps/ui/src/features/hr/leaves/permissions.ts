/**
 * UI visibility only. The API guards every route and is authoritative.
 *
 * Team-scoped permissions are seeded as `.own/.team/.all` and the guard adds
 * the suffix itself, so the user's permission list holds the suffixed codes.
 */
export const READ_ANY_SCOPE = [
  "hr.leave_request.read.own",
  "hr.leave_request.read.team",
  "hr.leave_request.read.all",
] as const;

/** Scoped as well (team/all); `.own` is reserved and grants no decision —
 * the backend refuses deciding one's own request (403 SELF_APPROVAL_FORBIDDEN),
 * even with `.all`. Listed here only for completeness; the buttons are gated
 * by the flat check below. */
export const APPROVE_ANY_SCOPE = [
  "hr.leave.approve.team",
  "hr.leave.approve.all",
] as const;

/** Self-service: the authenticated user's own leave requests and balances. */
export const SELF_SERVICE_READ = "employee_self_service.leave_request.read";
export const SELF_SERVICE_CREATE = "employee_self_service.leave_request.create";
