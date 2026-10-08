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

/** Corrections: own/team/all read, same triplet shape as attendance itself.
 * An employee's own corrections surface through the `.own` scope of this same
 * permission — there is no separate self-service list endpoint. */
export const CORRECTION_READ_ANY_SCOPE = [
  "hr.attendance_correction.read.own",
  "hr.attendance_correction.read.team",
  "hr.attendance_correction.read.all",
] as const;

/** `.own` is always refused server-side (nobody may decide their own request),
 * but the permission catalogue still follows the `.own/.team/.all` triplet. */
export const CORRECTION_APPROVE_ANY_SCOPE = [
  "hr.attendance_correction.approve.own",
  "hr.attendance_correction.approve.team",
  "hr.attendance_correction.approve.all",
] as const;

/** Self-service: submit a correction request for one's own attendance. */
export const SELF_SERVICE_CORRECTION_CREATE =
  "employee_self_service.attendance_correction.create";
