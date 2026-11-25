/**
 * Who may use My Work (assigned tasks, the stopwatch, logging time): an
 * employee through the self-service permission, or anyone holding the original
 * Projects permission. Any one is enough (`@RequireAnyPermission`), so adding
 * the self-service code never took access from a holder of the older one.
 */
export const MY_WORK_PERMISSIONS = [
  "employee_self_service.work.write",
  "projects.timer.write",
] as const;
