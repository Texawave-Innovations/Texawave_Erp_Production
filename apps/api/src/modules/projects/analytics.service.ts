import { Injectable } from "@nestjs/common";
import { TenantContextService } from "../../platform/tenancy/tenant-context.service.js";
import {
  calculateEarnedAmount,
  calculateProjectHealth,
  calculateResourceUtilization,
} from "./calculations/project-calculations.js";
import { QueryProjectDto } from "./dto/query-project.dto.js";
import type { UpdatePointsConfigDto } from "./dto/update-points-config.dto.js";
import { ProjectsRepository } from "./projects.repository.js";

@Injectable()
export class ProjectsAnalyticsService {
  constructor(
    private readonly repository: ProjectsRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  async getDashboardMetrics() {
    const scope = this.tenantContext.getOrgScope();
    const query = Object.assign(new QueryProjectDto(), {
      page: 1,
      limit: 1000,
    });
    const { items: projects } = await this.repository.findMany(scope, query);

    let activeCount = 0;
    let completedCount = 0;
    let delayedCount = 0;
    let onTrackCount = 0;
    let totalContractPrice = 0;
    let totalActualSpend = 0;
    let totalEarnedRevenue = 0;
    let totalExpectedHours = 0;
    let totalLoggedHours = 0;

    for (const p of projects) {
      const price = Number(p.projectPrice);
      const spend = Number(p.actualCost);
      const expectedH = Number(p.expectedHours);
      const loggedH = p.members.reduce(
        (acc, m) => acc + Number(m.loggedHours),
        0,
      );

      totalContractPrice += price;
      totalActualSpend += spend;
      totalExpectedHours += expectedH;
      totalLoggedHours += loggedH;

      const earned = calculateEarnedAmount(loggedH, price, expectedH);
      totalEarnedRevenue += earned;

      const health = calculateProjectHealth(
        p.milestones.map((m) => ({
          targetDate: m.targetDate,
          status: m.status,
        })),
        p.status === "completed",
      );

      if (p.status === "completed") {
        completedCount++;
      } else {
        activeCount++;
      }

      if (health === "delayed") {
        delayedCount++;
      } else if (health === "on_track") {
        onTrackCount++;
      }
    }

    return {
      totalProjects: projects.length,
      activeProjects: activeCount,
      completedProjects: completedCount,
      delayedProjects: delayedCount,
      onTrackProjects: onTrackCount,
      financials: {
        totalContractPrice,
        totalActualSpend,
        totalEarnedRevenue,
        netProfitVariance:
          Math.round((totalContractPrice - totalActualSpend) * 100) / 100,
      },
      hours: {
        totalExpectedHours,
        totalLoggedHours,
        hoursVariance:
          Math.round((totalExpectedHours - totalLoggedHours) * 100) / 100,
      },
    };
  }

  async getResourceTracking() {
    const scope = this.tenantContext.getOrgScope();
    // Retrieve all active tasks
    const query = Object.assign(new QueryProjectDto(), { page: 1, limit: 500 });
    const { items: projects } = await this.repository.findMany(scope, query);

    const employeeMap = new Map<
      number,
      {
        employeeId: number;
        employeeName: string;
        employeeCode: string;
        activeTasksCount: number;
        loggedHours: number;
        estimatedHours: number;
      }
    >();

    for (const p of projects) {
      for (const m of p.members) {
        if (!employeeMap.has(m.employeeId)) {
          employeeMap.set(m.employeeId, {
            employeeId: m.employeeId,
            employeeName: m.employee.fullName,
            employeeCode: m.employee.employeeCode,
            activeTasksCount: 0,
            loggedHours: 0,
            estimatedHours: 0,
          });
        }
        const record = employeeMap.get(m.employeeId)!;
        record.loggedHours += Number(m.loggedHours);
        record.estimatedHours += Number(m.estimatedHours);
      }
    }

    const leaderboard = await this.repository.getPointsLeaderboard(scope);
    const pointsMap = new Map(
      leaderboard.map((l) => [l.employeeId, l.totalPoints]),
    );

    const resources = Array.from(employeeMap.values()).map((emp) => {
      // 160h standard capacity per month
      const capacityPercent = Math.min(
        100,
        Math.round((emp.loggedHours / 160) * 100),
      );
      return {
        ...emp,
        capacityPercent,
        totalPoints: pointsMap.get(emp.employeeId) ?? 0,
      };
    });

    const activeEngineersCount = resources.length;
    const totalActiveTasks = resources.reduce(
      (acc, r) => acc + r.activeTasksCount,
      0,
    );
    const overallUtilization = calculateResourceUtilization(
      totalActiveTasks,
      activeEngineersCount,
    );

    return {
      activeEngineersCount,
      overallUtilizationPercent: overallUtilization,
      resources,
    };
  }

  async getDepartmentBreakdown() {
    const scope = this.tenantContext.getOrgScope();
    const query = Object.assign(new QueryProjectDto(), {
      page: 1,
      limit: 1000,
    });
    const { items: projects } = await this.repository.findMany(scope, query);

    const deptMap = new Map<
      string,
      {
        department: string;
        projectsCount: number;
        totalContractPrice: number;
        totalActualCost: number;
        expectedHours: number;
        loggedHours: number;
      }
    >();

    for (const p of projects) {
      const dept = p.department || "General";
      if (!deptMap.has(dept)) {
        deptMap.set(dept, {
          department: dept,
          projectsCount: 0,
          totalContractPrice: 0,
          totalActualCost: 0,
          expectedHours: 0,
          loggedHours: 0,
        });
      }
      const record = deptMap.get(dept)!;
      record.projectsCount++;
      record.totalContractPrice += Number(p.projectPrice);
      record.totalActualCost += Number(p.actualCost);
      record.expectedHours += Number(p.expectedHours);
      record.loggedHours += p.members.reduce(
        (sum, m) => sum + Number(m.loggedHours),
        0,
      );
    }

    return Array.from(deptMap.values());
  }

  async getPointsConfig() {
    const scope = this.tenantContext.getOrgScope();
    return this.repository.getPointsConfig(scope);
  }

  async updatePointsConfig(dto: UpdatePointsConfigDto) {
    const scope = this.tenantContext.getOrgScope();
    return this.repository.updatePointsConfig(scope, dto);
  }

  async getPointsLeaderboard() {
    const scope = this.tenantContext.getOrgScope();
    return this.repository.getPointsLeaderboard(scope);
  }
}
