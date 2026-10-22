import { Body, Controller, Get, Patch } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { RequirePermission } from "../../common/decorators/require-permission.decorator.js";
import { ProjectsAnalyticsService } from "./analytics.service.js";
import { UpdatePointsConfigDto } from "./dto/update-points-config.dto.js";

@ApiTags("Project Analytics & Gamification")
@ApiBearerAuth()
@Controller("projects")
export class ProjectsAnalyticsController {
  constructor(private readonly service: ProjectsAnalyticsService) {}

  @Get("dashboard/metrics")
  @RequirePermission("projects.project.read")
  @ApiOperation({
    summary:
      "Get executive dashboard KPIs, project health metrics, and financial progress",
  })
  getDashboardMetrics() {
    return this.service.getDashboardMetrics();
  }

  @Get("analytics/dashboard")
  @RequirePermission("projects.project.read")
  @ApiOperation({ summary: "Get executive dashboard KPIs (alias)" })
  getAnalyticsDashboard() {
    return this.service.getDashboardMetrics();
  }

  @Get("analytics/resources")
  @RequirePermission("projects.project.read")
  @ApiOperation({
    summary:
      "Get team resource tracking, capacity allocation (160h base), and utilization",
  })
  getResourceTracking() {
    return this.service.getResourceTracking();
  }

  @Get("analytics/department-breakdown")
  @RequirePermission("projects.project.read")
  @ApiOperation({
    summary: "Get project distribution and spend grouped by department",
  })
  getDepartmentBreakdown() {
    return this.service.getDepartmentBreakdown();
  }

  @Get("points/config")
  @RequirePermission("projects.project.read")
  @ApiOperation({
    summary:
      "Get gamification points rules for low, medium, high, and urgent priorities",
  })
  getPointsConfig() {
    return this.service.getPointsConfig();
  }

  @Get("analytics/points/config")
  @RequirePermission("projects.project.read")
  @ApiOperation({ summary: "Get gamification points rules (alias)" })
  getAnalyticsPointsConfig() {
    return this.service.getPointsConfig();
  }

  @Patch("points/config")
  @RequirePermission("projects.points.manage")
  @ApiOperation({ summary: "Update gamification points rules" })
  updatePointsConfig(@Body() dto: UpdatePointsConfigDto) {
    return this.service.updatePointsConfig(dto);
  }

  @Get("points/leaderboard")
  @RequirePermission("projects.project.read")
  @ApiOperation({
    summary:
      "Get gamification leaderboard with employee points and completed tasks count",
  })
  getPointsLeaderboard() {
    return this.service.getPointsLeaderboard();
  }

  @Get("analytics/points/leaderboard")
  @RequirePermission("projects.project.read")
  @ApiOperation({ summary: "Get gamification leaderboard (alias)" })
  getAnalyticsPointsLeaderboard() {
    return this.service.getPointsLeaderboard();
  }
}
