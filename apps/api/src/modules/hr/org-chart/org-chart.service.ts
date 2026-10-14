import { Injectable } from "@nestjs/common";
import { ResourceNotFoundException } from "../../../common/exceptions/business.exception.js";
import { TeamContextService } from "../../../platform/tenancy/team-context.service.js";
import type { QueryOrgChartDto } from "./dto/query-org-chart.dto.js";
import { ORG_CHART_DEFAULT_DEPTH } from "./dto/query-org-chart.dto.js";
import {
  OrgChartRepository,
  type OrgChartRow,
} from "./org-chart.repository.js";
import {
  buildOrgChart,
  directReportsOf,
  type OrgChartMember,
} from "./org-chart.tree.js";

/** The permission that already governs the employee list and detail. The
 * chart is a read of the same records, so it adds no permission of its own. */
const READ = "hr.employee.read";

const toMember = (row: OrgChartRow): OrgChartMember => ({
  id: row.id,
  employeeCode: row.employeeCode,
  fullName: row.fullName,
  reportsToId: row.reportsToId,
  designation: row.designation,
  department: row.department,
  team: row.team,
});

@Injectable()
export class OrgChartService {
  constructor(
    private readonly repository: OrgChartRepository,
    private readonly teamContext: TeamContextService,
  ) {}

  /** Nested forest of the caller's visible employees. An empty organization
   * (or a scope that sees nobody) returns `[]`, not an error. */
  async getChart(query: QueryOrgChartDto) {
    const scope = await this.teamContext.resolveScope(READ);
    const rows = await this.repository.findVisibleMembers(
      scope,
      query.departmentId,
    );
    const members = rows.map(toMember);

    // 404 — not 403 — when the root is outside the caller's scope, so the
    // existence of someone the caller may not see is not disclosed.
    if (
      query.rootEmployeeId !== undefined &&
      !members.some((m) => m.id === query.rootEmployeeId)
    ) {
      throw new ResourceNotFoundException("Employee", query.rootEmployeeId);
    }

    return buildOrgChart(members, {
      ...(query.rootEmployeeId !== undefined
        ? { rootEmployeeId: query.rootEmployeeId }
        : {}),
      depth: query.depth ?? ORG_CHART_DEFAULT_DEPTH,
    });
  }

  /** The people who report directly to `employeeId`, as the caller can see
   * them. 404 when the manager is outside the caller's scope. */
  async directReports(employeeId: number) {
    const scope = await this.teamContext.resolveScope(READ);
    if (!(await this.repository.findVisibleById(scope, employeeId))) {
      throw new ResourceNotFoundException("Employee", employeeId);
    }
    const reports = await this.repository.findVisibleDirectReports(
      scope,
      employeeId,
    );
    const counts = await this.repository.countVisibleDirectReports(
      scope,
      reports.map((r) => r.id),
    );
    return directReportsOf(reports.map(toMember), employeeId, counts);
  }
}
