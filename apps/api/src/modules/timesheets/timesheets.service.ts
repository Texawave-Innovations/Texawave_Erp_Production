import { Injectable } from "@nestjs/common";
import { businessToday } from "../../common/dates/business-date.js";
import { parseDateOnly } from "../../common/dates/date-only.js";
import {
  BusinessRuleViolationException,
  ResourceNotFoundException,
} from "../../common/exceptions/business.exception.js";
import { TenantContextService } from "../../platform/tenancy/tenant-context.service.js";
import {
  AttendanceLookupService,
  type AttendanceDayInfo,
} from "../hr/attendance/services/attendance-lookup.service.js";
import type { EmployeeRef } from "../hr/attendance/services/attendance-day-resolver.js";
import { EmployeeQueryService } from "../hr/employees/employee-query.service.js";
import { TasksService } from "../projects/tasks.service.js";
import {
  buildTaskHistory,
  summarizeDay,
  type RecordedDay,
} from "./timesheet-views.js";
import { requireTimesheetEmployee } from "./employee-ref.js";
import { dayWorkflowStatus, reviewStage } from "./timesheet-approval.js";
import { flagsForDay } from "./timesheet-flags.js";
import { TimesheetMonthService } from "./timesheet-month.service.js";
import { TimesheetsRepository } from "./timesheets.repository.js";
import type { DailyStatus } from "./timesheets.rules.js";

/** Longest date range a history request may span (same cap as attendance). */
export const MAX_HISTORY_DAYS = 62;

const DAY_MS = 86_400_000;

/**
 * What the employee's timesheet screens read. Every method resolves the
 * employee from the signed-in user — there is no way to ask for another
 * person's timesheet through this service.
 *
 * Attendance is read through HR Attendance's exported lookup, which runs the
 * same calculation as the attendance screens: every day has an effective status
 * (Present, Absent, Half day, On leave, Holiday, Weekly off, or Not marked when
 * HR has nothing for it). A missing record is never read as an absence, and a
 * day's status is never inferred from missing work. The mismatch flags are
 * derived on every read (see timesheet-flags.ts) and change nothing.
 */
@Injectable()
export class TimesheetsService {
  constructor(
    private readonly repository: TimesheetsRepository,
    private readonly tenantContext: TenantContextService,
    private readonly employeeQuery: EmployeeQueryService,
    private readonly attendance: AttendanceLookupService,
    private readonly tasks: TasksService,
    private readonly months: TimesheetMonthService,
  ) {}

  private requireEmployee() {
    return requireTimesheetEmployee(this.employeeQuery);
  }

  /** HR's effective status for every date in the range. */
  private attendanceByDate(
    employee: EmployeeRef,
    from: string,
    to: string,
  ): Promise<Map<string, AttendanceDayInfo>> {
    return this.attendance.dayStatuses(
      this.tenantContext.getOrgScope(),
      employee,
      from,
      to,
    );
  }

