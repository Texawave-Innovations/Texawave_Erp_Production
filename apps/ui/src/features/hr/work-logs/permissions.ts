/**
 * UI visibility only. The API guards every route and is authoritative.
 *
 * Team-scoped permissions are seeded as `.own/.team/.all` and the guard adds
 * the suffix itself, so the user's permission list holds the suffixed codes.
 */
export const READ_ANY_SCOPE = [
  "hr.work_log.read.own",
  "hr.work_log.read.team",
  "hr.work_log.read.all",
] as const;

/** Flat (not scoped): approval is by the employee's reporting manager, not by team. */
export const APPROVE = "hr.work_log.approve";

/** Self-service: the authenticated user's own logs. */
export const SELF_SERVICE_READ = "employee_self_service.work_log.read";
export const SELF_SERVICE_CREATE = "employee_self_service.work_log.create";
