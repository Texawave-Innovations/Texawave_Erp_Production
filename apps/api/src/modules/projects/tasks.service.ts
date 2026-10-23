import { Injectable } from "@nestjs/common";
import { TaskStatus } from "@texawave-erp/database";
import {
  BusinessRuleViolationException,
  ResourceNotFoundException,
} from "../../common/exceptions/business.exception.js";
import { TenantContextService } from "../../platform/tenancy/tenant-context.service.js";
import { EmployeeQueryService } from "../hr/employees/employee-query.service.js";
import {
  calculateBusinessHours,
  hasCircularDependency,
} from "./calculations/project-calculations.js";
import type { CreateTaskDto, UpdateTaskDto } from "./dto/create-task.dto.js";
import { ProjectsRepository } from "./projects.repository.js";

@Injectable()
export class TasksService {
  constructor(
    private readonly repository: ProjectsRepository,
    private readonly tenantContext: TenantContextService,
    private readonly employeeQuery: EmployeeQueryService,
  ) {}

  async findTasks(projectId: number) {
    const scope = this.tenantContext.getOrgScope();
    const project = await this.repository.findOne(scope, projectId);
    if (!project) {
      throw new ResourceNotFoundException("Project", projectId);
    }
    return this.repository.findTasks(scope, projectId);
  }

  async findTaskById(taskId: number) {
    const scope = this.tenantContext.getOrgScope();
    const task = await this.repository.findTaskById(scope, taskId);
    if (!task) {
      throw new ResourceNotFoundException("Task", taskId);
    }
    return task;
  }

  async findMyWork() {
    const scope = this.tenantContext.getOrgScope();
    const employee = await this.employeeQuery.findCurrentEmployeeOrNull();
    if (!employee) {
      return [];
    }
    return this.repository.findMyTasks(scope, employee.id);
  }

  async createTask(projectId: number, dto: CreateTaskDto) {
    const scope = this.tenantContext.getOrgScope();
    const project = await this.repository.findOne(scope, projectId);
    if (!project) {
      throw new ResourceNotFoundException("Project", projectId);
    }

    if (new Date(dto.endDate) < new Date(dto.startDate)) {
      throw new BusinessRuleViolationException(
        "Task end date cannot be earlier than start date",
        "INVALID_DATE_SPAN",
      );
    }

    // Verify dependency task exists and does not cause a cycle
    if (dto.dependencyTaskId) {
      const existingTasks = await this.repository.findTasks(scope, projectId);
      const depTask = existingTasks.find((t) => t.id === dto.dependencyTaskId);
      if (!depTask) {
        throw new ResourceNotFoundException(
          "Dependency Task",
          dto.dependencyTaskId,
        );
      }
      if (hasCircularDependency(existingTasks, -1, dto.dependencyTaskId)) {
        throw new BusinessRuleViolationException(
          "Circular dependency detected in task prerequisites",
          "CYCLIC_DEPENDENCY_DETECTED",
        );
      }
    }

    // Compute business hours if not manually overridden
    const hoursToComplete =
      dto.hoursToComplete !== undefined
        ? dto.hoursToComplete
        : calculateBusinessHours(dto.startDate, dto.endDate);

    // Compute default points from config if not passed
    let points = dto.points;
    if (points === undefined) {
      const config = await this.repository.getPointsConfig(scope);
      const priority = dto.priority ?? "medium";
      const configPoints = (config as Record<string, unknown>)[priority];
      points = typeof configPoints === "number" ? configPoints : 10;
    }

    const userId = this.tenantContext.getUserId();
    return this.repository.createTask(
      scope,
      projectId,
      dto,
      hoursToComplete,
      points ?? 10,
      userId,
    );
  }

  async updateTask(taskId: number, dto: UpdateTaskDto) {
    const scope = this.tenantContext.getOrgScope();
    const existing = await this.repository.findTaskById(scope, taskId);
    if (!existing) {
      throw new ResourceNotFoundException("Task", taskId);
    }

    // Check date bounds
    const startDate = dto.startDate
      ? new Date(dto.startDate)
      : existing.startDate;
    const endDate = dto.endDate ? new Date(dto.endDate) : existing.endDate;
    if (endDate < startDate) {
      throw new BusinessRuleViolationException(
        "Task end date cannot be earlier than start date",
        "INVALID_DATE_SPAN",
      );
    }

    // Check circular dependencies if dependency changed
    if (
      dto.dependencyTaskId !== undefined &&
      dto.dependencyTaskId !== existing.dependencyTaskId
    ) {
      if (dto.dependencyTaskId) {
        const allTasks = await this.repository.findTasks(
          scope,
          existing.projectId,
        );
        if (hasCircularDependency(allTasks, taskId, dto.dependencyTaskId)) {
          throw new BusinessRuleViolationException(
            "Circular dependency detected in task prerequisites",
            "CYCLIC_DEPENDENCY_DETECTED",
          );
        }
      }
    }

    // Recompute business hours if dates changed and hours not explicitly specified
    let computedHours: number | undefined;
    if ((dto.startDate || dto.endDate) && dto.hoursToComplete === undefined) {
      computedHours = calculateBusinessHours(startDate, endDate);
    } else if (dto.hoursToComplete !== undefined) {
      computedHours = dto.hoursToComplete;
    }

    // Gamification check: if status transitioned to completed or completionPercent reached 100%
    const isNowCompleted =
      dto.status === TaskStatus.completed || dto.completionPercent === 100;
    const wasCompleted =
      existing.status === TaskStatus.completed ||
      existing.completionPercent === 100;

    const payload: UpdateTaskDto = { ...dto };
    if (isNowCompleted && !wasCompleted) {
      payload.status = TaskStatus.completed;
      payload.completionPercent = 100;
      if (!payload.actualEndDate) {
        payload.actualEndDate = new Date().toISOString().slice(0, 10);
      }

      // Award gamification points to the assigned employee if assigned
      const targetEmpId = payload.assignedToId ?? existing.assignedToId;
      if (targetEmpId) {
        const pointsAwarded = payload.points ?? existing.points;
        await this.repository.awardPoints(
          scope,
          targetEmpId,
          taskId,
          payload.title ?? existing.title,
          pointsAwarded,
          `Completed ${existing.taskCode} (${existing.priority} priority)`,
        );
      }
    }

    const userId = this.tenantContext.getUserId();
    const updated = await this.repository.updateTask(
      scope,
      taskId,
      payload,
      computedHours,
      userId,
    );
    if (!updated) {
      throw new ResourceNotFoundException("Task", taskId);
    }
    return updated;
  }

  async softDeleteTask(taskId: number) {
    const scope = this.tenantContext.getOrgScope();
    const existing = await this.repository.findTaskById(scope, taskId);
    if (!existing) {
      throw new ResourceNotFoundException("Task", taskId);
    }
    const userId = this.tenantContext.getUserId();
    await this.repository.softDeleteTask(scope, taskId, userId);
    return { success: true };
  }
}
