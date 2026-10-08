/**
 * UI visibility only. The API guards every route and is authoritative.
 *
 * Team-scoped permissions are seeded as `.own/.team/.all` and the guard adds
 * the suffix itself, so the user's permission list holds the suffixed codes.
 */
export const READ_ANY_SCOPE = [
  "hr.ticket.read.own",
  "hr.ticket.read.team",
  "hr.ticket.read.all",
] as const;

/** `.own` is reserved server-side: `TicketsService.writeScope()` throws
 * ForbiddenException for a caller resolved at own scope. Listed here only
 * for completeness; write affordances are gated on the flat check below. */
export const WRITE_ANY_SCOPE = [
  "hr.ticket.write.team",
  "hr.ticket.write.all",
] as const;

/** Self-service: the authenticated user's own tickets (raised by them, or
 * raised by HR for them), via `/self-service/tickets`. */
export const SELF_SERVICE_READ = "employee_self_service.ticket.read";
export const SELF_SERVICE_CREATE = "employee_self_service.ticket.create";
export const SELF_SERVICE_UPDATE = "employee_self_service.ticket.update";
