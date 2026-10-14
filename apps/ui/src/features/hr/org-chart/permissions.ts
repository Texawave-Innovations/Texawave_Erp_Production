/**
 * UI visibility only. The API guards `/hr/org-chart` with the same
 * `hr.employee.read` scoped permission used by the employee directory —
 * the org chart module has no permission codes of its own (see
 * `org-chart.controller.ts`).
 */
export const READ_ANY_SCOPE = [
  "hr.employee.read.own",
  "hr.employee.read.team",
  "hr.employee.read.all",
] as const;
