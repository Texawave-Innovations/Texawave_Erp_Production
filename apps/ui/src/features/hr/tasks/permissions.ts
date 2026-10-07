/**
 * UI visibility only. The API guards every route and is authoritative.
 *
 * Team-scoped permissions are seeded as `.own/.team/.all` and the guard adds
 * the suffix itself, so the user's permission list holds the suffixed codes.
 */
export const READ_ANY_SCOPE = [
  "hr.task.read.own",
  "hr.task.read.team",
  "hr.task.read.all",
] as const;

/** Writes are refused for `.own` (TasksService.writeScope throws 403), so
 * only team/all are useful for gating create/reassign/status/approve/reopen. */
export const WRITE_TEAM_OR_ALL = [
  "hr.task.write.team",
  "hr.task.write.all",
] as const;
