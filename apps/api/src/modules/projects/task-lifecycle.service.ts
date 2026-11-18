import { Injectable } from "@nestjs/common";
import {
  BusinessRuleViolationException,
  ResourceNotFoundException,
} from "../../common/exceptions/business.exception.js";
import { TenantContextService } from "../../platform/tenancy/tenant-context.service.js";
import { EmployeeQueryService } from "../hr/employees/employee-query.service.js";
import { ProjectsRepository } from "./projects.repository.js";
import {
  TaskLifecycleRepository,
  type ActionResult,
} from "./task-lifecycle.repository.js";

/**
 * The task-moving half of the stopwatch: `timer/stop` with `pause` or
 * `complete`. Not routed on its own — `TimeEntriesService.stopTimer` calls it.
 *
 * What this service decides: who may act (the signed-in employee, on a task
 * assigned to them). Everything else — the strict state machine, the day's
 * timesheet row, the server-generated timestamps, the session, status history
 * and points — happens in one database transaction in
 * `TaskLifecycleRepository`, so each action is safe against double-clicks and
 * retries.
 */
@Injectable()
export class TaskLifecycleService {
  constructor(
    private readonly repository: ProjectsRepository,
    private readonly lifecycle: TaskLifecycleRepository,
    private readonly tenantContext: TenantContextService,
    private readonly employeeQuery: EmployeeQueryService,
  ) {}

  async pause(taskId: number, notes?: string): Promise<ActionResult> {
    const ctx = await this.prepare(taskId);
    return this.lifecycle.pause(ctx.scope, {
      taskId,
      employeeId: ctx.employeeId,
      userId: ctx.userId,
      now: new Date(),
      notes,
    });
  }

  async complete(taskId: number, notes?: string): Promise<ActionResult> {
    const ctx = await this.prepare(taskId);
    return this.lifecycle.complete(ctx.scope, {
      taskId,
      employeeId: ctx.employeeId,
      userId: ctx.userId,
      now: new Date(),
      notes,
    });
  }

  /** HR confirms the real end of a flagged session (see the repository). The
   * caller has already been authorised as HR by the timesheet service. */
  correctSessionEnd(input: {
    sessionId: number;
    endTime: string;
    reason: string;
  }) {
    return this.lifecycle.correctSessionEnd(this.tenantContext.getOrgScope(), {
      ...input,
      actorUserId: this.tenantContext.getUserId(),
      now: new Date(),
    });
  }

  /** The signed-in employee and a task assigned to them. Anyone else gets a
   * 404, so another employee's task is not even confirmed to exist. */
  private async prepare(taskId: number) {
    const scope = this.tenantContext.getOrgScope();
    const employee = await this.employeeQuery.findCurrentEmployeeOrNull();
    if (!employee) {
      throw new BusinessRuleViolationException(
        "Current user has no associated employee profile to log time",
        "NO_EMPLOYEE_PROFILE",
      );
    }
    const task = await this.repository.findTaskById(scope, taskId);
    if (!task || task.assignedToId !== employee.id) {
      throw new ResourceNotFoundException("Task", taskId);
    }
    return {
      scope,
      employeeId: employee.id,
      userId: this.tenantContext.getUserId(),
    };
  }
}
