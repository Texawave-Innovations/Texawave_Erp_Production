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

  // Which shell a user with an employee record gets (UI only — every HR route
  // still enforces its own permission). Without it, employees and team leads
  // work in the self-service portal, whatever hr.* reads their role holds;
  // gates the `hr` menu group (prisma/menu/catalog.ts), so Settings → Roles →
  // Menu access shows it as the "HR" row. Docs/MENU_NAVIGATION_API.md §5.1.
  {
    code: "hr.workspace.access",
    description: "Open the HR workspace (dashboard) instead of only the portal",
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

  // apps/api/src/modules/hr/leave-requests — team-scoped (Docs/HR_LEAVE.md §6).
  // Deciding is its own permission. hr.leave.approve.own is the REPORTING
  // MANAGER level: it decides only the leave of the caller's direct reports
  // (and of a manager who delegated to the caller) — never the caller's own
  // request. .team/.all also decide within their scope; only .all gives the
  // second (HR) approval of a two-level leave type. Who approves is an open
  // decision, so approve.own/.team are granted to no role by default.
  ...scopedPermission("hr.leave_request.read", "View leave requests"),
  {
    code: "hr.leave.approve.own",
    description:
      "Approve or reject leave of employees who report to me (reporting manager)",
  },
  {
    code: "hr.leave.approve.team",
    description:
      "Approve or reject leave requests (own team, plus my direct reports)",
  },
  {
    code: "hr.leave.approve.all",
    description:
      "Approve or reject leave requests (all teams), including the HR approval",
  },
  // Apply on an employee's behalf, and cancel someone's pending/approved
  // leave. .own of both is reserved: one's own leave goes through
  // self-service, and the service refuses the caller's own record.
  ...scopedPermission(
    "hr.leave_request.create",
    "Apply for leave on an employee's behalf",
  ),
  ...scopedPermission(
    "hr.leave.cancel",
    "Cancel an employee's pending or approved leave",
  ),
  ...scopedPermission(
    "hr.leave_request.export",
    "Export leave requests and balances to CSV",
  ),

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
  // Export and punch import (Docs/HR_API.md → Attendance). import.own is
  // reserved: nobody may load punches for themselves.
  ...scopedPermission("hr.attendance.export", "Export attendance to CSV"),
  ...scopedPermission(
    "hr.attendance.import",
    "Import punches from a CSV / biometric export",
  ),
  // Monthly attendance close. finalize/approve .own are reserved (nobody
  // closes or approves their own month), and the approver must be a
  // different user from the one who submitted (maker-checker, enforced in
  // the service).
  ...scopedPermission(
    "hr.attendance_lock.read",
    "View monthly attendance closes",
  ),
  ...scopedPermission(
    "hr.attendance_lock.finalize",
    "Submit a month of attendance for approval",
  ),
  ...scopedPermission(
    "hr.attendance_lock.approve",
    "Approve, return or reopen a submitted attendance month",
  ),

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

  // apps/api/src/modules/hr/promotion-letters — same model as revision letters:
  // employee-linked, team-scoped through the employee, write.own reserved, and
  // no .team grant to any role by default.
  ...scopedPermission(
    "hr.promotion_letter.read",
    "View promotion letters and an employee's salary history",
  ),
  ...scopedPermission(
    "hr.promotion_letter.write",
    "Issue and edit promotion letters",
  ),

  // apps/api/src/modules/hr/employees — team-scoped data, so read/write are
  // seeded as .own/.team/.all together. Team leads get read.team only by
  // default; write.team exists but is granted to no role without approval.
  // .own write is reserved (self-service edits are not built).
  ...scopedPermission("hr.employee.read", "View employees"),
  ...scopedPermission("hr.employee.write", "Create/edit employees"),
  // Bulk CSV export of the employee directory, including work e-mail and phone
  // — a separate grant because a bulk download is a larger exposure than
  // reading records one at a time. (CSV import is bulk *create* and rides on
  // hr.employee.write, with the same scope rules as creating one employee.)
  ...scopedPermission("hr.employee.export", "Export the employee directory"),
  // HR review of a submitted onboarding profile (approve or send back).
  // Team-scoped through the employee; .own is refused in the service (nobody
  // reviews their own profile). Docs/ARCHITECTURE.md §7.
  ...scopedPermission(
    "hr.employee_onboarding.approve",
    "Approve or send back a submitted onboarding profile",
  ),
  // apps/api/src/modules/hr/employee-documents — same team-scoped shape as
  // hr.employee.*. Covers both the read-only view of onboarding's documents
  // and HR's own ad-hoc uploads for an employee.
  ...scopedPermission(
    "hr.employee_document.read",
    "View an employee's documents",
  ),
  ...scopedPermission(
    "hr.employee_document.write",
    "Upload or remove an employee's documents",
  ),
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
    code: "employee_self_service.profile.write",
    description:
      "Edit my own onboarding profile (personal, bank, family, experience, documents)",
  },
  // Full bank account number (masked form is visible under hr.employee.read).
  ...scopedPermission(
    "hr.employee_bank.reveal",
    "Reveal full bank account numbers",
  ),
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

  // apps/api/src/modules/hr/candidates — recruitment pipeline, team-scoped
  // the same way hr.task.*/hr.ticket.* are: read/write seeded as
  // .own/.team/.all together, following the exact scoped pattern above.
  ...scopedPermission("hr.candidate.read", "View candidates"),
  ...scopedPermission(
    "hr.candidate.write",
    "Create/update candidates and their pipeline stage",
  ),

  // apps/api/src/platform/audit — read-only; no team dimension (design A-4).
  {
    code: "audit.log.read",
    description: "Browse the organization's audit trail",
  },

  // apps/api/src/modules/hr/payroll — team-scoped
  ...scopedPermission(
    "hr.payroll.read",
    "View payroll periods, runs and entries",
  ),
  ...scopedPermission(
    "hr.payroll.write",
    "Create payroll periods and execute payroll runs",
  ),
  ...scopedPermission("hr.payroll.approve", "Approve payroll runs"),
  ...scopedPermission("hr.payroll.finalize", "Finalize payroll periods"),
  ...scopedPermission(
    "hr.payroll.reopen",
    "Reopen a finalized payroll period (reason required)",
  ),
  ...scopedPermission(
    "hr.payroll.export",
    "Download payroll statutory files and reports (PF ECR, ESI, PT, TDS, journal, salary register)",
  ),

  // apps/api/src/modules/hr/payroll/settings — organization-wide rules and
  // masters: pay-days/attendance/overtime policy, PF/ESI/PT/TDS rules, salary
  // components and templates, tax regimes. Not employee data, so no scope.
  {
    code: "hr.payroll_settings.read",
    description:
      "View payroll settings and masters (policy, statutory rules, salary components, templates, tax slabs)",
  },
  {
    code: "hr.payroll_settings.write",
    description:
      "Change payroll settings and masters (policy, statutory rules, salary components, templates, tax slabs)",
  },

  // Carried over from an earlier (pre-payroll-module) permission design that
  // duplicated hr.payroll.read/write above under the same codes with
  // different descriptions — consolidated here to resolve that duplicate
  // registration. `hr.payroll.credit` itself was never a duplicate (unique
  // code) and is preserved as-is; no controller currently checks it
  // (crediting payslips today runs through hr.payment.write in
  // apps/api/src/modules/hr/payroll/payments), so it is kept seeded but
  // unused rather than deleted, per the no-removal constraint.
  ...scopedPermission(
    "hr.payroll.credit",
    "Mark payslips as credited (paid out)",
  ),

  // Salary structures — team-scoped
  ...scopedPermission("hr.salary.read", "View employee salary structures"),
  ...scopedPermission(
    "hr.salary.write",
    "Create and update employee salary structures",
  ),

  // PF compliance — team-scoped
  ...scopedPermission("hr.pf.read", "View PF profiles and contributions"),
  ...scopedPermission("hr.pf.write", "Manage PF profiles and contributions"),

  // ESI compliance — team-scoped
  ...scopedPermission("hr.esi.read", "View ESI profiles and contributions"),
  ...scopedPermission("hr.esi.write", "Manage ESI profiles and contributions"),

  // Employee loans — team-scoped
  ...scopedPermission("hr.loan.read", "View employee loans and repayments"),
  ...scopedPermission("hr.loan.write", "Create employee loans and repayments"),
  ...scopedPermission(
    "hr.loan.approve",
    "Give the final approval to employee loans (after HR review); approve EMI skip requests and prepayments",
  ),
  ...scopedPermission(
    "hr.loan.review",
    "Review employee loan requests (HR step): forward for final approval or reject",
  ),

  // Employee bonuses — team-scoped
  ...scopedPermission("hr.bonus.read", "View employee bonuses"),
  ...scopedPermission("hr.bonus.write", "Create employee bonuses"),
  ...scopedPermission("hr.bonus.approve", "Approve employee bonuses"),

  // Payslips — team-scoped
  ...scopedPermission("hr.payslip.read", "View and download payslips"),

  // Income-tax declarations and Form 16 — team-scoped
  ...scopedPermission(
    "hr.tax_declaration.read",
    "View employees' tax declarations, TDS working and Form 16",
  ),
  ...scopedPermission(
    "hr.tax_declaration.write",
    "Enter or correct a tax declaration on an employee's behalf",
  ),
  ...scopedPermission(
    "hr.tax_declaration.approve",
    "Verify or reject submitted tax declarations against proofs",
  ),

  // Payment batches & payouts — team-scoped
  ...scopedPermission("hr.payment.read", "View payment batches and payouts"),
  ...scopedPermission(
    "hr.payment.write",
    "Generate and process payment batches",
  ),

  // Self-service payslip & loan read
  {
    code: "employee_self_service.payslip.read",
    description: "View my own payslips",
  },
  {
    code: "employee_self_service.loan.read",
    description: "View my own loans and repayments",
  },
  {
    code: "employee_self_service.loan.write",
    description: "Request a loan for myself (HR review, then final approval)",
  },
  {
    code: "employee_self_service.tax_declaration.read",
    description: "View my own income-tax declarations",
  },
  {
    code: "employee_self_service.tax_declaration.write",
    description: "Fill in and submit my own income-tax declaration",
  },
  {
    code: "employee_self_service.form16.read",
    description: "Download my own Form 16",
  },

  // apps/api/src/modules/crm/accounts — minimal CRM Account foundation
  // (Phase 4B). Organization-wide reference data (any contact's required
  // parent), no team dimension — same shape as master-data/* above.
  { code: "crm.account.read", description: "View CRM accounts" },
  {
    code: "crm.account.write",
    description: "Create/update CRM accounts",
  },

  // apps/api/src/modules/crm/contacts — migrated from the LIVE legacy
  // TexaWave_ERP/src/modules/crm/domain/contactsService.ts (RTDB
  // `crm/contacts`). `teamId` exists on the table but no production
  // decision has been made about who owns a contact's team, so read/write
  // are seeded `.own/.team/.all` per the standard pattern (CODING_STANDARDS
  // §10a); `.team` is granted to no default role in this phase — see
  // default-roles.ts.
  ...scopedPermission("crm.contact.read", "View CRM contacts"),
  ...scopedPermission("crm.contact.write", "Create/update/delete CRM contacts"),

  // apps/api/src/modules/crm/leads — migrated from the LIVE legacy
  // TexaWave_ERP/src/modules/crm/Leads.tsx + domain/LeadConvertDialog.tsx
  // (RTDB `crm/leads`). Same `.own/.team/.all` shape as crm.contact.* —
  // legacy gates Delete behind "CRM Admin only" (isCrmAdmin), but this app
  // has no separate CRM-admin role concept yet, so `.write` is the
  // documented stand-in, same as crm.contact.write. Converting a lead
  // (create/link Account + Contact) also requires `.write`; it does not
  // get its own permission since it is just a multi-record write.
  ...scopedPermission("crm.lead.read", "View CRM leads"),
  ...scopedPermission(
    "crm.lead.write",
    "Create/update/delete/convert CRM leads",
  ),

  // apps/api/src/modules/crm/pipeline-stages — migrated from the LIVE
  // legacy TexaWave_ERP/src/modules/crm/domain/pipelineStagesService.ts.
  // Organization-wide configuration (every opportunity references a
  // stage), no team dimension — same shape as crm.account.*. Legacy gates
  // stage management behind "CRM Admin / Sales Head"
  // (`canManagePipelineConfig`); this app has no separate role concept for
  // that yet, so `.write` is the stand-in, same convention as
  // crm.lead.write.
  { code: "crm.pipeline_stage.read", description: "View CRM pipeline stages" },
  {
    code: "crm.pipeline_stage.write",
    description: "Create/update/reorder/delete CRM pipeline stages",
  },

  // apps/api/src/modules/crm/opportunities — migrated from the LIVE legacy
  // TexaWave_ERP/src/modules/crm/Pipeline.tsx + domain/opportunitiesService.ts
  // + domain/OpportunityDrawer.tsx (RTDB `crm/opportunities` +
  // `crm/opportunityStageHistory`). Same `.own/.team/.all` shape as
  // crm.lead.*. Legacy's `canManageOpportunity` lets "CRM Admin"/"Sales
  // Head" manage any opportunity but a "Sales Executive" only their own —
  // the closest existing mapping is `.all` for admin/manager-equivalent
  // roles and `.own` for everyone else, same stand-in pattern as
  // crm.lead.write for the admin-only Delete gate. Stage-transition
  // actions (change-stage, won/lost/on-hold/reopen) and reading stage
  // history all require only the base read/write permission — none of
  // them are separately permissioned, since legacy does not gate them
  // more narrowly than "can edit this opportunity" either.
  ...scopedPermission("crm.opportunity.read", "View CRM opportunities"),
  ...scopedPermission(
    "crm.opportunity.write",
    "Create/update/delete/change-stage CRM opportunities",
  ),

  // apps/api/src/modules/crm/products — migrated from the LIVE legacy
  // TexaWave_ERP/src/modules/crm/Products.tsx + domain/productsService.ts
  // (RTDB `crm/products`). Organization-wide reference data, no team
  // dimension — same shape as crm.account.*/crm.pipeline_stage.*, not the
  // `.own/.team/.all` shape used by crm.lead.*/crm.opportunity.*. Legacy
  // gates Create/Update behind "CRM Admin / Sales Head"
  // (`canManageProducts`) and Delete behind "CRM Admin only"
  // (`isCrmAdmin`) — strictly narrower than Create/Update. This app has
  // no separate CRM-admin role concept, so `.write` is the single-tier
  // stand-in for BOTH gates, same convention as crm.pipeline_stage.write.
  { code: "crm.product.read", description: "View CRM products" },
  {
    code: "crm.product.write",
    description: "Create/update/archive/delete CRM products",
  },

  // apps/api/src/modules/crm/opportunities (deal line items) — migrated
  // from the LIVE legacy TexaWave_ERP/src/modules/crm/domain/
  // dealProductsService.ts + domain/AddDealProductsDialog.tsx
  // (RTDB `crm/dealProducts`). Adding/editing/removing a line item on an
  // Opportunity is governed by the SAME permission as editing the
  // Opportunity itself (crm.opportunity.*) — it is not a separately
  // permissioned action in legacy either (the Products tab UI gate is
  // whatever already gates the surrounding DealDetail screen), so no new
  // permission code is introduced for it.

  // apps/api/src/modules/crm/quotations — migrated from the LIVE legacy
  // TexaWave_ERP/src/modules/crm/QuoteForm.tsx + Quotes.tsx +
  // domain/quotationsService.ts (RTDB `crm/quotations` +
  // `crm/quotationItems`). Organization-wide reference data, no team
  // dimension — same shape as crm.product.*/crm.pipeline_stage.*
  // (approved decision D1, Docs/CRM_QUOTES_LEGACY_PARITY.md §4/§6).
  //
  // UNLIKE every other CRM entity so far, Delete here is its OWN
  // permission, `crm.quotation.delete`, deliberately NOT folded into
  // `.write`. Legacy's Delete is `isCrmAdmin`-only while Create/Update
  // have NO permission gate at all (verified — `canManageQuotes` does
  // not exist in roles.ts); this phase's approved decision requires that
  // an ordinary `.write` grant must NOT be able to delete a quotation,
  // so collapsing the two tiers the way crm.product.write/
  // crm.pipeline_stage.write do would violate that explicitly. Grant
  // `.delete` only to admin-equivalent roles via Settings → Roles.
  { code: "crm.quotation.read", description: "View CRM quotations" },
  {
    code: "crm.quotation.write",
    description: "Create/update CRM quotations (does not include delete)",
  },
  {
    code: "crm.quotation.delete",
    description:
      "Delete CRM quotations — granted separately from crm.quotation.write",
  },

  // apps/api/src/modules/crm/accounts — Phase 0 (Account-360 foundation,
  // Docs/CRM_FULL_LEGACY_PARITY.md §4) added delete, which the Phase 4B
  // foundation never had. Legacy's Delete (incl. cascade-delete) is
  // `isCrmAdmin`-only, same single-tier admin-only shape as
  // crm.quotation.delete — not folded into `.write`, granted separately.
  {
    code: "crm.account.delete",
    description:
      "Delete CRM accounts (incl. cascade) — granted separately from crm.account.write",
  },

  // apps/api/src/modules/crm/meetings, follow-ups, activities, tasks,
  // documents, notes — Phase 0 Account-360 supporting entities (legacy
  // domain/meetingsService.ts, followupsService.ts, activitiesService.ts,
  // tasksService.ts, documentsService.ts, intelligence/notesService.ts).
  // Every one of these 6 entities' legacy delete path funnels through the
  // same generic `assertCrmAdmin` gate (confirmed by direct audit) — same
  // single-tier admin-only `.delete` shape as crm.account.delete/
  // crm.quotation.delete above, not a `.own/.team/.all` scope (legacy CRM
  // has no team dimension for any of these entities).
  { code: "crm.meeting.read", description: "View CRM meetings" },
  {
    code: "crm.meeting.write",
    description:
      "Create/update/complete/cancel/reschedule CRM meetings (does not include delete)",
  },
  {
    code: "crm.meeting.delete",
    description:
      "Delete CRM meetings — granted separately from crm.meeting.write",
  },
  { code: "crm.followup.read", description: "View CRM follow-ups" },
  {
    code: "crm.followup.write",
    description:
      "Create/update/complete/cancel/reschedule CRM follow-ups (does not include delete)",
  },
  {
    code: "crm.followup.delete",
    description:
      "Delete CRM follow-ups — granted separately from crm.followup.write",
  },
  { code: "crm.activity.read", description: "View CRM activities" },
  {
    code: "crm.activity.write",
    description: "Log/update CRM activities (does not include delete)",
  },
  {
    code: "crm.activity.delete",
    description:
      "Delete CRM activities — granted separately from crm.activity.write",
  },
  { code: "crm.task.read", description: "View CRM tasks" },
  {
    code: "crm.task.write",
    description:
      "Create/update/complete CRM tasks (does not include delete) — distinct from hr.task.*, which is the unrelated employee-assignment task",
  },
  {
    code: "crm.task.delete",
    description: "Delete CRM tasks — granted separately from crm.task.write",
  },
  { code: "crm.document.read", description: "View CRM documents" },
  {
    code: "crm.document.write",
    description:
      "Add CRM documents (name + external link only, no upload; no update in legacy either)",
  },
  {
    code: "crm.document.delete",
    description:
      "Delete CRM documents — granted separately from crm.document.write",
  },
  { code: "crm.note.read", description: "View CRM account notes" },
  {
    code: "crm.note.write",
    description: "Add CRM account notes (no update in legacy)",
  },
  {
    code: "crm.note.delete",
    description:
      "Delete CRM account notes — granted separately from crm.note.write",
  },

  // apps/api/src/modules/crm/cold-calling — Phase 1B additive queue (Docs/
  // CRM_FULL_LEGACY_PARITY.md §10). Legacy `ColdCallingStatus.tsx` gates its
  // own delete through the same generic `isCrmAdmin` check as every other
  // CRM entity above — same single-tier admin-only `.delete` shape.
  {
    code: "crm.coldcalling.read",
    description: "View CRM Cold Calling Status entries",
  },
  {
    code: "crm.coldcalling.write",
    description:
      "Add/update CRM Cold Calling Status entries, link them to an Account, and record a routed disposition (does not include delete)",
  },
  {
    code: "crm.coldcalling.delete",
    description:
      "Delete CRM Cold Calling Status entries — granted separately from crm.coldcalling.write",
  },
];

export const RETIRED_PERMISSIONS: readonly RetiredPermission[] = [
  {
    code: "employee_self_service.work_log.create",
    reason: "Work logs module removed",
  },
  {
    code: "employee_self_service.work_log.read",
    reason: "Work logs module removed",
  },
  { code: "hr.work_log.read.own", reason: "Work logs module removed" },
  { code: "hr.work_log.read.team", reason: "Work logs module removed" },
  { code: "hr.work_log.read.all", reason: "Work logs module removed" },
  { code: "hr.work_log.approve", reason: "Work logs module removed" },
];
