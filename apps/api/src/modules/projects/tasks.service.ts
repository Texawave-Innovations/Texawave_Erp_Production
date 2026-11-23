import { Injectable } from "@nestjs/common";
import { TaskStatus } from "@texawave-erp/database";
import {
  BusinessRuleConflictException,
  BusinessRuleViolationException,
  ResourceNotFoundException,
} from "../../common/exceptions/business.exception.js";
import { businessToday } from "../../common/dates/business-date.js";
import { TenantContextService } from "../../platform/tenancy/tenant-context.service.js";
import { EmployeeQueryService } from "../hr/employees/employee-query.service.js";
import { hasCircularDependency } from "./calculations/project-calculations.js";
import type { CreateTaskDto, UpdateTaskDto } from "./dto/create-task.dto.js";
import {
  assertManagerStatusChange,
  isCompletionTransition,
  type TaskStatus as LifecycleTaskStatus,
} from "../timesheets/timesheets.rules.js";
import { ProjectsRepository } from "./projects.repository.js";
import { ProjectsWriteAccessService } from "./projects-write-access.service.js";
import { TaskRunningNumberMasterService } from "../projects-master/task-running-number-master.service.js";

@Injectable()
export class TasksService {
  constructor(
    private readonly repository: ProjectsRepository,
    private readonly tenantContext: TenantContextService,
    private readonly employeeQuery: EmployeeQueryService,
    private readonly taskNumberMaster: TaskRunningNumberMasterService,
    private readonly writeAccess: ProjectsWriteAccessService,
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

  /** The task's status history (oldest first) for the timesheet day history. */
  async findStatusEvents(taskId: number) {
    const scope = this.tenantContext.getOrgScope();
    return this.repository.findTaskStatusEvents(scope, taskId);
  }

  async findMyWork() {
    const scope = this.tenantContext.getOrgScope();
    const employee = await this.employeeQuery.findCurrentEmployeeOrNull();
    if (!employee) {
      return [];
    }
    return this.repository.findMyTasks(scope, employee.id);
  }

  /** The current employee's own awards (newest first) with the breakdown
   * of each, for the My Work points panel. */
  async findMyPoints() {
    const scope = this.tenantContext.getOrgScope();
    const employee = await this.employeeQuery.findCurrentEmployeeOrNull();
    if (!employee) return [];
    return this.repository.findEmployeePointsAwards(scope, employee.id);
  }

  async createTask(projectId: number, dto: CreateTaskDto) {
    const scope = this.tenantContext.getOrgScope();
    const project = await this.repository.findOne(scope, projectId);
    if (!project) {
      throw new ResourceNotFoundException("Project", projectId);
    }
    // A team lead may only create tasks for an employee of their own team.
    await this.writeAccess.assertAssignee(
      await this.writeAccess.resolve(),
      dto.assignedToId,
    );

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

    // The ETA is a manual entry (validated by the DTO), never derived from the
    // dates: reward points are measured against it.
    const hoursToComplete = dto.hoursToComplete;

    // Points of the task. With time-based points on, every task is worth the
    // same configured value (priority and a typed value do not decide it);
    // otherwise the legacy rule: typed, else the priority value.
    const config = await this.repository.getPointsConfig(scope);
    let points = dto.points;
    if (config.timeBasedEnabled) {
      points = config.defaultTaskPoints;
    } else if (points === undefined) {
      const priority = dto.priority ?? "medium";
      const configPoints = (config as Record<string, unknown>)[priority];
      points = typeof configPoints === "number" ? configPoints : 10;
    }

    const userId = this.tenantContext.getUserId();
    // Legacy `<projectCode>-T01` running number from the Task Running
    // Number Master.
    const taskFormat = await this.taskNumberMaster.findOne();
    return this.repository.createTask(
      scope,
      projectId,
      dto,
      hoursToComplete,
      points ?? 10,
      userId,
      { id: project.id, projectCode: project.projectCode },
      {
        taskPrefix: taskFormat.taskPrefix,
        separator: taskFormat.separator,
        sequenceDigits: taskFormat.sequenceDigits,
      },
    );
  }

  async updateTask(taskId: number, dto: UpdateTaskDto) {
    const scope = this.tenantContext.getOrgScope();
    const existing = await this.repository.findTaskById(scope, taskId);
    if (!existing) {
      throw new ResourceNotFoundException("Task", taskId);
    }
    // A team lead may only edit tasks of their own team, and only hand a task
    // to another employee of that team.
    const access = await this.writeAccess.resolve();
    await this.writeAccess.assertAssignee(access, existing.assignedToId);
    if (dto.assignedToId !== undefined) {
      await this.writeAccess.assertAssignee(access, dto.assignedToId);
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

    // Leaving "completed" is a reopen: it un-completes finished work, so it needs
    // a reason (recorded in the audit log). Any other change is allowed as before.
    if (dto.status !== undefined) {
      assertManagerStatusChange(
        existing.status as LifecycleTaskStatus,
        dto.status as LifecycleTaskStatus,
        dto.statusChangeReason,
      );
    }

    // A task with a running timer cannot change hands: the open session
    // belongs to the current assignee and would be orphaned.
    if (
      dto.assignedToId !== undefined &&
      (dto.assignedToId ?? null) !== (existing.assignedToId ?? null) &&
      (await this.repository.hasOpenSession(scope, taskId))
    ) {
      throw new BusinessRuleConflictException(
        "This task has a running timer. Ask the assignee to stop or pause it before reassigning.",
        "TASK_HAS_ACTIVE_SESSION",
      );
    }

    // The ETA only changes when it is entered: moving the dates never
    // rewrites it. Because points are measured against it, a finished task's
    // ETA is frozen and a started task's needs a reason (audited).
    let computedHours: number | undefined;
    let etaAudit:
      { before: number; after: number; reason: string | null } | undefined;
    if (dto.hoursToComplete !== undefined) {
      const before = Number(existing.hoursToComplete);
      if (dto.hoursToComplete !== before) {
        if (existing.status === TaskStatus.completed) {
          throw new BusinessRuleViolationException(
            "The ETA of a completed task cannot be changed.",
            "ETA_LOCKED",
          );
        }
        const started =
          existing.status !== TaskStatus.not_started ||
          Number(existing.loggedHours) > 0;
        const reason = dto.hoursChangeReason?.trim() || null;
        if (started && (reason?.length ?? 0) < 3) {
          throw new BusinessRuleViolationException(
            "Work on this task has started: give a reason for changing its ETA.",
            "ETA_CHANGE_REASON_REQUIRED",
          );
        }
        computedHours = dto.hoursToComplete;
        etaAudit = { before, after: dto.hoursToComplete, reason };
      }
    }

    // The task BECOMES complete when its status is set to completed or its
    // percent reaches 100 and it was not already complete (unchanged trigger).
    const completionNow = isCompletionTransition(
      {
        status: existing.status as LifecycleTaskStatus,
        completionPercent: existing.completionPercent,
      },
      {
        status: dto.status as LifecycleTaskStatus | undefined,
        completionPercent: dto.completionPercent,
      },
    );

    // With time-based points on, a task is measured by the assignee's timer:
    // completing one with no timer time would earn the on-time bonus for free.
    const completingFor = dto.assignedToId ?? existing.assignedToId;
    if (completionNow && completingFor) {
      const gate = await this.repository.findPointsGate(
        scope,
        taskId,
        completingFor,
      );
      if (gate.enabled && gate.workedMinutes === 0) {
        throw new BusinessRuleViolationException(
          "No timer time is logged on this task yet. The assignee must start the timer before it can be completed.",
          "NO_TIMER_TIME_LOGGED",
        );
      }
    }

    const payload: UpdateTaskDto = { ...dto };
    if (completionNow) {
      payload.status = TaskStatus.completed;
      payload.completionPercent = 100;
      if (!payload.actualEndDate) {
        payload.actualEndDate = businessToday();
      }
    }

    // Every status change is part of the task's history: it is written to the
    // audit log in the same transaction as the update.
    const statusChanged =
      payload.status !== undefined && payload.status !== existing.status;

    const userId = this.tenantContext.getUserId();
    const updated = await this.repository.updateTask(
      scope,
      taskId,
      payload,
      computedHours,
      userId,
      statusChanged && payload.status !== undefined
        ? {
            before: existing.status,
            after: payload.status,
            reason:
              dto.statusChangeReason?.trim() ||
              (completionNow ? "task completed" : "status updated"),
          }
        : undefined,
      etaAudit,
    );
    if (!updated) {
      throw new ResourceNotFoundException("Task", taskId);
    }

    // Points go to the assigned employee, once per task (the repository ignores
    // a repeat), and only after the update itself succeeded.
    const targetEmpId = payload.assignedToId ?? existing.assignedToId;
    if (completionNow && targetEmpId) {
      await this.repository.awardTaskCompletion(
        scope,
        {
          id: taskId,
          title: payload.title ?? existing.title,
          taskCode: existing.taskCode,
          priority: existing.priority,
          points: payload.points ?? existing.points,
          hoursToComplete: computedHours ?? existing.hoursToComplete,
        },
        targetEmpId,
      );
    }
    return updated;
  }

  async softDeleteTask(taskId: number) {
    const scope = this.tenantContext.getOrgScope();
    const existing = await this.repository.findTaskById(scope, taskId);
    if (!existing) {
      throw new ResourceNotFoundException("Task", taskId);
    }
    await this.writeAccess.assertAssignee(
      await this.writeAccess.resolve(),
      existing.assignedToId,
    );
    if (await this.repository.hasOpenSession(scope, taskId)) {
      throw new BusinessRuleConflictException(
        "This task has a running timer. Ask the assignee to stop or pause it before deleting the task.",
        "TASK_HAS_ACTIVE_SESSION",
      );
    }
    const userId = this.tenantContext.getUserId();
    await this.repository.softDeleteTask(scope, taskId, userId);
    return { success: true };
  }
}
