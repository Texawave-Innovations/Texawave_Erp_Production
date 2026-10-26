import { Injectable } from "@nestjs/common";
import {
  BusinessRuleViolationException,
  ResourceNotFoundException,
} from "../../common/exceptions/business.exception.js";
import { TenantContextService } from "../../platform/tenancy/tenant-context.service.js";
import { EmployeeQueryService } from "../hr/employees/employee-query.service.js";
import type { CreateTimeEntryDto } from "./dto/create-time-entry.dto.js";
import { ProjectsRepository } from "./projects.repository.js";

@Injectable()
export class TimeEntriesService {
  constructor(
    private readonly repository: ProjectsRepository,
    private readonly tenantContext: TenantContextService,
    private readonly employeeQuery: EmployeeQueryService,
  ) {}

  private async requireCurrentEmployeeId(): Promise<number> {
    const employee = await this.employeeQuery.findCurrentEmployeeOrNull();
    if (!employee) {
      throw new BusinessRuleViolationException(
        "Current user has no associated employee profile to log time",
        "NO_EMPLOYEE_PROFILE",
      );
    }
    return employee.id;
  }

  async getActiveTimer() {
    const scope = this.tenantContext.getOrgScope();
    const employee = await this.employeeQuery.findCurrentEmployeeOrNull();
    if (!employee) return null;
    return this.repository.findActiveTimer(scope, employee.id);
  }

  async startTimer(taskId: number) {
    const scope = this.tenantContext.getOrgScope();
    const employeeId = await this.requireCurrentEmployeeId();

    const task = await this.repository.findTaskById(scope, taskId);
    if (!task) {
      throw new ResourceNotFoundException("Task", taskId);
    }

    // Check if another timer is running
    const active = await this.repository.findActiveTimer(scope, employeeId);
    if (active) {
      throw new BusinessRuleViolationException(
        `Another timer is already running for task ${active.task.taskCode}. Please stop it before starting a new timer.`,
        "TIMER_ALREADY_RUNNING",
      );
    }

    return this.repository.startTimer(scope, taskId, employeeId);
  }

  async stopTimer(taskId: number, notes?: string) {
    const scope = this.tenantContext.getOrgScope();
    const employeeId = await this.requireCurrentEmployeeId();

    const task = await this.repository.findTaskById(scope, taskId);
    if (!task) {
      throw new ResourceNotFoundException("Task", taskId);
    }

    const active = await this.repository.findActiveTimer(scope, employeeId);
    if (!active || active.taskId !== taskId) {
      throw new BusinessRuleViolationException(
        "No active timer running for this task",
        "NO_ACTIVE_TIMER",
      );
    }

    const now = new Date();
    const elapsedMs = now.getTime() - new Date(active.startedAt).getTime();
    const durationMinutes = Math.max(1, Math.round(elapsedMs / 60000));
    const hours = Math.round((durationMinutes / 60) * 100) / 100;

    const stopped = await this.repository.stopTimer(
      scope,
      active.id,
      durationMinutes,
      notes,
    );

    // Update logged hours on task and project member
    await this.repository.incrementLoggedHours(
      scope,
      task.projectId,
      taskId,
      employeeId,
      hours,
    );

    return stopped;
  }

  async createManualTimeEntry(taskId: number, dto: CreateTimeEntryDto) {
    const scope = this.tenantContext.getOrgScope();
    const employeeId = await this.requireCurrentEmployeeId();

    const task = await this.repository.findTaskById(scope, taskId);
    if (!task) {
      throw new ResourceNotFoundException("Task", taskId);
    }

    const hours = Math.round((dto.durationMinutes / 60) * 100) / 100;
    const entry = await this.repository.createManualTimeEntry(
      scope,
      taskId,
      employeeId,
      dto,
    );

    // Update logged hours on task and project member
    await this.repository.incrementLoggedHours(
      scope,
      task.projectId,
      taskId,
      employeeId,
      hours,
    );

    return entry;
  }

  async findTaskTimeEntries(taskId: number) {
    const scope = this.tenantContext.getOrgScope();
    const task = await this.repository.findTaskById(scope, taskId);
    if (!task) {
      throw new ResourceNotFoundException("Task", taskId);
    }
    return this.repository.findTaskTimeEntries(scope, taskId);
  }
}
