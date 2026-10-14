/**
 * UI visibility only. The API guards every route and is authoritative.
 *
 * Team-scoped permissions are seeded as `.own/.team/.all`, and the user's
 * permission list holds the suffixed codes, so the bare code never matches.
 */
export const PROFILE_READ_ANY_SCOPE = [
  "hr.employee_profile.read.own",
  "hr.employee_profile.read.team",
  "hr.employee_profile.read.all",
] as const;

/** `.own` writes are refused by the API, so they are not offered here. */
export const PROFILE_WRITE_TEAM_OR_ALL = [
  "hr.employee_profile.write.team",
  "hr.employee_profile.write.all",
] as const;

/** Organization-wide exact permissions (not scoped). Reads are audited. */
export const SENSITIVE_READ = "hr.employee_sensitive.read";
export const SENSITIVE_WRITE = "hr.employee_sensitive.write";

/** Employee record fields (name, contact, joining date) are edited on the Employees feature. */
export const EMPLOYEE_WRITE_TEAM_OR_ALL = [
  "hr.employee.write.team",
  "hr.employee.write.all",
] as const;
