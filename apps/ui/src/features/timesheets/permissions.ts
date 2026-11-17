/** Permission codes the timesheet screens check. Own-data screens use the flat
 * `employee_self_service.*` namespace (Docs/ARCHITECTURE.md §7). */
export const TIMESHEET_READ = "employee_self_service.timesheet.read";
export const TIMESHEET_WRITE = "employee_self_service.timesheet.write";
export const TIMESHEET_SUBMIT = "employee_self_service.timesheet.submit";

// Review (UI visibility only — the API guards every route). Team-scoped codes
// are seeded as `.own/.team/.all`; the user's list holds the suffixed codes.
/** `.own` = the caller's direct reports; `.team`/`.all` widen it. */
export const REVIEW_READ_ANY_SCOPE = [
  "hr.timesheet.read.own",
  "hr.timesheet.read.team",
  "hr.timesheet.read.all",
] as const;

/** Any level may decide: `.own` is the reporting-manager level (first
 * approval), `.team` also within scope, and only `.all` gives HR's second
 * approval — or decides alone when the employee has no reporting manager. */
export const REVIEW_APPROVE_ANY_SCOPE = [
  "hr.timesheet.approve.own",
  "hr.timesheet.approve.team",
  "hr.timesheet.approve.all",
] as const;

/** CSV download of the reports. */
export const REVIEW_EXPORT_ANY_SCOPE = [
  "hr.timesheet.export.own",
  "hr.timesheet.export.team",
  "hr.timesheet.export.all",
] as const;
