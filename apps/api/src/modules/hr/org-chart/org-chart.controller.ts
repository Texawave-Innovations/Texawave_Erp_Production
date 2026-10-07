import { Controller, Get, Param, ParseIntPipe, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { RequireScopedPermission } from "../../../common/decorators/require-permission.decorator.js";
import { QueryOrgChartDto } from "./dto/query-org-chart.dto.js";
import { OrgChartService } from "./org-chart.service.js";

/** Read-only. Governed by `hr.employee.read` (own/team/all): the service
 * narrows the people returned to the caller's scope. No write, no audit row —
 * the response carries name, code, designation, department and team only. */
@ApiTags("hr-org-chart")
@Controller("hr")
export class OrgChartController {
  constructor(private readonly orgChart: OrgChartService) {}

  @Get("org-chart")
  @RequireScopedPermission("hr.employee.read")
  @ApiOperation({
    summary:
      "Reporting tree of the caller's visible employees (optionally one department or one subtree)",
  })
  getChart(@Query() query: QueryOrgChartDto) {
    return this.orgChart.getChart(query);
  }

  @Get("employees/:id/direct-reports")
  @RequireScopedPermission("hr.employee.read")
  @ApiOperation({ summary: "Direct reports of one employee, within scope" })
  directReports(@Param("id", ParseIntPipe) id: number) {
    return this.orgChart.directReports(id);
  }
}
