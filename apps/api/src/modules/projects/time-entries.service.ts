import { Injectable, Logger } from "@nestjs/common";
import {
  BusinessRuleViolationException,
  ResourceNotFoundException,
} from "../../common/exceptions/business.exception.js";
import { TenantContextService } from "../../platform/tenancy/tenant-context.service.js";
import { AttendanceService } from "../hr/attendance/attendance.service.js";
import { QueryMyAttendanceDto } from "../hr/attendance/dto/attendance.dto.js";
import { istDateOf } from "../hr/attendance/services/attendance-calculation.service.js";
import { EmployeeQueryService } from "../hr/employees/employee-query.service.js";
import type { CreateTimeEntryDto } from "./dto/create-time-entry.dto.js";
import { ProjectsRepository } from "./projects.repository.js";

/** Today's attendance as the stopwatch sees it (legacy My Work read the
 * same day's `hr/attendance` node). */
export interface AttendanceGateStatus {
  /** An open (not checked-out) attendance session exists right now. */
  checkedIn: boolean;
  /** The employee has an attendance record for today at all. */
  hasRecordToday: boolean;
  /** Latest check-out instant today, if any. */
  lastCheckOutAt: Date | null;
}

/** Monday of the IST week containing `day` (YYYY-MM-DD). */
function weekStart(day: string): string {
  const d = new Date(`${day}T00:00:00.000Z`);
  const offset = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - offset);
  return d.toISOString().slice(0, 10);
}

@Injectable()
export class TimeEntriesService {
  private readonly logger = new Logger(TimeEntriesService.name);

  constructor(
    private readonly repository: ProjectsRepository,
    private readonly tenantContext: TenantContextService,
    private readonly employeeQuery: EmployeeQueryService,
    private readonly attendance: AttendanceService,
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
    const today = istDateOf(new Date());
    const query = Object.assign(new QueryMyAttendanceDto(), {
      from: today,
      to: today,
      page: 1,
      limit: 5,
    });
    const page = await this.attendance.findMine(query);
    const day =
      page.items.find((v) => v.attendanceDate === today) ?? page.items[0];
    if (!day) {
      return { checkedIn: false, hasRecordToday: false, lastCheckOutAt: null };
    }
    const checkOuts = day.sessions
      .map((s) => s.checkOutAt)
      .filter((d): d is Date => d instanceof Date);
    const lastCheckOutAt =
      checkOuts.length > 0
        ? new Date(Math.max(...checkOuts.map((d) => d.getTime())))
        : null;
    return {
      checkedIn: day.hasOpenSession,
      hasRecordToday: true,
      lastCheckOutAt,
    };
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
    const status = await this.getMyAttendanceStatus();
    if (!status.checkedIn) {
      throw new BusinessRuleViolationException(
        status.hasRecordToday
          ? "You are checked out — check in again to start a timer"
          : "Check in for today before starting a timer",
        "ATTENDANCE_CHECK_IN_REQUIRED",
      );
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

    return this.closeTimer(
      scope,
      active,
      task.projectId,
      employeeId,
      new Date(),
      notes,
    );
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

  /** "Logged Today" / "This Week" for an employee (closed entries; the UI
   * adds a running timer's live elapsed time on top). */
  async getTimeSummary(employeeId: number) {
    const scope = this.tenantContext.getOrgScope();
    const today = istDateOf(new Date());
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
        date: istDateOf(new Date()),
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
