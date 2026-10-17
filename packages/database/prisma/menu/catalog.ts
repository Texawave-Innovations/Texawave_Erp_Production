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
    // The HR workspace switch: without it the whole group (and so every HR
    // tab below) is left out of the user's menu, and the UI keeps them in
    // the portal (apps/ui/src/features/auth/landing.ts).
    permission: "hr.workspace.access",
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
    // hr.task.write family (any scope) — the same one the HR dashboard's
    // Task Assignment page uses. Not granted to Team Lead by default (see
    // default-roles.ts); an admin opts in via Settings → Roles → Menu
    // access. Grant hr.task.read.team alongside it — the reused TasksView
    // component gates its own list on hr.task.read.*, so write alone shows
    // the tab but an empty "no access" state.
    permission: "hr.task.write",
  },
  // Team tabs for a Team Lead, who works in the portal like any employee
  // (they don't hold hr.workspace.access). Same §7 exception as above: each
  // is gated by the HR screen's own scoped read family, and the API scopes
  // the rows to the caller's team via @TeamScoped(). The default Employee
  // role holds none of these families, so plain employees never see them.
  {
    code: "portal-team-attendance",
    label: "Team Attendance",
    path: "/portal/team-attendance",
    order: 11,
    parentCode: "portal",
    permission: "hr.attendance.read",
  },
  {
    code: "portal-team-leaves",
    label: "Team Leaves",
    path: "/portal/team-leaves",
    order: 12,
    parentCode: "portal",
    permission: "hr.leave_request.read",
  },
  // Own pay records. Self-service codes only, so an employee never needs the
  // HR payroll workspace (hr.payroll.read) to see their own payslip.
  {
    code: "portal-payslips",
    label: "My Payslips",
    path: "/portal/payslips",
    order: 13,
    parentCode: "portal",
    permission: "employee_self_service.payslip.read",
  },
  {
    code: "portal-loans",
    label: "My Loans",
    path: "/portal/loans",
    order: 14,
    parentCode: "portal",
    permission: "employee_self_service.loan.read",
  },
  {
    code: "portal-tax",
    label: "My Tax",
    path: "/portal/tax",
    order: 15,
    parentCode: "portal",
    permission: "employee_self_service.tax_declaration.read",
  },
  {
    code: "crm",
    label: "CRM",
    path: null,
    order: 4,
    parentCode: null,
    // Unlike HR's children above, every CRM child below is gated by a real
    // crm.*.read permission (no ungated items like HR's Dashboard/
    // Employees), so a user with zero CRM permissions would otherwise see
    // an empty "CRM" chevron with nothing under it. The parent itself stays
    // ungated (`permission: null`, same convention as hr/admin/portal) —
    // menu.service.ts's `getMyMenu` prunes root items left with no path and
    // no visible children instead, so this doesn't need a bespoke parent
    // permission.
    permission: null,
  },
  {
    code: "crm-accounts",
    label: "Accounts",
    path: "/crm/accounts",
    order: 1,
    parentCode: "crm",
    permission: "crm.account.read",
  },
  {
    code: "crm-leads",
    label: "Leads",
    path: "/crm/leads",
    order: 2,
    parentCode: "crm",
    permission: "crm.lead.read",
  },
  {
    code: "crm-pipeline",
    label: "Pipeline",
    path: "/crm/pipeline",
    order: 3,
    parentCode: "crm",
    permission: "crm.opportunity.read",
  },
  {
    code: "crm-contacts",
    label: "Contacts",
    path: "/crm/contacts",
    order: 4,
    parentCode: "crm",
    permission: "crm.contact.read",
  },
  {
    code: "crm-products",
    label: "Products",
    path: "/crm/products",
    order: 5,
    parentCode: "crm",
    permission: "crm.product.read",
  },
  {
    code: "crm-quotes",
    label: "Quotes",
    path: "/crm/quotes",
    order: 6,
    parentCode: "crm",
    permission: "crm.quotation.read",
  },
  // Phase 1B — Account-360 status-tag queues + Cold Calling Status + Yet to
  // Happen (Docs/CRM_FULL_LEGACY_PARITY.md §10). Order follows legacy's own
  // module ordering (TexaWave_ERP/src/App.tsx CRM route block): Interested,
  // Not Interested, Keep in Touch, Call Back/Send Info, Cold Calling
  // Status, Yet to Happen.
  {
    code: "crm-interested",
    label: "Interested",
    path: "/crm/interested",
    order: 7,
    parentCode: "crm",
    permission: "crm.account.read",
  },
  {
    code: "crm-not-interested",
    label: "Not Interested",
    path: "/crm/not-interested",
    order: 8,
    parentCode: "crm",
    permission: "crm.account.read",
  },
  {
    code: "crm-keep-in-touch",
    label: "Keep in Touch",
    path: "/crm/keep-in-touch",
    order: 9,
    parentCode: "crm",
    permission: "crm.account.read",
  },
  {
    code: "crm-callback-send-info",
    label: "Call Back / Send Info",
    path: "/crm/callback-send-info",
    order: 10,
    parentCode: "crm",
    permission: "crm.account.read",
  },
  {
    code: "crm-cold-calling-status",
    label: "Cold Calling Status",
    path: "/crm/cold-calling-status",
    order: 11,
    parentCode: "crm",
    permission: "crm.coldcalling.read",
  },
  {
    code: "crm-yet-to-happen",
    label: "Yet to Happen",
    path: "/crm/yet-to-happen",
    order: 12,
    parentCode: "crm",
    // Gated on Follow-ups' read permission (the most central of the three
    // entity kinds this cross-entity queue surfaces — Tasks, Follow-ups,
    // Meetings) rather than a bespoke queue-only permission; each
    // underlying list still enforces its own crm.task.read/
    // crm.followup.read/crm.meeting.read at the API layer regardless of
    // which one gates the menu entry.
    permission: "crm.followup.read",
  },
  // Remaining legacy CRM parity screens (Docs/CRM_FULL_LEGACY_PARITY.md §12).
  // Search/Calendar/Notifications/Bulk Import are header actions in legacy;
  // Search and Calendar get menu entries here so they are reachable.
  {
    code: "crm-whatsapp",
    label: "WhatsApp",
    path: "/crm/whatsapp",
    order: 13,
    parentCode: "crm",
    permission: "crm.activity.read",
  },
  {
    code: "crm-linkedin",
    label: "LinkedIn",
    path: "/crm/linkedin",
    order: 14,
    parentCode: "crm",
    permission: "crm.activity.read",
  },
  {
    code: "crm-email",
    label: "Email",
    path: "/crm/email",
    order: 15,
    parentCode: "crm",
    permission: "crm.activity.read",
  },
  {
    code: "crm-accounts-mining-sheet",
    label: "Accounts Mining Sheet",
    path: "/crm/accounts-mining-sheet",
    order: 16,
    parentCode: "crm",
    permission: "crm.miningrow.read",
  },
  {
    code: "crm-overall-data",
    label: "Overall Data",
    path: "/crm/overall-data",
    order: 17,
    parentCode: "crm",
    permission: "crm.overalldata.read",
  },
  {
    code: "crm-dashboard",
    label: "Dashboard",
    path: "/crm/dashboard",
    order: 18,
    parentCode: "crm",
    permission: "crm.dashboard.read",
  },
  {
    code: "crm-quotas",
    label: "Target",
    path: "/crm/quotas",
    order: 19,
    parentCode: "crm",
    permission: "crm.quota.read",
  },
  {
    code: "crm-calendar",
    label: "Calendar",
    path: "/crm/calendar",
    order: 20,
    parentCode: "crm",
    permission: "crm.calendar.read",
  },
  {
    code: "crm-search",
    label: "Search",
    path: "/crm/search",
    order: 21,
    parentCode: "crm",
    permission: "crm.search.read",
  },
  {
    code: "crm-recycle-bin",
    label: "Recycle Bin",
    path: "/crm/recycle-bin",
    order: 22,
    parentCode: "crm",
    permission: "crm.recyclebin.read",
  },
  {
    code: "crm-bulk-import",
    label: "Bulk Import",
    path: "/crm/bulk-import",
    order: 23,
    parentCode: "crm",
    permission: "crm.import.write",
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
