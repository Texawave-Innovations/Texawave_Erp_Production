import { Injectable } from "@nestjs/common";
import { PaginatedResponseDto } from "../../common/dto/paginated-response.dto.js";
import {
  BusinessRuleViolationException,
  ResourceNotFoundException,
} from "../../common/exceptions/business.exception.js";
import { TenantContextService } from "../../platform/tenancy/tenant-context.service.js";
import {
  calculateBudgetUtilization,
  calculateEarnedAmount,
  calculateProjectHealth,
} from "./calculations/project-calculations.js";
import type { AddProjectMemberDto } from "./dto/add-project-member.dto.js";
import type { CreateProjectDto } from "./dto/create-project.dto.js";
import type { QueryProjectDto } from "./dto/query-project.dto.js";
import type { UpdateProjectDto } from "./dto/update-project.dto.js";
import { ProjectsRepository } from "./projects.repository.js";

@Injectable()
export class ProjectsService {
  constructor(
    private readonly repository: ProjectsRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  async findAll(query: QueryProjectDto) {
    const scope = this.tenantContext.getOrgScope();
    const { items, total } = await this.repository.findMany(scope, query);

    const enrichedItems = items.map((p) => {
      const health = calculateProjectHealth(
        p.milestones.map((m) => ({
          targetDate: m.targetDate,
          status: m.status,
        })),
        p.status === "completed",
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
    const project = await this.repository.create(scope, dto, userId);
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
