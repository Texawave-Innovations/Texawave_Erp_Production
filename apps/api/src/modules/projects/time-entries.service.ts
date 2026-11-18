import { Injectable, Logger } from "@nestjs/common";
import { businessToday, weekStart } from "../../common/dates/business-date.js";
import {
  BusinessRuleViolationException,
  ResourceNotFoundException,
} from "../../common/exceptions/business.exception.js";
import { TenantContextService } from "../../platform/tenancy/tenant-context.service.js";
import { AttendanceService } from "../hr/attendance/attendance.service.js";
import { EmployeeQueryService } from "../hr/employees/employee-query.service.js";
import {
  assertCheckedIn,
  readMyAttendanceStatus,
  type AttendanceGateStatus,
} from "./attendance-gate.js";
import type { CreateTimeEntryDto } from "./dto/create-time-entry.dto.js";
import { OpenSessionSweepService } from "./open-session-sweep.service.js";
import { ProjectsRepository } from "./projects.repository.js";
import { TaskLifecycleService } from "./task-lifecycle.service.js";

export type { AttendanceGateStatus } from "./attendance-gate.js";

@Injectable()
export class TimeEntriesService {
  private readonly logger = new Logger(TimeEntriesService.name);

  constructor(
    private readonly repository: ProjectsRepository,
    private readonly tenantContext: TenantContextService,
    private readonly employeeQuery: EmployeeQueryService,
    private readonly attendance: AttendanceService,
    private readonly lifecycle: TaskLifecycleService,
    private readonly sweep: OpenSessionSweepService,
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

  /** The caller's attendance today, read through HR Attendance's public
   * service (Docs/CODING_STANDARDS.md §11 — no access to its repository). */
  async getMyAttendanceStatus(): Promise<AttendanceGateStatus> {
    return readMyAttendanceStatus(this.attendance);
  }

  /** Legacy auto-pause: a timer still running after the employee checked
   * out is closed at the check-out instant (legacy paused it as soon as the
   * My Work page noticed; doing it server-side means it also happens when
   * the page isn't open). Returns the active timer, or null. */
  async getActiveTimer() {
    const scope = this.tenantContext.getOrgScope();
    const employee = await this.employeeQuery.findCurrentEmployeeOrNull();
    if (!employee) return null;
    const active = await this.repository.findActiveTimer(scope, employee.id);
    if (!active) return null;

    const status = await this.getMyAttendanceStatus();
    const startedAt = new Date(active.startedAt);
    if (
      status.hasRecordToday &&
      !status.checkedIn &&
      status.lastCheckOutAt &&
      status.lastCheckOutAt >= startedAt
    ) {
      await this.closeTimer(
        scope,
        active,
        active.task.projectId,
        employee.id,
        status.lastCheckOutAt,
        "Auto-paused at attendance check-out",
      );
      this.logger.log(
        `Auto-paused timer ${active.id} for employee ${employee.id} at check-out`,
      );
      return null;
    }
    return active;
  }

  async startTimer(taskId: number) {
    const scope = this.tenantContext.getOrgScope();
    const employeeId = await this.requireCurrentEmployeeId();

    const task = await this.repository.findTaskById(scope, taskId);
    if (!task) {
      throw new ResourceNotFoundException("Task", taskId);
    }

    // Legacy gate: the stopwatch only runs while the employee is checked in.
    assertCheckedIn(await this.getMyAttendanceStatus());

    // A forgotten timer (checked out since, or left over from an earlier day)
    // is resolved first, so it never blocks starting a new one.
    await this.sweep.resolveEmployee(scope.organizationId, employeeId);

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

  /**
   * Stops the stopwatch. A plain stop only closes the running session. With
   * `pause` or `complete` the same call also moves the task (on hold, or
   * completed with points paid once) in one transaction, using the strict
   * lifecycle rules; those two require the caller to be the task's assignee.
   */
  async stopTimer(
    taskId: number,
    notes?: string,
    options: { pause?: boolean; complete?: boolean } = {},
  ) {
    if (options.pause && options.complete) {
      throw new BusinessRuleViolationException(
        "Choose either pause or complete, not both",
        "TIMER_STOP_CONFLICTING_FLAGS",
      );
    }
    if (options.pause || options.complete) {
      return this.stopAndMoveTask(taskId, notes, options.complete === true);
    }

    const scope = this.tenantContext.getOrgScope();
    const employeeId = await this.requireCurrentEmployeeId();

    // The task may have been deleted while the timer ran: the employee must
    // still be able to stop their own timer, so fall back to the timer's task.
    const task = await this.repository.findTaskById(scope, taskId);
    const active = await this.repository.findActiveTimer(scope, employeeId);
    if (!task && (!active || active.taskId !== taskId)) {
      throw new ResourceNotFoundException("Task", taskId);
    }
    if (!active || active.taskId !== taskId) {
      throw new BusinessRuleViolationException(
        "No active timer running for this task",
        "NO_ACTIVE_TIMER",
      );
    }
    const projectId = task?.projectId ?? active.task?.projectId;
    if (projectId === undefined) {
      throw new ResourceNotFoundException("Task", taskId);
    }

    return this.closeTimer(
      scope,
      active,
      projectId,
      employeeId,
      new Date(),
      notes,
    );
  }

  /** `timer/stop` with `pause` or `complete`: closes the session AND changes
   * the task. Returns the closed session (the usual response shape) plus the
   * task's new status and the day's timesheet row. */
  private async stopAndMoveTask(
    taskId: number,
    notes: string | undefined,
    complete: boolean,
  ) {
    const result = complete
      ? await this.lifecycle.complete(taskId, notes)
      : await this.lifecycle.pause(taskId, notes);
    const scope = this.tenantContext.getOrgScope();
    const session = result.sessionId
      ? await this.repository.findSessionWithTask(scope, result.sessionId)
      : null;
    return {
      ...(session ?? {}),
      taskId: result.taskId,
      taskStatus: result.status,
      dailyStatus: result.dailyStatus,
      timesheetId: result.timesheetId,
    };
  }

  /** Closes a running entry at `endedAt` and rolls the hours up to the task
   * and project member. */
  private async closeTimer(
    scope: ReturnType<TenantContextService["getOrgScope"]>,
    active: { id: number; taskId: number; startedAt: Date },
    projectId: number,
    employeeId: number,
    endedAt: Date,
    notes: string | undefined,
  ) {
    const elapsedMs = endedAt.getTime() - new Date(active.startedAt).getTime();
    const durationMinutes = Math.max(1, Math.round(elapsedMs / 60000));
    const hours = Math.round((durationMinutes / 60) * 100) / 100;

    const stopped = await this.repository.stopTimer(
      scope,
      active.id,
      durationMinutes,
      notes,
      endedAt,
    );
    await this.repository.incrementLoggedHours(
      scope,
      projectId,
      active.taskId,
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
    if (dto.entryDate.slice(0, 10) > businessToday()) {
      throw new BusinessRuleViolationException(
        "Time cannot be logged for a future date",
        "TIME_ENTRY_IN_FUTURE",
      );
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

  /** The caller's own time entries on a task. Unlike `findTaskTimeEntries`
   * it never returns other people's entries, so it is safe for the employee
   * portal (no `projects.project.read`). 404s unless the task is assigned to
   * the caller. */
  async findMyTaskTimeEntries(taskId: number) {
    const scope = this.tenantContext.getOrgScope();
    const employee = await this.employeeQuery.findCurrentEmployeeOrNull();
    const task = await this.repository.findTaskById(scope, taskId);
    if (!employee || !task || task.assignedToId !== employee.id) {
      throw new ResourceNotFoundException("Task", taskId);
    }
    return this.repository.findTaskTimeEntries(scope, taskId, employee.id);
  }

  /** "Logged Today" / "This Week" for an employee (closed entries; the UI
   * adds a running timer's live elapsed time on top). */
  async getTimeSummary(employeeId: number) {
    const scope = this.tenantContext.getOrgScope();
    const today = businessToday();
    const [todayTotals, weekTotals] = await Promise.all([
      this.repository.sumLoggedMinutes(scope, employeeId, today),
      this.repository.sumLoggedMinutes(scope, employeeId, weekStart(today)),
    ]);
    return {
      date: today,
      loggedTodayMinutes: todayTotals.minutes,
      entriesToday: todayTotals.entries,
      loggedThisWeekMinutes: weekTotals.minutes,
    };
  }

  async getMyTimeSummary() {
    const employee = await this.employeeQuery.findCurrentEmployeeOrNull();
    if (!employee) {
      return {
        date: businessToday(),
        loggedTodayMinutes: 0,
        entriesToday: 0,
        loggedThisWeekMinutes: 0,
      };
    }
    return this.getTimeSummary(employee.id);
  }

  /** Legacy My Work employee switcher: a manager's read-only view of
   * another employee's tasks, running timer and logged time. */
  async getEmployeeWork(employeeId: number) {
    const scope = this.tenantContext.getOrgScope();
    const employee = await this.repository.findEmployeeBrief(scope, employeeId);
    if (!employee) throw new ResourceNotFoundException("Employee", employeeId);
    const [tasks, activeTimer, timeSummary] = await Promise.all([
      this.repository.findMyTasks(scope, employeeId),
      this.repository.findActiveTimer(scope, employeeId),
      this.getTimeSummary(employeeId),
    ]);
    return {
      employee: {
        id: employee.id,
        fullName: employee.fullName,
        employeeCode: employee.employeeCode,
        department: employee.department?.name ?? null,
        designation: employee.designation?.name ?? null,
      },
      tasks,
      activeTimer,
      timeSummary,
    };
  }
}
