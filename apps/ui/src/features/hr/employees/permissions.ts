/**
 * UI visibility only. The API guards every route and is authoritative.
 *
 * Team-scoped permissions are seeded as `.own/.team/.all` and the guard adds
 * the suffix itself, so the user's permission list holds the suffixed codes.
 * Checking the bare code would never match.
 */
export const READ_ANY_SCOPE = [
  "hr.employee.read.own",
  "hr.employee.read.team",
  "hr.employee.read.all",
] as const;

/** Creating and editing are refused for `.own` (API: create → 403; update → scope rule). */
export const WRITE_TEAM_OR_ALL = [
  "hr.employee.write.team",
  "hr.employee.write.all",
] as const;

/** Organization-wide exact permissions (not scoped). */
export const STATUS_WRITE = "hr.employee_status.write";
export const STATUS_CORRECT = "hr.employee_status.correct";
