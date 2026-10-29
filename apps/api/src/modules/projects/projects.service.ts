import { Injectable } from "@nestjs/common";
import { PaginatedResponseDto } from "../../common/dto/paginated-response.dto.js";
import {
  BusinessRuleViolationException,
  ResourceNotFoundException,
} from "../../common/exceptions/business.exception.js";
import { TenantContextService } from "../../platform/tenancy/tenant-context.service.js";
import {
  DEFAULT_UPCOMING_MILESTONE_DAYS,
  calculateBudgetUtilization,
  calculateEarnedAmount,
  calculateProjectHealth,
} from "./calculations/project-calculations.js";
import type { AddProjectMemberDto } from "./dto/add-project-member.dto.js";
import type { CreateProjectDto } from "./dto/create-project.dto.js";
import type {
  ProjectHealthFilter,
  QueryProjectDto,
} from "./dto/query-project.dto.js";
import type { UpdateProjectDto } from "./dto/update-project.dto.js";
import { ProjectsRepository } from "./projects.repository.js";
import { ProjectCodeMasterService } from "../projects-master/project-code-master.service.js";
import { financialYearLabel } from "./sequences/project-sequences.js";

@Injectable()
export class ProjectsService {
  constructor(
    private readonly repository: ProjectsRepository,
    private readonly tenantContext: TenantContextService,
    private readonly codeMaster: ProjectCodeMasterService,
  ) {}

  async findAll(query: QueryProjectDto) {
    const scope = this.tenantContext.getOrgScope();
    // Health is computed, not stored: resolve the matching ids over the
    // whole organization first, then page through them normally.
    const healthIds = query.health
      ? await this.projectIdsByHealth(query.health)
      : undefined;
    const { items, total } = await this.repository.findMany(
      scope,
      query,
      healthIds,
    );

    const enrichedItems = items.map((p) => {
      const health = calculateProjectHealth(
        p.milestones.map((m) => ({
          targetDate: m.targetDate,
          status: m.status,
        })),
        p.status === "completed",
        new Date(),
      );
      const totalLogged = p.members.reduce(
        (sum, m) => sum + Number(m.loggedHours),
        0,
      );
      const earnedAmount = calculateEarnedAmount(
        totalLogged,
        Number(p.projectPrice),
        Number(p.expectedHours),
      );
      const budget = calculateBudgetUtilization(
        Number(p.actualCost),
        Number(p.projectPrice),
      );

      const totalTasks = p.tasks?.length ?? 0;
      const completedTasks =
        p.tasks?.filter((t) => t.status === "completed").length ?? 0;
      const progressPercent =
        totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

      return {
        ...p,
        health,
        progressPercent,
        totalLoggedHours: totalLogged,
        earnedAmount,
        budgetUtilization: budget.utilizationPercent,
        budgetVariance: budget.variance,
        isUnderBudget: budget.isUnderBudget,
      };
    });

    return new PaginatedResponseDto(
      enrichedItems,
      total,
      query.page,
      query.limit,
    );
  }

  private async projectIdsByHealth(
    health: ProjectHealthFilter,
  ): Promise<number[]> {
    const scope = this.tenantContext.getOrgScope();
    const projects = await this.repository.findAllForAnalytics(scope);
    const today = new Date();
    const todayIso = today.toISOString().slice(0, 10);
    const windowEnd = new Date(todayIso + "T00:00:00.000Z");
    windowEnd.setUTCDate(
      windowEnd.getUTCDate() + DEFAULT_UPCOMING_MILESTONE_DAYS,
    );
    const windowEndIso = windowEnd.toISOString().slice(0, 10);
    return projects
      .filter((p) => {
        if (health === "upcoming") {
          return p.milestones.some((m) => {
            const d = m.targetDate.toISOString().slice(0, 10);
            return (
              m.status !== "completed" && d >= todayIso && d <= windowEndIso
            );
          });
        }
        return (
          calculateProjectHealth(
            p.milestones,
            p.status === "completed",
            today,
          ) === health
        );
      })
      .map((p) => p.id);
  }

