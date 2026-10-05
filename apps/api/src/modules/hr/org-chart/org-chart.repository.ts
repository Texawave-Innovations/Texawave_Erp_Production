import { Injectable } from "@nestjs/common";
import type { Prisma } from "@texawave-erp/database";
import { TeamScoped } from "../../../common/decorators/team-scoped.decorator.js";
import type { TeamScope } from "../../../common/tenancy/team-scope.js";
import { teamWhere } from "../../../common/tenancy/team-where.js";
import { PrismaService } from "../../../shared/prisma/prisma.service.js";
import type { OrgChartMember } from "./org-chart.tree.js";

const NAME_ONLY = { select: { id: true, name: true } } as const;

/** Only the columns the chart shows. Adding a field here is how it reaches
 * the response — nothing else selects columns for the org chart. */
export const ORG_CHART_SELECT = {
  id: true,
  employeeCode: true,
  fullName: true,
  reportsToId: true,
  designation: NAME_ONLY,
  department: NAME_ONLY,
  team: NAME_ONLY,
} satisfies Prisma.EmployeeSelect;

export type OrgChartRow = Prisma.EmployeeGetPayload<{
  select: typeof ORG_CHART_SELECT;
}>;

/** Only place `PrismaService` is called for org-chart reads. Every query is
 * scoped by `teamWhere()`: the organization is always AND-ed in, then the
 * caller's own/team/all level. Only ACTIVE, not-deleted employees appear. */
@Injectable()
export class OrgChartRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Every chart member the caller may see, in one query. Ordered so the
   * result is deterministic before the tree builder sorts it. */
  @TeamScoped()
  findVisibleMembers(
    scope: TeamScope,
    departmentId?: number,
  ): Promise<OrgChartRow[]> {
    return this.prisma.employee.findMany({
      where: teamWhere(scope, {
        deletedAt: null,
        status: "ACTIVE",
        ...(departmentId !== undefined ? { departmentId } : {}),
      }),
      select: ORG_CHART_SELECT,
      orderBy: [{ fullName: "asc" }, { id: "asc" }],
    });
  }

  @TeamScoped()
  findVisibleById(
    scope: TeamScope,
    id: number,
  ): Promise<OrgChartMember | null> {
    return this.prisma.employee.findFirst({
      where: teamWhere(scope, { id, deletedAt: null, status: "ACTIVE" }),
      select: ORG_CHART_SELECT,
    });
  }

  @TeamScoped()
  findVisibleDirectReports(
    scope: TeamScope,
    managerId: number,
  ): Promise<OrgChartRow[]> {
    return this.prisma.employee.findMany({
      where: teamWhere(scope, {
        reportsToId: managerId,
        deletedAt: null,
        status: "ACTIVE",
      }),
      select: ORG_CHART_SELECT,
      orderBy: [{ fullName: "asc" }, { id: "asc" }],
    });
  }

  /** Visible direct-report counts for many managers in ONE grouped query, so
   * a list of N people is never N count queries. */
  @TeamScoped()
  async countVisibleDirectReports(
    scope: TeamScope,
    managerIds: number[],
  ): Promise<Map<number, number>> {
    const counts = new Map<number, number>();
    if (managerIds.length === 0) return counts;
    const groups = await this.prisma.employee.groupBy({
      by: ["reportsToId"],
      where: teamWhere(scope, {
        reportsToId: { in: managerIds },
        deletedAt: null,
        status: "ACTIVE",
      }),
      _count: { _all: true },
    });
    for (const g of groups) {
      if (g.reportsToId !== null) counts.set(g.reportsToId, g._count._all);
    }
    return counts;
  }
}
