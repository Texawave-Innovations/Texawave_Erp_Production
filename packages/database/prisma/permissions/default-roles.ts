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
//  - HR Manager submits a month of attendance (`hr.attendance_lock.finalize`)
//    but does not approve it: approval is Super Admin's, the legacy "HR sends,
//    Admin accepts" split. The service also refuses approval by the submitter.
//  - Payroll follows the same split (Docs/PAYROLL_AND_COMPLIANCE.md "Default
//    roles"): HR Manager prepares — salaries, runs, loans, bonuses, payments,
//    statutory files, tax-declaration checks — and finalizes once approved,
//    and reviews employee loan requests (the HR step), but approving a run,
//    giving a loan its final approval, a skip/prepayment or a bonus, reopening a
//    finalized month and changing payroll settings stay with Super Admin.
//    Team Lead sees no pay data (salary is confidential, even within a team).
//    Employee reads only their own payslips, loans and Form 16 and fills in
//    their own tax declaration.
//  - Sales Manager holds every sales.* permission; Sales Executive creates,
//    edits and sends customers/documents but cannot delete anything, record
//    payments, reveal bank accounts or edit the Sales master list. No HR
//    role holds sales.*, and no Sales role holds HR permissions.
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
      "hr.employee.export.all",
      "hr.employee_onboarding.approve.all",
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
      "hr.leave_request.create.all",
      "hr.leave.cancel.all",
      "hr.leave_request.export.all",
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
      "hr.attendance.export.all",
      "hr.attendance.import.all",
      "hr.attendance_lock.read.all",
      "hr.attendance_lock.finalize.all",
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
      "hr.payroll.read.all",
      "hr.payroll.write.all",
      "hr.payroll.finalize.all",
      "hr.payroll.export.all",
      "hr.payroll_settings.read",
      "hr.salary.read.all",
      "hr.salary.write.all",
      "hr.pf.read.all",
      "hr.pf.write.all",
      "hr.esi.read.all",
      "hr.esi.write.all",
      "hr.loan.read.all",
      "hr.loan.write.all",
      "hr.loan.review.all",
      "hr.bonus.read.all",
      "hr.bonus.write.all",
      "hr.payslip.read.all",
      "hr.payment.read.all",
      "hr.payment.write.all",
      "hr.tax_declaration.read.all",
      "hr.tax_declaration.write.all",
      "hr.tax_declaration.approve.all",
    ],
  },
  {
    name: "Sales Manager",
    description:
      "Runs Sales: customers (incl. delete and bank-account reveal), quotations, invoices, payments received, delivery challans, returnable DCs, dashboard, checklist and the Sales master list.",
    permissions: [
      "sales.dashboard.read",
      "sales.customer.read",
      "sales.customer.write",
      "sales.customer.delete",
      "sales.customer_bank.reveal",
      "sales.action_item.read",
      "sales.action_item.write",
      "sales.master.read",
      "sales.master.write",
      "sales.running_number.write",
      "sales.quotation.read",
      "sales.quotation.write",
      "sales.quotation.delete",
      "sales.quotation.send",
      "sales.invoice.read",
      "sales.invoice.write",
      "sales.invoice.delete",
      "sales.invoice.send",
      "sales.invoice_payment.write",
      "sales.delivery_challan.read",
      "sales.delivery_challan.write",
      "sales.delivery_challan.delete",
      "sales.delivery_challan.send",
      "sales.payment.read",
      "sales.returnable_dc.read",
      "sales.returnable_dc.write",
      "sales.returnable_dc.delete",
      "sales.returnable_dc.send",
    ],
  },
  {
    name: "Sales Executive",
    description:
      "Day-to-day Sales: customers, quotations, invoices, delivery challans and returnable DCs (create, edit, send) and viewing payments received; cannot delete, record payments or reveal bank accounts.",
    permissions: [
      "sales.dashboard.read",
      "sales.customer.read",
      "sales.customer.write",
      "sales.action_item.read",
      "sales.action_item.write",
      "sales.master.read",
      "sales.quotation.read",
      "sales.quotation.write",
      "sales.quotation.send",
      "sales.invoice.read",
      "sales.invoice.write",
      "sales.invoice.send",
      "sales.delivery_challan.read",
      "sales.delivery_challan.write",
      "sales.delivery_challan.send",
      "sales.payment.read",
      "sales.returnable_dc.read",
      "sales.returnable_dc.write",
      "sales.returnable_dc.send",
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
      "hr.attendance.read.team",
      "hr.attendance_correction.read.team",
      "hr.attendance_report.read.team",
      "hr.attendance_lock.read.team",
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
      "employee_self_service.profile.write",
      "employee_self_service.leave_request.read",
      "employee_self_service.leave_request.create",
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
      "employee_self_service.payslip.read",
      "employee_self_service.loan.read",
      "employee_self_service.loan.write",
      "employee_self_service.tax_declaration.read",
      "employee_self_service.tax_declaration.write",
      "employee_self_service.form16.read",
      "hr.attendance_correction.read.own",
      "hr.shift_assignment.read.own",
      "hr.holiday.read",
      "hr.leave_type.read",
    ],
  },
] as const;
