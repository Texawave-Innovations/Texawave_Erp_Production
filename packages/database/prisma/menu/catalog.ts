export interface MenuItemDef {
  code: string;
  label: string;
  path?: string | null;
  order: number;
  /** `code` of the parent row, or `null` for a top-level item/group. Resolved
   * to the per-organization numeric `parentId` by sync.ts — never a raw id
   * here, since the same catalogue is applied to every organization. */
  parentCode: string | null;
  /** Permission code required to view this item (`null` = every
   * authenticated user). Exact match or, for a `scopedPermission()` prefix,
   * any of its `.own`/`.team`/`.all` variants — see menu.service.ts
   * `getMyMenu`. */
  permission: string | null;
}

/**
 * The single, version-controlled navigation menu tree, synced to every
 * organization by `syncMenuItems()` (sync.ts) — the same role `catalog.ts`
 * plays for permissions (see prisma/permissions/README.md). Before this
 * mechanism existed, `MenuItem` rows only ever came from `prisma/seed.ts`,
 * which is local-dev only, so staging/production had no way to receive a
 * new menu item short of a manual `POST /menu/items` call.
 */
export const MENU_CATALOG: readonly MenuItemDef[] = [
  {
    code: "dashboard",
    label: "Dashboard",
    path: "/",
    order: 1,
    parentCode: null,
    permission: null,
  },
  {
    code: "reference-tags",
    label: "Reference Tags",
    path: "/reference/tags",
    order: 2,
    parentCode: null,
    permission: "reference.tags.read",
  },
  {
    code: "hr",
    label: "HR",
    path: null,
    order: 3,
    parentCode: null,
    permission: null,
  },
  // HR dashboard tabs. The HR sidebar (apps/ui/src/components/DynamicSidebar.tsx)
  // shows a tab only when `getMyMenu()` returns its code, so each `permission`
  // here is what decides who sees that tab — and what Settings → Roles → menu
  // matrix edits. Each is the read family the page itself gates on (any
  // `.own`/`.team`/`.all` grant matches). Self-service users reach their own
  // records through the portal, not these tabs.
  {
    code: "hr-dashboard",
    label: "Dashboard",
    path: "/hr/dashboard",
    order: 1,
    parentCode: "hr",
    // Every widget gates itself (HrDashboardView), so the tab is always shown.
    permission: null,
  },
  {
    code: "hr-employees",
    label: "Employees",
    path: "/hr/employees",
    order: 2,
    parentCode: "hr",
    permission: "hr.employee.read",
  },
  {
    code: "hr-profiles",
    label: "Profiles",
    path: "/hr/profiles",
    order: 3,
    parentCode: "hr",
    permission: "hr.employee_profile.read",
  },
  {
    code: "hr-employee-documents",
    label: "Employee Documents",
    path: "/hr/employee-documents",
    order: 4,
    parentCode: "hr",
    permission: "hr.employee_document.read",
  },
  {
    code: "hr-org-chart",
    label: "Org Chart",
    path: "/hr/org-chart",
    order: 5,
    parentCode: "hr",
    permission: "hr.employee.read",
  },
  {
    code: "hr-recruitment",
    label: "Recruitment",
    path: "/hr/recruitment",
    order: 6,
    parentCode: "hr",
    // The interview pipeline is the page's core; its letter tabs gate
    // themselves on their own permissions.
    permission: "hr.interview.read",
  },
  {
    code: "hr-exit-requests",
    label: "Exit Requests",
    path: "/hr/exit-requests",
    order: 7,
    parentCode: "hr",
    permission: "hr.exit_request.read",
  },
  {
    code: "hr-attendance",
    label: "Attendance",
    path: "/hr/attendance",
    order: 8,
    parentCode: "hr",
    permission: "hr.attendance.read",
  },
  {
    code: "hr-regularization",
    label: "Regularization",
    path: "/hr/regularization",
    order: 9,
    parentCode: "hr",
    permission: "hr.attendance_correction.read",
  },
  {
    code: "hr-work-logs",
    label: "Work Logs",
    path: "/hr/work-logs",
    order: 10,
    parentCode: "hr",
    permission: "hr.work_log.read",
  },
  {
    code: "hr-location-privilege",
    label: "Location Privilege",
    path: "/hr/location-privilege",
    order: 11,
    parentCode: "hr",
    permission: "hr.location_privilege.read",
  },
  {
    code: "hr-full-month-present",
    label: "Full Month Present",
    path: "/hr/full-month-present",
    order: 12,
    parentCode: "hr",
    permission: "hr.attendance_report.read",
  },
  {
    code: "hr-leaves",
    label: "Leaves",
    path: "/hr/leaves",
    order: 13,
    parentCode: "hr",
    permission: "hr.leave_request.read",
  },
  {
    code: "hr-holidays",
    label: "Holidays",
    path: "/hr/holidays",
    order: 14,
    parentCode: "hr",
    permission: "hr.holiday.read",
  },
  {
    code: "hr-tasks",
    label: "Task Assignment",
    path: "/hr/tasks",
    order: 15,
    parentCode: "hr",
    permission: "hr.task.read",
  },
  {
    code: "hr-expense-approvals",
    label: "Expense Approvals",
    path: "/hr/expense-approvals",
    order: 16,
    parentCode: "hr",
    permission: "hr.expense_claim.read",
  },
  {
    code: "hr-tickets",
    label: "Employee Tickets",
    path: "/hr/tickets",
    order: 17,
    parentCode: "hr",
    permission: "hr.ticket.read",
  },
  {
    code: "hr-payroll",
    label: "Payroll",
    path: "/hr/payroll",
    order: 18,
    parentCode: "hr",
    permission: "hr.payroll.read",
  },
  {
    code: "hr-compliance",
    label: "Compliance",
    path: "/hr/compliance",
    order: 19,
    parentCode: "hr",
    permission: "hr.pf.read",
  },
  {
    code: "hr-departments",
    label: "Departments",
    path: "/hr/departments",
    order: 20,
    parentCode: "hr",
    permission: "departments.department.read",
  },
  {
    code: "hr-teams",
    label: "Teams",
    path: "/hr/teams",
    order: 21,
    parentCode: "hr",
    // GET /hr/teams (the page's only API) requires hr.employee.write.
    permission: "hr.employee.write",
  },
  {
    code: "portal",
    label: "My Portal",
    path: null,
    order: 2,
    parentCode: null,
    permission: null,
  },
  {
    code: "portal-profile",
    label: "My Profile",
    path: "/portal/profile",
    order: 1,
    parentCode: "portal",
    permission: "employee_self_service.profile.read",
  },
  {
    code: "portal-leave",
    label: "Leave",
    path: "/portal/leave",
    order: 2,
    parentCode: "portal",
    permission: "employee_self_service.leave_request.read",
  },
  {
    code: "portal-work-logs",
    label: "Work Logs",
    path: "/portal/work-logs",
    order: 3,
    parentCode: "portal",
    permission: "employee_self_service.work_log.read",
  },
  {
    code: "portal-tasks",
    label: "Tasks",
    path: "/portal/tasks",
    order: 4,
    parentCode: "portal",
    permission: "employee_self_service.task.read",
  },
  {
    code: "portal-tickets",
    label: "Tickets",
    path: "/portal/tickets",
    order: 5,
    parentCode: "portal",
    permission: "employee_self_service.ticket.read",
  },
  {
    code: "portal-expense-claims",
    label: "Expense Claims",
    path: "/portal/expense-claims",
    order: 6,
    parentCode: "portal",
    permission: "employee_self_service.expense_claim.read",
  },
  {
    code: "portal-exit-requests",
    label: "Exit Requests",
    path: "/portal/exit-requests",
    order: 7,
    parentCode: "portal",
    permission: "employee_self_service.exit_request.read",
  },
  {
    code: "portal-attendance",
    label: "Attendance",
    path: "/portal/attendance",
    order: 8,
    parentCode: "portal",
    permission: "employee_self_service.attendance.read",
  },
  {
    code: "portal-documents",
    label: "My Documents",
    path: "/portal/documents",
    order: 9,
    parentCode: "portal",
    // Reuses the onboarding-documents permission — same data, no new
    // permission needed (documents come from onboarding, not a separate
    // HR-held-documents module).
    permission: "employee_self_service.profile.read",
  },
  {
    code: "portal-task-assignment",
    label: "Task Assignment",
    path: "/portal/task-assignment",
    order: 10,
    parentCode: "portal",
    // Deliberate exception to the employee_self_service.* namespace
    // (Docs/ARCHITECTURE.md §7): assigning tasks to teammates is a
    // team-scoped HR capability, not self-service, so it's gated by the
    // existing hr.task.write.team permission — the same one the HR
    // dashboard's Task Assignment page uses. Not granted to Team Lead by
    // default (see default-roles.ts); an admin opts in via Settings →
    // Roles. Grant hr.task.read.team alongside it — the reused TasksView
    // component gates its own list on hr.task.read.*, so write alone shows
    // the tab but an empty "no access" state.
    permission: "hr.task.write.team",
  },
  {
    code: "admin",
    label: "Admin",
    path: null,
    order: 10,
    parentCode: null,
    permission: null,
  },
  {
    code: "admin-departments",
    label: "Departments",
    path: "/admin/departments",
    order: 1,
    parentCode: "admin",
    permission: "departments.department.read",
  },
  {
    code: "admin-roles",
    label: "Roles",
    path: "/admin/roles",
    order: 3,
    parentCode: "admin",
    permission: "settings.role.read",
  },
  {
    code: "admin-users",
    label: "Users",
    path: "/admin/users",
    order: 4,
    parentCode: "admin",
    permission: "users.user.read",
  },
  {
    code: "admin-menu",
    label: "Navigation Menu",
    path: "/admin/menu",
    order: 5,
    parentCode: "admin",
    permission: "menu.item.read",
  },
  {
    code: "admin-designation",
    label: "Designation",
    path: "/admin/designations",
    order: 2,
    parentCode: "admin",
    // Found as a pre-existing, hand-created row (never in seed.ts) when
    // menu-sync's orphan report was run against the dev database — a real,
    // intentional item that predates this sync mechanism, brought under it
    // here rather than left as an undocumented manual row.
    permission: "master.designation.write",
  },
];
