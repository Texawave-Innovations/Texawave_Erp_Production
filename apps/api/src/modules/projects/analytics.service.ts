import { Injectable } from "@nestjs/common";
import { TenantContextService } from "../../platform/tenancy/tenant-context.service.js";
import {
  DEFAULT_UPCOMING_MILESTONE_DAYS,
  calculateEarnedAmount,
  calculateProjectHealth,
  calculateResourceUtilization,
} from "./calculations/project-calculations.js";
import type { UpdatePointsConfigDto } from "./dto/update-points-config.dto.js";
import { ProjectsRepository } from "./projects.repository.js";

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

@Injectable()
export class ProjectsAnalyticsService {
  constructor(
    private readonly repository: ProjectsRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  /** Org-wide KPIs over EVERY live project. Uses the non-paginated
   * `findAllForAnalytics` read — the previous version summarised only the
   * first 1000 rows, and the Analytics page topped up from a 100-row list. */
  async getDashboardMetrics() {
    const scope = this.tenantContext.getOrgScope();
    const projects = await this.repository.findAllForAnalytics(scope);
    const today = new Date();
    const todayIso = isoDay(today);
    const windowEnd = new Date(todayIso + "T00:00:00.000Z");
    windowEnd.setUTCDate(
      windowEnd.getUTCDate() + DEFAULT_UPCOMING_MILESTONE_DAYS,
    );
    const windowEndIso = isoDay(windowEnd);

    let activeCount = 0;
    let completedCount = 0;
    let delayedCount = 0;
    let onTrackCount = 0;
    let totalContractPrice = 0;
    let totalActualSpend = 0;
    let totalEarnedRevenue = 0;
    let totalExpectedHours = 0;
    let totalLoggedHours = 0;
    let upcomingMilestonesCount = 0;
    let openTasksCount = 0;
    let overHoursProjects = 0;
    let overBudgetProjects = 0;
    // Legacy `ProjectAnalytics.tsx` "Milestone Health" diagnostics.
    const milestoneHealth = {
      onTrack: 0,
      delayed: 0,
      completed: 0,
      onTimeCompleted: 0,
      total: 0,
    };

    // legacy `ProjectsDashboard.tsx` "Health & Deliverable Signals" — status
    // breakdown by count + contract value, clickable into the filtered list.
    const statusBreakdown: Record<
      string,
      { status: string; count: number; totalValue: number }
    > = {
      active: { status: "active", count: 0, totalValue: 0 },
      on_hold: { status: "on_hold", count: 0, totalValue: 0 },
      completed: { status: "completed", count: 0, totalValue: 0 },
      cancelled: { status: "cancelled", count: 0, totalValue: 0 },
    };

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
      totalEarnedRevenue += calculateEarnedAmount(loggedH, price, expectedH);
      if (expectedH > 0 && loggedH > expectedH) overHoursProjects++;
      if (price > 0 && spend > price) overBudgetProjects++;

      const health = calculateProjectHealth(
        p.milestones,
        p.status === "completed",
        today,
      );

      if (p.status === "completed") completedCount++;
      else activeCount++;

      if (health === "delayed") delayedCount++;
      else if (health === "on_track") onTrackCount++;

      const bucket = statusBreakdown[p.status];
      if (bucket) {
        bucket.count++;
        bucket.totalValue += price;
      }

      for (const m of p.milestones) {
        const target = isoDay(m.targetDate);
        milestoneHealth.total++;
        if (m.status === "completed") {
          milestoneHealth.completed++;
          if (!m.actualDate || isoDay(m.actualDate) <= target) {
            milestoneHealth.onTimeCompleted++;
          }
        } else if (target < todayIso) {
          milestoneHealth.delayed++;
        } else {
          milestoneHealth.onTrack++;
          if (target <= windowEndIso) upcomingMilestonesCount++;
        }
      }
      openTasksCount += p.tasks.filter((t) => t.status !== "completed").length;
    }

    const overallBudgetUtilizationPercent =
      totalContractPrice > 0
        ? Math.round((totalActualSpend / totalContractPrice) * 100)
        : 0;

    return {
      totalProjects: projects.length,
      activeProjects: activeCount,
      completedProjects: completedCount,
      delayedProjects: delayedCount,
      onTrackProjects: onTrackCount,
      upcomingMilestonesCount,
      openTasksCount,
      overHoursProjects,
      overBudgetProjects,
      milestoneHealth,
      statusBreakdown: Object.values(statusBreakdown),
      financials: {
        totalContractPrice,
        totalActualSpend,
        totalEarnedRevenue,
        overallBudgetUtilizationPercent,
        budgetVariance:
          Math.round((totalEarnedRevenue - totalActualSpend) * 100) / 100,
      },
      hours: {
        totalExpectedHours,
        totalLoggedHours,
        hoursVariance:
          Math.round((totalExpectedHours - totalLoggedHours) * 100) / 100,
      },
    };
  }