  async findOne(id: number) {
    const scope = this.tenantContext.getOrgScope();
    const project = await this.repository.findOne(scope, id);
    if (!project) {
      throw new ResourceNotFoundException("Project", id);
    }

    const health = calculateProjectHealth(
      project.milestones.map((m) => ({
        targetDate: m.targetDate,
        status: m.status,
      })),
      project.status === "completed",
      new Date(),
    );
    const totalLogged = project.members.reduce(
      (sum, m) => sum + Number(m.loggedHours),
      0,
    );
    const earnedAmount = calculateEarnedAmount(
      totalLogged,
      Number(project.projectPrice),
      Number(project.expectedHours),
    );
    const budget = calculateBudgetUtilization(
      Number(project.actualCost),
      Number(project.projectPrice),
    );

    const totalTasks = project.tasks?.length ?? 0;
    const completedTasks =
      project.tasks?.filter((t) => t.status === "completed").length ?? 0;
    const progressPercent =
      totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    return {
      ...project,
      health,
      progressPercent,
      totalLoggedHours: totalLogged,
      earnedAmount,
      budgetUtilization: budget.utilizationPercent,
      budgetVariance: budget.variance,
      isUnderBudget: budget.isUnderBudget,
    };
  }

  async create(dto: CreateProjectDto) {
    if (
      dto.plannedEndDate &&
      new Date(dto.plannedEndDate) < new Date(dto.startDate)
    ) {
      throw new BusinessRuleViolationException(
        "Planned end date cannot be earlier than start date",
        "INVALID_DATE_SPAN",
      );
    }

    const scope = this.tenantContext.getOrgScope();
    const userId = this.tenantContext.getUserId();
    // Legacy format `TXW/PRJ/<type>/<FY>/<seq>` from the Project Code Master;
    // the FY label follows the project's start date unless the master pins one.
    const cfg = await this.codeMaster.findOne();
    const project = await this.repository.create(scope, dto, userId, {
      companyPrefix: cfg.companyPrefix,
      moduleIdentifier: cfg.moduleIdentifier,
      typeCode: dto.projectType?.trim() || cfg.defaultProjectCode || null,
      financialYear:
        cfg.financialYear?.trim() ||
        financialYearLabel(new Date(dto.startDate)),
      sequenceDigits: cfg.sequenceDigits,
    });
    return this.findOne(project.id);
  }

  async update(id: number, dto: UpdateProjectDto) {
    const scope = this.tenantContext.getOrgScope();
    const existing = await this.repository.findOne(scope, id);
    if (!existing) {
      throw new ResourceNotFoundException("Project", id);
    }

    const startDate = dto.startDate
      ? new Date(dto.startDate)
      : existing.startDate;
    const plannedEndDate =
      dto.plannedEndDate !== undefined
        ? dto.plannedEndDate
          ? new Date(dto.plannedEndDate)
          : null
        : existing.plannedEndDate;

    if (plannedEndDate && plannedEndDate < startDate) {
      throw new BusinessRuleViolationException(
        "Planned end date cannot be earlier than start date",
        "INVALID_DATE_SPAN",
      );
    }

    const userId = this.tenantContext.getUserId();
    const updated = await this.repository.update(scope, id, dto, userId);
    if (!updated) {
      throw new ResourceNotFoundException("Project", id);
    }
    return this.findOne(id);
  }

  async softDelete(id: number) {
    const scope = this.tenantContext.getOrgScope();
    const existing = await this.repository.findOne(scope, id);
    if (!existing) {
      throw new ResourceNotFoundException("Project", id);
    }

    const userId = this.tenantContext.getUserId();
    await this.repository.softDelete(scope, id, userId);
    return {
      success: true,
      message: `Project ${existing.projectCode} deleted successfully`,
    };
  }

  // ---------------------------------------------------------------------------
  // Member Management
  // ---------------------------------------------------------------------------

  async addMember(projectId: number, dto: AddProjectMemberDto) {
    const scope = this.tenantContext.getOrgScope();
    const project = await this.repository.findOne(scope, projectId);
    if (!project) {
      throw new ResourceNotFoundException("Project", projectId);
    }

    return this.repository.addMember(scope, projectId, dto);
  }

  async removeMember(projectId: number, employeeId: number) {
    const scope = this.tenantContext.getOrgScope();
    const project = await this.repository.findOne(scope, projectId);
    if (!project) {
      throw new ResourceNotFoundException("Project", projectId);
    }

    const removed = await this.repository.removeMember(
      scope,
      projectId,
      employeeId,
    );
    if (!removed) {
      throw new ResourceNotFoundException("ProjectMember", employeeId);
    }
    return { success: true };
  }

  async getBudgetUtilization(projectId: number) {
    const project = await this.findOne(projectId);
    return {
      projectId: project.id,
      projectCode: project.projectCode,
      name: project.name,
      projectPrice: Number(project.projectPrice),
      actualCost: Number(project.actualCost),
      expectedHours: Number(project.expectedHours),
      totalLoggedHours: project.totalLoggedHours,
      earnedAmount: project.earnedAmount,
      budgetUtilizationPercent: project.budgetUtilization,
      variance: project.budgetVariance,
      budgetVariance: project.budgetVariance,
      isUnderBudget: project.isUnderBudget,
    };
  }
}
