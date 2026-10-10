// Starting roles for LOCAL DEV (seed.ts). Roles are per-organization data that
// administrators manage in Settings → Roles — production does not get roles
// from here; it gets the permissions themselves from catalog.ts. These
// definitions exist so a fresh dev database has realistic HR roles, and so the
// approved defaults are pinned by a test (default-roles.test.ts):
//
//  - Team Lead is READ-ONLY. It holds no write, approve, status or account
//    permission (decision: "team leads are read-only by default; do not grant
//    employee write permissions without approval").
//  - Nobody but Super Admin holds `hr.employee_status.correct` (the audited
//    correction of a RESIGNED/TERMINATED status).
//  - `.team`-scoped write/approve permissions are granted to no role: who
//    among team leads approves leave, and whether team leads may edit
//    employees, are open decisions.
//
// Seeding is ADDITIVE: it grants what is listed here and never removes a
// grant an administrator added (see seed.ts).
export interface DefaultRole {
  name: string;
  description: string;
  permissions: readonly string[];
}

export const DEFAULT_ROLES: readonly DefaultRole[] = [
  {
    name: "HR Manager",
    description: "Runs HR across all teams. Cannot correct a terminal status.",
    permissions: [
      "master.designation.read",
      "master.designation.write",
      "master.employment_type.read",
      "master.employment_type.write",
      "master.work_location.read",
      "master.work_location.write",
      "master.shift.read",
      "master.shift.write",
      "hr.workspace.access",
      "hr.employee.read.all",
      "hr.employee.write.all",
      "hr.employee_document.read.all",
      "hr.employee_document.write.all",
      "hr.employee_status.write",
      "hr.employee_account.write",
      "hr.shift_assignment.read.all",
      "hr.shift_assignment.write.all",
      "hr.holiday.read",
      "hr.holiday.write",
      "hr.weekly_off.read",
      "hr.weekly_off.write",
      "hr.leave_type.read",
      "hr.leave_type.write",
      "hr.leave_request.read.all",
      "hr.leave.approve.all",
      "hr.work_log.read.all",
      "hr.work_log.approve",
      "hr.expense_claim.read.all",
      "hr.expense_claim.decide.all",
      "hr.exit_request.read.all",
      "hr.exit_request.decide.all",
      "hr.task.read.all",
      "hr.task.write.all",
      "hr.ticket.read.all",
      "hr.ticket.write.all",
      "hr.attendance.read.all",
      "hr.attendance.write.all",
      "hr.attendance_correction.read.all",
      "hr.attendance_correction.approve.all",
      "hr.attendance_report.read.all",
      "hr.location_privilege.read",
      "hr.location_privilege.write",
      "hr.office_network.read",
      "hr.office_network.write",
      "hr.revision_letter.read.all",
      "hr.revision_letter.write.all",
      "hr.promotion_letter.read.all",
      "hr.promotion_letter.write.all",
      "hr.employee_profile.read.all",
      "hr.employee_profile.write.all",
      "hr.employee_sensitive.read",
      "hr.employee_sensitive.write",
      "hr.interview.read",
      "hr.interview.write",
      "hr.offer_letter.read",
      "hr.offer_letter.write",
      "audit.log.read",
    ],
  },
  {
    name: "Team Lead",
    description: "Read-only view of their own team (by default).",
    permissions: [
      "hr.employee.read.team",
      "hr.employee_document.read.team",
      "hr.shift_assignment.read.team",
      "hr.leave_request.read.team",
      "hr.work_log.read.team",
      "hr.attendance.read.team",
      "hr.attendance_correction.read.team",
      "hr.attendance_report.read.team",
      "hr.holiday.read",
      "hr.weekly_off.read",
      "hr.leave_type.read",
    ],
  },
  {
    name: "Employee",
    description:
      "Self-service: own profile and own leave; may read the calendar.",
    permissions: [
      "employee_self_service.profile.read",
      "employee_self_service.leave_request.read",
      "employee_self_service.leave_request.create",
      "employee_self_service.work_log.create",
      "employee_self_service.work_log.read",
      "employee_self_service.expense_claim.create",
      "employee_self_service.expense_claim.read",
      "employee_self_service.exit_request.create",
      "employee_self_service.exit_request.read",
      "employee_self_service.task.read",
      "employee_self_service.task.create",
      "employee_self_service.task.update_status",
      "employee_self_service.ticket.read",
      "employee_self_service.ticket.create",
      "employee_self_service.ticket.update",
      "employee_self_service.attendance.punch",
      "employee_self_service.attendance.read",
      "employee_self_service.attendance_correction.create",
      "hr.attendance_correction.read.own",
      "hr.shift_assignment.read.own",
      "hr.holiday.read",
      "hr.leave_type.read",
    ],
  },
] as const;
