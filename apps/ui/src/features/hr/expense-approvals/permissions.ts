/**
 * UI visibility only. The API guards every route and is authoritative.
 *
 * Team-scoped permissions are seeded as `.own/.team/.all` and the guard adds
 * the suffix itself, so the user's permission list holds the suffixed codes.
 */
export const READ_ANY_SCOPE = [
  "hr.expense_claim.read.own",
  "hr.expense_claim.read.team",
  "hr.expense_claim.read.all",
] as const;

/** `.own` is reserved and grants no decision — the backend refuses deciding
 * one's own claim (403 SELF_APPROVAL_FORBIDDEN) even with `.all`, and refuses
 * any decision at all for an `.own`-only holder (403 DECISION_SCOPE_REQUIRED).
 * Listed here only for completeness; the buttons are gated by the flat check
 * below. */
export const DECIDE_ANY_SCOPE = [
  "hr.expense_claim.decide.team",
  "hr.expense_claim.decide.all",
] as const;

/** Self-service: the authenticated user's own expense claims. */
export const SELF_SERVICE_READ = "employee_self_service.expense_claim.read";
export const SELF_SERVICE_CREATE = "employee_self_service.expense_claim.create";
