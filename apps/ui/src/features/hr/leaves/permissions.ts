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

/** Any level may decide: `.own` is the reporting-manager level (direct
 * reports and delegations), `.team`/`.all` also decide within scope
 * (Docs/HR_LEAVE.md §6.1). The server still refuses one's own request. */
export const APPROVE_ANY_SCOPE = [
  "hr.leave.approve.own",
  "hr.leave.approve.team",
  "hr.leave.approve.all",
] as const;

/** Only `.all` gives the second (HR) approval of a two-level leave type. */
export const APPROVE_ALL = "hr.leave.approve.all";

/** Apply on an employee's behalf / cancel someone's leave. `.own` of both is
 * reserved and grants nothing, so only `.team`/`.all` show the actions. */
export const CREATE_ON_BEHALF_SCOPE = [
  "hr.leave_request.create.team",
  "hr.leave_request.create.all",
] as const;
export const HR_CANCEL_SCOPE = [
  "hr.leave.cancel.team",
  "hr.leave.cancel.all",
] as const;

/** CSV export of requests and balances. */
export const EXPORT_ANY_SCOPE = [
  "hr.leave_request.export.own",
  "hr.leave_request.export.team",
  "hr.leave_request.export.all",
] as const;

/** Self-service: the authenticated user's own leave requests and balances. */
export const SELF_SERVICE_READ = "employee_self_service.leave_request.read";
export const SELF_SERVICE_CREATE = "employee_self_service.leave_request.create";

/** Leave type administration (organization-wide) and per-employee
 * entitlements — single, bulk and CSV import — gated by the same two codes
 * (Docs/HR_LEAVE.md §6, D11). */
export const LEAVE_TYPE_READ = "hr.leave_type.read";
export const LEAVE_TYPE_WRITE = "hr.leave_type.write";