  /** The employee's day: every row (assigned tasks and custom activities) with
   * its sessions, the day's totals, HR's attendance status, and the open tasks
   * that simply had no work today (display context, never counted). */
  async getMyDay(date: string) {
    const scope = this.tenantContext.getOrgScope();
    const employee = await this.requireEmployee();
    const employeeId = employee.id;

    const [rows, attendance, assigned] = await Promise.all([
      this.repository.findDayRows(scope, employeeId, parseDateOnly(date)),
      this.attendanceByDate(employee, date, date),
      this.tasks.findMyWork(),
    ]);

    const totals = summarizeDay(
      rows.map((row) => ({
        category: row.category,
        sessions: row.sessions,
        durationMinutes: row.durationMinutes,
        endedAt: row.endedAt,
      })),
    );

    const attendanceDay = attendance.get(date) ?? null;

    // Where the day is in submit / review. All rows of a day move together.
    const workflow = dayWorkflowStatus(rows.map((row) => row.status));
    const reviewLead =
      rows.find((row) => row.status !== "DRAFT") ?? rows[0] ?? null;
    const approvalLevels = reviewLead?.approvalLevels === 2 ? 2 : 1;
    const review = {
      status: workflow,
      stage: reviewLead
        ? reviewStage({
            status: workflow,
            approvalLevels,
            firstDecidedAt: reviewLead.firstDecidedAt,
          })
        : null,
      approvalLevels,
      submittedAt: reviewLead?.submittedAt ?? null,
      firstApprovedAt: reviewLead?.firstDecidedAt ?? null,
      decidedAt: reviewLead?.decidedAt ?? null,
      decisionNote: reviewLead?.decisionNote ?? null,
      // Offer Submit only when there is something to send, nothing is still
      // running, and the day is not in the future.
      canSubmit:
        (workflow === "DRAFT" || workflow === "REJECTED") &&
        date <= businessToday() &&
        rows.every((row) => row.sessions.every((s) => s.endedAt !== null)),
    };

    const flags = flagsForDay({
      date,
      today: businessToday(),
      attendanceStatus: attendanceDay?.status ?? null,
      totalMinutes: totals.totalMinutes,
      sessionReviewStates: rows.flatMap((row) =>
        row.sessions.map((s) => s.reviewState),
      ),
      attendanceStatusAtSubmit: reviewLead?.attendanceStatusAtSubmit ?? null,
    });

    // The carried list is today's context ("what else is open on my plate"):
    // it reflects the tasks' CURRENT status, so it is empty for any other day
    // (a past day's no-work status comes from the task day history instead).
    const worked = new Set(rows.map((row) => row.taskId));
    const carried =
      date !== businessToday()
        ? []
        : assigned
            .filter(
              (task) =>
                (task.status === "in_progress" || task.status === "hold") &&
                !worked.has(task.id),
            )
            .map((task) => ({
              taskId: task.id,
              taskCode: task.taskCode,
              title: task.title,
              projectName: task.project?.name ?? null,
              taskStatus: task.status,
              carried: true as const,
              minutes: 0,
            }));

    return {
      date,
      attendanceStatus: attendanceDay?.status ?? null,
      attendance: attendanceDay
        ? {
            status: attendanceDay.status,
            workedMinutes: attendanceDay.workedMinutes,
            overtimeMinutes: attendanceDay.overtimeMinutes,
            targetMinutes: attendanceDay.targetMinutes,
            baseTargetMinutes: attendanceDay.baseTargetMinutes,
            permissions: attendanceDay.permissions,
            permissionMinutes: attendanceDay.permissionMinutes,
            hasOpenSession: attendanceDay.hasOpenSession,
          }
        : null,
      flags,
      review,
      totals,
      rows: rows.map((row) => ({
        id: row.id,
        category: row.category,
        title: row.title,
        description: row.description,
        projectId: row.projectId,
        lateEntryReason: row.lateEntryReason,
        taskId: row.taskId,
        taskCode: row.task?.taskCode ?? null,
        projectName: row.project?.name ?? null,
        dailyStatus: row.dailyStatus,
        submissionStatus: row.status,
        notes: row.notes,
        isBackdated: row.isBackdated,
        // custom activities carry their own interval; task rows own sessions
        startedAt: row.startedAt,
        endedAt: row.endedAt,
        durationMinutes:
          row.category === "TASK"
            ? row.sessions.reduce(
                (n, s) => (s.endedAt ? n + s.durationMinutes : n),
                0,
              )
            : (row.durationMinutes ?? 0),
        sessions: row.sessions,
      })),
      carried,
    };
  }

  /** The employee's own month: attendance (status, check-in/out, hours,
   * approved permissions) beside what was logged, day by day. */
  async getMyMonth(month: string) {
    return this.months.forEmployee(await this.requireEmployee(), month);
  }

  /** One task, day by day: the days it was worked on (stored rows) and the
   * days in between (derived, 0 minutes, with HR's status for that day). */
  async getTaskHistory(taskId: number, from: string, to: string) {
    if (from > to) {
      throw new BusinessRuleViolationException(
        "The start date must not be after the end date",
        "INVALID_DATE_RANGE",
      );
    }
    const span =
      Math.round(
        (parseDateOnly(to).getTime() - parseDateOnly(from).getTime()) / DAY_MS,
      ) + 1;
    if (span > MAX_HISTORY_DAYS) {
      throw new BusinessRuleViolationException(
        `The date range may span at most ${MAX_HISTORY_DAYS} days`,
        "DATE_RANGE_TOO_LARGE",
      );
    }

    const scope = this.tenantContext.getOrgScope();
    const employee = await this.requireEmployee();
    const employeeId = employee.id;
    const task = await this.repository.findOwnTask(scope, employeeId, taskId);
    if (!task) throw new ResourceNotFoundException("Task", taskId);

    const [rows, events, attendance] = await Promise.all([
      this.repository.findTaskRows(
        scope,
        employeeId,
        taskId,
        parseDateOnly(from),
        parseDateOnly(to),
      ),
      this.tasks.findStatusEvents(taskId),
      this.attendanceByDate(employee, from, to),
    ]);

    const recorded = new Map<string, RecordedDay>();
    for (const row of rows) {
      recorded.set(row.workDate.toISOString().slice(0, 10), {
        rowId: row.id,
        dailyStatus: row.dailyStatus as DailyStatus,
        minutes: row.sessions.reduce(
          (n, s) => (s.endedAt ? n + s.durationMinutes : n),
          0,
        ),
      });
    }

    const days = buildTaskHistory({
      from,
      to,
      recorded,
      events,
      attendance: new Map(
        [...attendance].map(([date, info]) => [date, info.status]),
      ),
    });
    return {
      task: {
        id: task.id,
        taskCode: task.taskCode,
        title: task.title,
        status: task.status,
        projectName: task.project?.name ?? null,
      },
      from,
      to,
      totalMinutes: days.reduce((n, d) => n + d.minutes, 0),
      days,
    };
  }
}
