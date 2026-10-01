import { Injectable } from "@nestjs/common";
import type { Prisma } from "@texawave-erp/database";
import { formatDateOnly } from "../../../common/dates/date-only.js";
import { OrgScoped } from "../../../common/decorators/org-scoped.decorator.js";
import { TeamScoped } from "../../../common/decorators/team-scoped.decorator.js";
import type { OrgScope } from "../../../common/tenancy/org-scope.js";
import type { TeamScope } from "../../../common/tenancy/team-scope.js";
import { teamWhere } from "../../../common/tenancy/team-where.js";
import { PrismaService } from "../../../shared/prisma/prisma.service.js";

export interface CalendarDay {
  date: string;
  /** ISO weekday: 1 = Monday … 7 = Sunday. */
  weekday: number;
  employee: { id: number; employeeCode: string };
  holidays: Array<{
    id: number;
    name: string;
    scope: "organization" | "location";
    workLocation: { id: number; name: string } | null;
  }>;
  /**
   * EVERY active weekly-off rule that applies to this employee on this date
   * (organization-wide, their location's, their team's), each with whether its
   * weekdays include this date's weekday. The API deliberately does NOT say
   * which scope wins when several apply — that policy is not decided yet, so
   * a caller (Attendance) must not treat "no rule covers the weekday" or "one
   * does" as the final answer without that decision.
   */
  weeklyOffRules: Array<{
    id: number;
    name: string;
    scope: "organization" | "location" | "team";
    daysOfWeek: number[];
    coversWeekday: boolean;
  }>;
}

export function isoWeekday(date: Date): number {
  const d = date.getUTCDay();
  return d === 0 ? 7 : d;
}

@Injectable()
export class CalendarRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Through the caller's employee scope: an employee they may not see is
   * indistinguishable from one that does not exist (`null`). */
  @TeamScoped()
  async dayForVisibleEmployee(
    scope: TeamScope,
    employeeId: number,
    date: Date,
  ) {
    const employee = await this.prisma.employee.findFirst({
      where: teamWhere(scope, { id: employeeId, deletedAt: null }),
      select: {
        id: true,
        employeeCode: true,
        teamId: true,
        workLocationId: true,
      },
    });
    return employee ? this.build(scope.organizationId, employee, date) : null;
  }

  /** For trusted server-side callers only (no own/team/all check). */
  @OrgScoped()
  async dayForEmployee(scope: OrgScope, employeeId: number, date: Date) {
    const employee = await this.prisma.employee.findFirst({
      where: {
        id: employeeId,
        organizationId: scope.organizationId,
        deletedAt: null,
      },
      select: {
        id: true,
        employeeCode: true,
        teamId: true,
        workLocationId: true,
      },
    });
    return employee ? this.build(scope.organizationId, employee, date) : null;
  }

  private async build(
    organizationId: number,
    employee: {
      id: number;
      employeeCode: string;
      teamId: number;
      workLocationId: number | null;
    },
    date: Date,
  ): Promise<CalendarDay> {
    const weekday = isoWeekday(date);
    const locationIs = employee.workLocationId;

    const holidayScopes: Prisma.HolidayWhereInput[] = [
      { workLocationId: null },
    ];
    if (locationIs !== null) holidayScopes.push({ workLocationId: locationIs });
    const holidays = await this.prisma.holiday.findMany({
      where: {
        organizationId,
        deletedAt: null,
        isActive: true,
        holidayDate: date,
        OR: holidayScopes,
      },
      include: { workLocation: { select: { id: true, name: true } } },
      orderBy: { id: "asc" },
    });

    const ruleScopes: Prisma.WeeklyOffRuleWhereInput[] = [
      { workLocationId: null, teamId: null },
      { teamId: employee.teamId },
    ];
    if (locationIs !== null) ruleScopes.push({ workLocationId: locationIs });
    const rules = await this.prisma.weeklyOffRule.findMany({
      where: {
        organizationId,
        deletedAt: null,
        isActive: true,
        effectiveFrom: { lte: date },
        AND: [
          { OR: [{ effectiveTo: null }, { effectiveTo: { gte: date } }] },
          { OR: ruleScopes },
        ],
      },
      orderBy: { id: "asc" },
    });

    return {
      date: formatDateOnly(date),
      weekday,
      employee: { id: employee.id, employeeCode: employee.employeeCode },
      holidays: holidays.map((h) => ({
        id: h.id,
        name: h.name,
        scope: h.workLocationId === null ? "organization" : "location",
        workLocation: h.workLocation,
      })),
      weeklyOffRules: rules.map((r) => ({
        id: r.id,
        name: r.name,
        scope:
          r.teamId !== null
            ? "team"
            : r.workLocationId !== null
              ? "location"
              : "organization",
        daysOfWeek: r.daysOfWeek,
        coversWeekday: r.daysOfWeek.includes(weekday),
      })),
    };
  }
}
