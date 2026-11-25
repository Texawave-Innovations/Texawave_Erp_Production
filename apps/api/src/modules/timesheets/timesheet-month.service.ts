import { Injectable } from "@nestjs/common";
import { parseDateOnly } from "../../common/dates/date-only.js";
import { TenantContextService } from "../../platform/tenancy/tenant-context.service.js";
import type { EmployeeRef } from "../hr/attendance/services/attendance-day-resolver.js";
import { AttendanceLookupService } from "../hr/attendance/services/attendance-lookup.service.js";
import {
  buildEmployeeMonth,
  monthBounds,
  type EmployeeMonth,
} from "./timesheet-month.js";
import { TimesheetsRepository } from "./timesheets.repository.js";

/**
 * One employee's month: HR attendance (status, punches, hours, approved
 * permissions) beside the timesheet. The employee is always passed in by a
 * caller that has already decided the viewer may see them — the employee
 * themself (`TimesheetsService`) or a reviewer inside their
 * `hr.timesheet.read` reach (`TimesheetWorkflowService`).
 */
@Injectable()
export class TimesheetMonthService {
  constructor(
    private readonly repository: TimesheetsRepository,
    private readonly tenantContext: TenantContextService,
    private readonly attendance: AttendanceLookupService,
  ) {}

  async forEmployee(
    employee: EmployeeRef,
    month: string,
  ): Promise<EmployeeMonth> {
    const scope = this.tenantContext.getOrgScope();
    const { from, to } = monthBounds(month);
    const [attendance, rows] = await Promise.all([
      this.attendance.dayStatuses(scope, employee, from, to),
      this.repository.findRowsInRange(
        scope,
        employee.id,
        parseDateOnly(from),
        parseDateOnly(to),
      ),
    ]);
    return buildEmployeeMonth({
      month,
      attendance,
      rows: rows.map((r) => ({
        workDate: r.workDate.toISOString().slice(0, 10),
        status: r.status,
        category: r.category,
        durationMinutes: r.durationMinutes,
        endedAt: r.endedAt,
        sessions: r.sessions,
      })),
    });
  }
}
