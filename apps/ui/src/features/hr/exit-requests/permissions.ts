/**
 * UI visibility only. The API guards every route and is authoritative.
 *
 * Team-scoped permissions are seeded as `.own/.team/.all` and the guard adds
 * the suffix itself, so the user's permission list holds the suffixed codes.
 */
export const READ_ANY_SCOPE = [
  "hr.exit_request.read.own",
  "hr.exit_request.read.team",
  "hr.exit_request.read.all",
] as const;

/** `.own` is reserved and grants no decision — the backend refuses deciding
 * at own scope (403 DECISION_SCOPE_REQUIRED) and refuses deciding one's own
 * request regardless of scope (403 SELF_DECISION_FORBIDDEN). Listed here only
 * for completeness; the buttons are gated by the flat check below. */
export const DECIDE_ANY_SCOPE = [
  "hr.exit_request.decide.team",
  "hr.exit_request.decide.all",
] as const;

/** Self-service: the authenticated user's own exit requests. */
export const SELF_SERVICE_READ = "employee_self_service.exit_request.read";
export const SELF_SERVICE_CREATE = "employee_self_service.exit_request.create";
