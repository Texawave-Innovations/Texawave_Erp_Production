// The version-controlled permission catalogue: the single source of truth for
// which permission rows must exist in EVERY environment (dev, staging,
// production). `permissions` rows are data, not schema, so no migration
// creates them; `syncPermissions()` (sync.ts) makes the database match this
// file, additively and idempotently. Run it after `prisma migrate deploy` —
// see packages/database/prisma/permissions/README.md.
//
// Adding a permission = add it here in the same PR as the code that checks it.
// Naming rules (Docs/CODING_STANDARDS.md §2a) are enforced by validate.ts.

export interface PermissionDef {
  /** `<module>.<entity>.<action>[.<own|team|all>]` */
  code: string;
  description: string;
}

/** A permission that is no longer used. Sync deactivates it (never deletes
 * it — role grants and audit history may still reference it). */
export interface RetiredPermission {
  code: string;
  reason: string;
}

/** Expands a team-scoped permission into all three variants
 * (`.own`/`.team`/`.all`) — they are always seeded together
 * (Docs/CODING_STANDARDS.md §10a) so adding `.team` later never needs a data
 * migration on `role_permissions`. `prefix` is `<module>.<entity>.<action>`. */
export function scopedPermission(
  prefix: string,
  description: string,
): PermissionDef[] {
  return [
    { code: `${prefix}.own`, description: `${description} (own records)` },
    { code: `${prefix}.team`, description: `${description} (own team)` },
    { code: `${prefix}.all`, description: `${description} (all teams)` },
  ];
}

