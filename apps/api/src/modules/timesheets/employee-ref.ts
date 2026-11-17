import { BusinessRuleViolationException } from "../../common/exceptions/business.exception.js";
import type { EmployeeQueryService } from "../hr/employees/employee-query.service.js";
import type { EmployeeRef } from "../hr/attendance/services/attendance-day-resolver.js";

/** The signed-in user's employee, as the timesheet services need it: the
 * attendance reference plus the name and login for notifications. Always
 * resolved from the signed-in user, never from the request. */
export interface TimesheetEmployee extends EmployeeRef {
  fullName: string;
  employeeCode: string;
  userId: number | null;
}

export async function requireTimesheetEmployee(
  employeeQuery: EmployeeQueryService,
): Promise<TimesheetEmployee> {
  const employee = await employeeQuery.findCurrentEmployeeOrNull();
  if (!employee) {
    throw new BusinessRuleViolationException(
      "Current user has no associated employee profile",
      "NO_EMPLOYEE_PROFILE",
    );
  }
  return {
    id: employee.id,
    teamId: employee.team.id,
    workLocationId: employee.workLocation?.id ?? null,
    fullName: employee.fullName,
    employeeCode: employee.employeeCode,
    userId: employee.userId,
  };
}