  /** Per-employee capacity over every live project, including the
   * employee's HR department/designation (legacy Resources/Analytics showed
   * and filtered by department) and the projects they are on. */
  async getResourceTracking() {
    const scope = this.tenantContext.getOrgScope();
    const [projects, pointsMap] = await Promise.all([
      this.repository.findAllForAnalytics(scope),
      this.repository.sumPointsByEmployee(scope),
    ]);

    const BASE_CAPACITY_HOURS = 160;

    type ProjectRef = { id: number; projectCode: string; name: string };
    const employeeMap = new Map<
      number,
      {
        employeeId: number;
        employeeName: string;
        employeeCode: string;
        department: string | null;
        designation: string | null;
        activeTasksCount: number;
        loggedHours: number;
        estimatedHours: number;
        projects: Map<number, ProjectRef>;
      }
    >();

    for (const p of projects) {
      const ref: ProjectRef = {
        id: p.id,
        projectCode: p.projectCode,
        name: p.name,
      };
      for (const m of p.members) {
        let record = employeeMap.get(m.employeeId);
        if (!record) {
          record = {
            employeeId: m.employeeId,
            employeeName: m.employee.fullName,
            employeeCode: m.employee.employeeCode,
            department: m.employee.department?.name ?? null,
            designation: m.employee.designation?.name ?? null,
            activeTasksCount: 0,
            loggedHours: 0,
            estimatedHours: 0,
            projects: new Map(),
          };
          employeeMap.set(m.employeeId, record);
        }
        record.loggedHours += Number(m.loggedHours);
        record.estimatedHours += Number(m.estimatedHours);
        record.projects.set(p.id, ref);
      }

      for (const t of p.tasks) {
        if (!t.assignedToId) continue;
        const record = employeeMap.get(t.assignedToId);
        if (!record) continue;
        record.projects.set(p.id, ref);
        if (t.status !== "completed") record.activeTasksCount++;
      }
    }

    const resources = Array.from(employeeMap.values()).map((emp) => {
      const utilizationPercent = Math.min(
        100,
        Math.round((emp.loggedHours / BASE_CAPACITY_HOURS) * 100),
      );
      const status: "NORMAL" | "OVER_CAPACITY" | "UNDER_UTILIZED" =
        emp.loggedHours > BASE_CAPACITY_HOURS
          ? "OVER_CAPACITY"
          : emp.loggedHours < BASE_CAPACITY_HOURS * 0.5
            ? "UNDER_UTILIZED"
            : "NORMAL";
      const assigned = Array.from(emp.projects.values());
      return {
        employeeId: emp.employeeId,
        employeeName: emp.employeeName,
        employeeCode: emp.employeeCode,
        department: emp.department,
        designation: emp.designation,
        activeTasksCount: emp.activeTasksCount,
        loggedHours: emp.loggedHours,
        estimatedHours: emp.estimatedHours,
        baseCapacityHours: BASE_CAPACITY_HOURS,
        utilizationPercent,
        status,
        assignedProjectsCount: assigned.length,
        projects: assigned,
        totalPoints: pointsMap.get(emp.employeeId) ?? 0,
      };
    });

    const activeEngineersCount = resources.length;
    const totalActiveTasks = resources.reduce(
      (acc, r) => acc + r.activeTasksCount,
      0,
    );

    return {
      activeEngineersCount,
      overallUtilizationPercent: calculateResourceUtilization(
        totalActiveTasks,
        activeEngineersCount,
      ),
      departments: Array.from(
        new Set(
          resources
            .map((r) => r.department)
            .filter((d): d is string => Boolean(d)),
        ),
      ).sort(),
      resources,
    };
  }

  async getDepartmentBreakdown() {
    const scope = this.tenantContext.getOrgScope();
    const projects = await this.repository.findAllForAnalytics(scope);

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
      // A multi-department project contributes its full totals to every
      // department it spans (matches legacy ProjectForm multi-select UX —
      // not split/divided across departments).
      const depts = p.departments.length > 0 ? p.departments : ["General"];
      for (const dept of depts) {
        let record = deptMap.get(dept);
        if (!record) {
          record = {
            department: dept,
            projectsCount: 0,
            totalContractPrice: 0,
            totalActualCost: 0,
            expectedHours: 0,
            loggedHours: 0,
          };
          deptMap.set(dept, record);
        }
        record.projectsCount++;
        record.totalContractPrice += Number(p.projectPrice);
        record.totalActualCost += Number(p.actualCost);
        record.expectedHours += Number(p.expectedHours);
        record.loggedHours += p.members.reduce(
          (sum, m) => sum + Number(m.loggedHours),
          0,
        );
      }
    }

    return Array.from(deptMap.values()).map((d) => ({
      ...d,
      budgetUtilizationPercent:
        d.totalContractPrice > 0
          ? Math.round((d.totalActualCost / d.totalContractPrice) * 100)
          : 0,
    }));
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