export const PERMISSION_CATALOG: readonly PermissionDef[] = [
  // apps/api/src/modules/_reference/tags — no team dimension.
  { code: "reference.tags.read", description: "View reference tags" },
  {
    code: "reference.tags.write",
    description: "Create/update/delete reference tags",
  },

  // apps/api/src/modules/settings/roles — no team dimension.
  {
    code: "settings.role.read",
    description: "View roles and their permissions",
  },
  {
    code: "settings.role.write",
    description: "Create/rename roles and assign/revoke their permissions",
  },

  // IAM data (departments, users, menu) — org-scoped, no team dimension.
  // apps/api/src/modules/departments
  { code: "departments.department.read", description: "View departments" },
  {
    code: "departments.department.write",
    description: "Create/update/delete departments",
  },
  // apps/api/src/platform/users
  {
    code: "users.user.read",
    description: "View users and their assignments",
  },
  {
    code: "users.user.write",
    description: "Create/update users and assign roles or teams",
  },
  // apps/api/src/modules/menu
  { code: "menu.item.read", description: "View navigation menu items" },
  {
    code: "menu.item.write",
    description: "Create/update/delete navigation menu items",
  },

  // apps/api/src/modules/master-data/* — organization-wide reference data, no
  // team dimension. `write` covers create/update/activate/deactivate.
  { code: "master.designation.read", description: "View designations" },
  {
    code: "master.designation.write",
    description: "Create/update/deactivate designations",
  },
  { code: "master.employment_type.read", description: "View employment types" },
  {
    code: "master.employment_type.write",
    description: "Create/update/deactivate employment types",
  },
  { code: "master.work_location.read", description: "View work locations" },
  {
    code: "master.work_location.write",
    description: "Create/update/deactivate work locations",
  },

  { code: "master.shift.read", description: "View shifts" },
  {
    code: "master.shift.write",
    description: "Create/update/deactivate shifts",
  },

  // apps/api/src/modules/hr/shift-assignments — team-scoped. write.own is
  // reserved: employees cannot choose their own shift.
  ...scopedPermission("hr.shift_assignment.read", "View shift assignments"),
  ...scopedPermission(
    "hr.shift_assignment.write",
    "Assign/end/void shift assignments",
  ),

  // apps/api/src/modules/hr/holidays, weekly-off-rules — organization-wide
  // calendar data (every employee may read it), so no team dimension.
  { code: "hr.holiday.read", description: "View the holiday calendar" },
  {
    code: "hr.holiday.write",
    description: "Create/update/deactivate holidays",
  },
  { code: "hr.weekly_off.read", description: "View weekly-off rules" },
  {
    code: "hr.weekly_off.write",
    description: "Create/end/void weekly-off rules",
  },

  // apps/api/src/modules/hr/leave-types — organization-wide reference data.
  { code: "hr.leave_type.read", description: "View leave types" },
  {
    code: "hr.leave_type.write",
    description: "Create/update/deactivate leave types",
  },

  // apps/api/src/modules/hr/leave-requests — team-scoped. Deciding is its own
  // permission; hr.leave.approve.own is reserved (nobody may decide their own
  // request), and who among team leads/HR approves is an open decision, so
  // approve.team is granted to no role by default.
  ...scopedPermission("hr.leave_request.read", "View leave requests"),
  ...scopedPermission("hr.leave.approve", "Approve or reject leave requests"),

  // apps/api/src/modules/hr/attendance — team-scoped (an employee's day is
  // reached through the employee). attendance.write.own and
  // attendance_correction.approve.own are reserved: nobody may edit or decide
  // their own attendance; approve.team/write.team are granted to no role by
  // default, the same open decision as leave approval.
  ...scopedPermission("hr.attendance.read", "View attendance records"),
  ...scopedPermission(
    "hr.attendance.write",
    "Manually edit attendance records (HR)",
  ),
  ...scopedPermission(
    "hr.attendance_correction.read",
    "View attendance correction requests",
  ),
  ...scopedPermission(
    "hr.attendance_correction.approve",
    "Approve or reject attendance correction requests",
  ),
  ...scopedPermission("hr.attendance_report.read", "View attendance reports"),

  // apps/api/src/modules/hr/location-privilege — organization-wide. Legacy has
  // no team dimension for location privilege (Docs/HR_LEGACY_PARITY.md §12),
  // so no scope variants are invented. The service refuses a change to the
  // caller's own privilege.
  {
    code: "hr.location_privilege.read",
    description: "View employee location privileges",
  },
  {
    code: "hr.location_privilege.write",
    description: "Change employee location privileges (HR)",
  },
  // Organization-wide office network list. Not employee data, so no scope.
  {
    code: "hr.office_network.read",
    description: "View office network addresses",
  },
  {
    code: "hr.office_network.write",
    description: "Add or deactivate office network addresses",
  },

  // apps/api/src/modules/hr/profiles — profile details are employee-linked, so
  // team-scoped through the employee. write.own is reserved: nobody edits their
  // own profile through HR routes (self-submission is not built; see
  // Docs/HR_LEGACY_PARITY.md §11.5).
  ...scopedPermission("hr.employee_profile.read", "View employee profiles"),
  ...scopedPermission("hr.employee_profile.write", "Edit employee profiles"),
  // Sensitive identifiers and bank details (ARCHITECTURE.md §10). Organization-
  // wide by design; no team dimension, so no own/team/all suffix (see CODING_STANDARDS §2a). Reads are audited.
  {
    code: "hr.employee_sensitive.read",
    description:
      "View sensitive employee identifiers and bank details (audited)",
  },
  {
    code: "hr.employee_sensitive.write",
    description: "Create/edit sensitive employee identifiers and bank details",
  },

  // apps/api/src/modules/hr/interviews, offer-letters — EXPLICIT, DOCUMENTED
  // EXCEPTION to the HR team-scope rule (Docs/HR_API.md, Recruitment). Legacy
  // stores no employee or team owner for these records, so there is nothing
  // to scope by: each permission is organization-wide and exact-name, with no
  // .own/.team/.all variants. Not granted to Employee or Team Lead by default.
  { code: "hr.interview.read", description: "View the interview schedule" },
  {
    code: "hr.interview.write",
    description: "Schedule interviews and change their status",
  },
  { code: "hr.offer_letter.read", description: "View offer letters" },
  {
    code: "hr.offer_letter.write",
    description: "Generate and edit offer letters",
  },

  // apps/api/src/modules/hr/revision-letters — employee-linked (a letter is
  // always issued to an existing employee), so team-scoped through the
  // employee. write.own is reserved: nobody issues or edits a revision letter
  // for themselves. Who among team leads may see or issue these is an open
  // decision, so write.team/read.team are granted to no role by default.
  ...scopedPermission(
    "hr.revision_letter.read",
    "View salary revision letters",
  ),
  ...scopedPermission(
    "hr.revision_letter.write",
    "Issue and edit salary revision letters",
  ),

  // apps/api/src/modules/hr/employees — team-scoped data, so read/write are
  // seeded as .own/.team/.all together. Team leads get read.team only by
  // default; write.team exists but is granted to no role without approval.
  // .own write is reserved (self-service edits are not built).
  ...scopedPermission("hr.employee.read", "View employees"),
  ...scopedPermission("hr.employee.write", "Create/edit employees"),
  // Organization-wide administrative actions — deliberately not team-scoped.
  {
    code: "hr.employee_status.write",
    description:
      "Change employment status (activate, deactivate, resign, terminate)",
  },
  {
    code: "hr.employee_status.correct",
    description:
      "Correct a RESIGNED/TERMINATED status (audited, reason mandatory)",
  },
  {
    code: "hr.employee_account.write",
    description: "Link/unlink an employee to a login account",
  },
  // apps/api/src/modules/employee-self-service — own record only.
  {
    code: "employee_self_service.profile.read",
    description: "View my own employee record",
  },
  {
    code: "employee_self_service.leave_request.read",
    description: "View my own leave requests",
  },
  {
    code: "employee_self_service.leave_request.create",
    description: "Request leave for myself",
  },
  {
    code: "employee_self_service.attendance.punch",
    description: "Check in and check out for myself",
  },
  {
    code: "employee_self_service.attendance.read",
    description: "View my own attendance",
  },
  {
    code: "employee_self_service.attendance_correction.create",
    description: "Request a correction to my own attendance",
  },

  // apps/api/src/modules/employee-self-service/work-logs — own records only.
  {
    code: "employee_self_service.work_log.create",
    description: "Submit a work log for myself",
  },
  {
    code: "employee_self_service.work_log.read",
    description: "View my own work logs",
  },

  // apps/api/src/modules/hr/work-logs — team-scoped read; approval is by the
  // employee's reporting manager (Employee.reportsToId), not by team, so the
  // approve permission carries no scope suffix.
  ...scopedPermission("hr.work_log.read", "View work logs"),
  {
    code: "hr.work_log.approve",
    description: "Approve or reject work logs of my direct reports",
  },

  // apps/api/src/modules/hr/tasks — team-scoped by the ASSIGNEE's team. There is
  // no separate approve permission: in legacy the same admin who assigns a
  // task approves or reopens it, so approval rides on the write scope.
  ...scopedPermission("hr.task.read", "View tasks"),
  ...scopedPermission(
    "hr.task.write",
    "Assign, reassign, update status, approve and reopen tasks",
  ),

  // apps/api/src/modules/hr/tickets — team-scoped by the EMPLOYEE's team. Replying
  // and changing status ride on the write scope (legacy: the same admin who
  // raises a ticket replies to it and moves it), so there is no separate
  // respond permission.
  ...scopedPermission("hr.ticket.read", "View employee tickets"),
  ...scopedPermission(
    "hr.ticket.write",
    "Raise tickets for employees, reply, change status and reopen",
  ),

  // apps/api/src/modules/employee-self-service/tickets — own tickets only.
  {
    code: "employee_self_service.ticket.read",
    description: "View tickets I raised or that HR raised for me",
  },
  {
    code: "employee_self_service.ticket.create",
    description: "Raise a ticket to HR",
  },
  {
    code: "employee_self_service.ticket.update",
    description:
      "Edit my own open ticket and reply on tickets HR raised for me",
  },

  // apps/api/src/modules/hr/expense-claims — team-scoped by the EMPLOYEE's team.
  // Reads are own/team/all. Deciding is granted at team/all; an own-level
  // holder is refused in the service, and self-approval in the repository.
  ...scopedPermission("hr.expense_claim.read", "View expense claims"),
  ...scopedPermission(
    "hr.expense_claim.decide",
    "Approve or reject expense claims",
  ),

  // apps/api/src/modules/hr/exit-requests — reads are own/team/all. Reviewing,
  // approving or rejecting is the separate `decide` permission; an own-level
  // holder is refused, and self-decision is refused in the repository.
  ...scopedPermission("hr.exit_request.read", "View exit requests"),
  ...scopedPermission(
    "hr.exit_request.decide",
    "Review, approve or reject exit requests",
  ),

  // apps/api/src/modules/employee-self-service/expense-claims — own claims only.
  {
    code: "employee_self_service.expense_claim.create",
    description: "Submit an expense claim for myself",
  },
  {
    code: "employee_self_service.expense_claim.read",
    description: "View my own expense claims",
  },

  // apps/api/src/modules/employee-self-service/exit-requests — own requests only.
  // There is no cancel, withdraw or resubmit permission: none exists in legacy.
  {
    code: "employee_self_service.exit_request.create",
    description: "Submit an exit request for myself",
  },
  {
    code: "employee_self_service.exit_request.read",
    description: "View my own exit requests",
  },

  // apps/api/src/modules/employee-self-service/tasks — own tasks only.
  {
    code: "employee_self_service.task.read",
    description: "View tasks assigned to me or created by me",
  },
  {
    code: "employee_self_service.task.create",
    description:
      "Create a task for myself (optionally request admin attention)",
  },
  {
    code: "employee_self_service.task.update_status",
    description: "Update the status of my own tasks until admin approval",
  },

  // apps/api/src/platform/audit — read-only; no team dimension (design A-4).
  {
    code: "audit.log.read",
    description: "Browse the organization's audit trail",
  },
];

export const RETIRED_PERMISSIONS: readonly RetiredPermission[] = [];
