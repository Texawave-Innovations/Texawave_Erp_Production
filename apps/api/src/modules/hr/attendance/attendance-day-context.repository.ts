import { Injectable } from "@nestjs/common";
import {
  formatDateOnly,
  parseDateOnly,
} from "../../../common/dates/date-only.js";
import { OrgScoped } from "../../../common/decorators/org-scoped.decorator.js";
import type { OrgScope } from "../../../common/tenancy/org-scope.js";
import { tenantWhere } from "../../../common/tenancy/tenant-where.js";
import { PrismaService } from "../../../shared/prisma/prisma.service.js";
import type {
  DayContext,
  EmployeeRef,
} from "./services/attendance-day-resolver.js";

/** Read-only batch load of the calendar facts attendance depends on. One query
 * per fact per request regardless of how many employees or days are involved
 * (no N+1). Holiday, WeeklyOffRule, LeaveRequest and ShiftAssignment are owned
 * by other HR submodules; attendance only reads them, never writes them. */
@Injectable()
export class AttendanceDayContextRepository {
  constructor(private readonly prisma: PrismaService) {}

  @OrgScoped()
  async load(
    scope: OrgScope,
    employees: readonly EmployeeRef[],
    from: string,
    to: string,
  ): Promise<DayContext> {
    const fromDate = parseDateOnly(from);
    const toDate = parseDateOnly(to);
    const employeeIds = employees.map((e) => e.id);
    const teamIds = [...new Set(employees.map((e) => e.teamId))];
    if (employeeIds.length === 0) {
      return {
        holidays: [],
        weeklyOffRules: [],
        approvedLeaves: [],
        shiftAssignments: [],
      };
    }

    const [holidays, weeklyOffRules, leaves, assignments] = await Promise.all([
      this.prisma.holiday.findMany({
        where: tenantWhere(scope, {
          isActive: true,
          deletedAt: null,
          holidayDate: { gte: fromDate, lte: toDate },
        }),
        select: { holidayDate: true, workLocationId: true },
      }),
      this.prisma.weeklyOffRule.findMany({
        where: tenantWhere(scope, {
          isActive: true,
          deletedAt: null,
          effectiveFrom: { lte: toDate },
          AND: [
            { OR: [{ effectiveTo: null }, { effectiveTo: { gte: fromDate } }] },
          ],
        }),
        select: {
          daysOfWeek: true,
          teamId: true,
          workLocationId: true,
          effectiveFrom: true,
          effectiveTo: true,
        },
      }),
      this.prisma.leaveRequest.findMany({
        where: tenantWhere(scope, {
          status: "APPROVED",
          isActive: true,
          deletedAt: null,
          employeeId: { in: employeeIds },
          startDate: { lte: toDate },
          endDate: { gte: fromDate },
        }),
        select: { employeeId: true, startDate: true, endDate: true },
      }),
      this.prisma.shiftAssignment.findMany({
        where: tenantWhere(scope, {
          isActive: true,
          deletedAt: null,
          effectiveFrom: { lte: toDate },
          AND: [
            {
              OR: [
                { employeeId: { in: employeeIds } },
                { teamId: { in: teamIds } },
              ],
            },
            { OR: [{ effectiveTo: null }, { effectiveTo: { gte: fromDate } }] },
          ],
        }),
        select: {
          employeeId: true,
          teamId: true,
          effectiveFrom: true,
          effectiveTo: true,
          shift: { select: { workingMinutes: true } },
        },
      }),
    ]);

    return {
      holidays: holidays.map((h) => ({
        date: formatDateOnly(h.holidayDate),
        workLocationId: h.workLocationId,
      })),
      weeklyOffRules: weeklyOffRules.map((r) => ({
        daysOfWeek: r.daysOfWeek,
        teamId: r.teamId,
        workLocationId: r.workLocationId,
        effectiveFrom: formatDateOnly(r.effectiveFrom),
        effectiveTo: r.effectiveTo ? formatDateOnly(r.effectiveTo) : null,
      })),
      approvedLeaves: leaves.map((l) => ({
        employeeId: l.employeeId,
        startDate: formatDateOnly(l.startDate),
        endDate: formatDateOnly(l.endDate),
      })),
      shiftAssignments: assignments.map((a) => ({
        employeeId: a.employeeId,
        teamId: a.teamId,
        effectiveFrom: formatDateOnly(a.effectiveFrom),
        effectiveTo: a.effectiveTo ? formatDateOnly(a.effectiveTo) : null,
        workingMinutes: a.shift.workingMinutes,
      })),
    };
  }
}
