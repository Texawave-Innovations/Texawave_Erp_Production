/**
 * UI visibility only. The API guards every route and is authoritative.
 *
 * Team-scoped permissions are seeded as `.own/.team/.all` and the guard adds
 * the suffix itself, so the user's permission list holds the suffixed codes.
 */
export const READ_ANY_SCOPE = [
  "hr.attendance_correction.read.own",
  "hr.attendance_correction.read.team",
  "hr.attendance_correction.read.all",
] as const;

/** Scoped as well (own/team/all), but `.own` grants no decision — the
 * backend refuses it (AttendanceCorrectionsService.decide). Listed here only
 * for UI gating; the flat check below is what actually enables the buttons. */
export const APPROVE_ANY_SCOPE = [
  "hr.attendance_correction.approve.team",
  "hr.attendance_correction.approve.all",
] as const;

/** Self-service: the authenticated user's own correction requests. */
export const SELF_SERVICE_CREATE =
  "employee_self_service.attendance_correction.create";
