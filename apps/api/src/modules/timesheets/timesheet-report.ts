import type { DaySummary } from "./timesheet-review-views.js";

/**
 * Pure report builders over review day summaries (no I/O; unit-tested in
 * timesheet-report.spec.ts). The CSV text itself comes from `common/csv`, which
 * also neutralises spreadsheet formulas in names and notes.
 */

export interface EmployeeReportLine {
  employee: DaySummary["employee"];
  /** Days with any work recorded (including a zero-minute stale day). */
  daysRecorded: number;
  taskMinutes: number;
  customMinutes: number;
  totalMinutes: number;
  /** Own, native days still drafts — the ones the employee has not submitted. */
  notSubmittedDays: number;
  submittedDays: number;
  approvedDays: number;
  returnedDays: number;
  /** Days with a session a reviewer should look at. */
  needsAttentionDays: number;
  /** Over the range, from HR attendance (0 until the service fills them in):
   * the shift targets AFTER approved permissions, the permission minutes, and
   * the minutes HR counts as worked. */
  targetMinutes: number;
  permissionMinutes: number;
  attendanceMinutes: number;
}

/** One line per employee, in name order. Migrated legacy drafts are never
 * counted as "not submitted". */
export function buildEmployeeReport(
  days: readonly DaySummary[],
): EmployeeReportLine[] {
  const byEmployee = new Map<number, EmployeeReportLine>();
  for (const day of days) {
    let line = byEmployee.get(day.employee.id);
    if (!line) {
      line = {
        employee: day.employee,
        daysRecorded: 0,
        taskMinutes: 0,
        customMinutes: 0,
        totalMinutes: 0,
        notSubmittedDays: 0,
        submittedDays: 0,
        approvedDays: 0,
        returnedDays: 0,
        needsAttentionDays: 0,
        targetMinutes: 0,
        permissionMinutes: 0,
        attendanceMinutes: 0,
      };
      byEmployee.set(day.employee.id, line);
    }
    line.daysRecorded += 1;
    line.taskMinutes += day.taskMinutes;
    line.customMinutes += day.customMinutes;
    line.totalMinutes += day.totalMinutes;
    if (day.needsAttention) line.needsAttentionDays += 1;
    switch (day.status) {
      case "DRAFT":
        if (day.native) line.notSubmittedDays += 1;
        break;
      case "SUBMITTED":
        line.submittedDays += 1;
        break;
      case "APPROVED":
        line.approvedDays += 1;
        break;
      case "REJECTED":
        line.returnedDays += 1;
        break;
    }
  }
  return [...byEmployee.values()].sort((a, b) =>
    a.employee.name.localeCompare(b.employee.name),
  );
}

/** `135` -> `2.25` (hours, two decimals) — what a spreadsheet can add up. */
export function hours(minutes: number): number {
  return Math.round((minutes / 60) * 100) / 100;
}

export const EMPLOYEE_REPORT_HEADERS = [
  "Employee Code",
  "Employee",
  "Team",
  "Days Recorded",
  "Task Hours",
  "Other Activity Hours",
  "Total Hours",
  "Not Submitted",
  "Submitted",
  "Approved",
  "Returned",
  "Needs Attention",
  "Target Hours (after permissions)",
  "Permission Hours",
  "Attendance Hours",
] as const;

export function employeeReportRow(line: EmployeeReportLine): unknown[] {
  return [
    line.employee.code,
    line.employee.name,
    line.employee.team,
    line.daysRecorded,
    hours(line.taskMinutes),
    hours(line.customMinutes),
    hours(line.totalMinutes),
    line.notSubmittedDays,
    line.submittedDays,
    line.approvedDays,
    line.returnedDays,
    line.needsAttentionDays,
    hours(line.targetMinutes),
    hours(line.permissionMinutes),
    hours(line.attendanceMinutes),
  ];
}

export const DAY_REPORT_HEADERS = [
  "Employee Code",
  "Employee",
  "Team",
  "Date",
  "Status",
  "Waiting For",
  "Task Hours",
  "Other Activity Hours",
  "Total Hours",
  "Activities",
  "Submitted At",
  "First Approved At",
  "Decided At",
  "Decision Note",
] as const;

const STATUS_LABEL: Record<DaySummary["status"], string> = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  APPROVED: "Approved",
  REJECTED: "Returned",
};

export function dayReportRow(day: DaySummary): unknown[] {
  return [
    day.employee.code,
    day.employee.name,
    day.employee.team,
    day.date,
    STATUS_LABEL[day.status],
    day.stage === "MANAGER" ? "Team lead" : day.stage === "HR" ? "HR" : "",
    hours(day.taskMinutes),
    hours(day.customMinutes),
    hours(day.totalMinutes),
    day.rowCount,
    day.submittedAt ?? "",
    day.firstApprovedAt ?? "",
    day.decidedAt ?? "",
    day.decisionNote ?? "",
  ];
}
