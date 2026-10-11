/**
 * UI visibility only. The API guards every route and is authoritative.
 *
 * Team-scoped permissions are seeded as `.own/.team/.all` and the guard adds
 * the suffix itself, so the user's permission list holds the suffixed codes.
 */
export const READ_ANY_SCOPE = [
  "hr.attendance.read.own",
  "hr.attendance.read.team",
  "hr.attendance.read.all",
] as const;

/** `.own` is always refused server-side (nobody may edit their own record),
 * but the permission catalogue still follows the `.own/.team/.all` triplet. */
export const WRITE_ANY_SCOPE = [
  "hr.attendance.write.own",
  "hr.attendance.write.team",
  "hr.attendance.write.all",
] as const;

/** Self-service: the authenticated user's own attendance. */
export const SELF_SERVICE_READ = "employee_self_service.attendance.read";
export const SELF_SERVICE_PUNCH = "employee_self_service.attendance.punch";

export const REPORT_READ_ANY_SCOPE = [
  "hr.attendance_report.read.own",
  "hr.attendance_report.read.team",
  "hr.attendance_report.read.all",
] as const;

export const EXPORT_ANY_SCOPE = [
  "hr.attendance.export.own",
  "hr.attendance.export.team",
  "hr.attendance.export.all",
] as const;

/** `.own` is reserved server-side: nobody imports their own punches. */
export const IMPORT_TEAM_OR_ALL = [
  "hr.attendance.import.team",
  "hr.attendance.import.all",
] as const;

export const LOCK_READ_ANY_SCOPE = [
  "hr.attendance_lock.read.own",
  "hr.attendance_lock.read.team",
  "hr.attendance_lock.read.all",
] as const;

/** `.own` grants no finalize/approve (reserved server-side). */
export const LOCK_FINALIZE_TEAM_OR_ALL = [
  "hr.attendance_lock.finalize.team",
  "hr.attendance_lock.finalize.all",
] as const;

export const LOCK_APPROVE_TEAM_OR_ALL = [
  "hr.attendance_lock.approve.team",
  "hr.attendance_lock.approve.all",
] as const;
