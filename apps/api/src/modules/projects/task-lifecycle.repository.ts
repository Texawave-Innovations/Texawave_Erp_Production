import { ForbiddenException, Injectable } from "@nestjs/common";
import { Prisma, TaskStatus } from "@texawave-erp/database";
import { OrgScoped } from "../../common/decorators/org-scoped.decorator.js";
import {
  allocateSegmentMinutes,
  businessDateOf,
  businessInstant,
  splitAtBusinessMidnight,
} from "../../common/dates/business-date.js";
import { parseDateOnly } from "../../common/dates/date-only.js";
import {
  BusinessRuleViolationException,
  ResourceNotFoundException,
} from "../../common/exceptions/business.exception.js";
import type { OrgScope } from "../../common/tenancy/org-scope.js";
import { AuditWriter } from "../../platform/audit/audit-writer.js";
import { PrismaService } from "../../shared/prisma/prisma.service.js";
import { TimesheetDayService } from "../timesheets/core/timesheet-day.service.js";
import {
  awardTaskPoints,
  isTimeBasedPointsEnabled,
  sumTimerMinutes,
} from "./points-award.js";
import {
  applyTaskAction,
  beginTimerTarget,
  dailyStatusAfterAction,
  MAX_OPEN_SESSION_HOURS,
  sessionMinutes,
  type DailyStatus,
  type TaskAction,
} from "../timesheets/timesheets.rules.js";

/** `begin` = the legacy `timer/start` (any state but completed); `start` and
 * `resume` are the strict employee actions of the new flow. */
export type BeginMode = "begin" | TaskAction;

export type ClosedReason =
  | "STOPPED"
  | "PAUSED"
  | "COMPLETED"
  | "ATTENDANCE_CHECKOUT"
  | "AUTO_CHECKOUT"
  | "STALE"
  | "MIDNIGHT_SPLIT"
  | "CORRECTED";

export interface ActionResult {
  taskId: number;
  /** Task status after the action. */
  status: TaskStatus;
  /** The session this action opened or closed (null when it touched none). */
  sessionId: number | null;
  /** The timesheet row of the day the action belongs to. */
  timesheetId: number | null;
  dailyStatus: DailyStatus | null;
  /** True when the request was a harmless repeat (double-click / retry) and
   * nothing changed. */
  replayed: boolean;
}

interface TaskRow {
  id: number;
  taskCode: string;
  title: string;
  projectId: number;
  status: TaskStatus;
  priority: string;
  points: number;
  hoursToComplete: Prisma.Decimal;
  assignedToId: number | null;
}

interface CloseArgs {
  session: { id: number; startedAt: Date };
  task: { id: number; projectId: number; title: string };
  organizationId: number;
  employeeId: number;
  userId: number | null;
  endedAt: Date;
  closedReason: ClosedReason;
  reviewState?: "OK" | "REVIEW_REQUIRED" | "STALE_UNRESOLVED";
  notes?: string | undefined;
  /** Caller-provided total (the legacy stop path computes it); otherwise derived. */
  totalMinutes?: number | undefined;
  /** Add the minutes to task/member `logged_hours` inside this transaction.
   * The legacy stop path rolls up separately (its service pins that call). */
  rollup: boolean;
}

interface CloseResult {
  totalMinutes: number;
  firstSessionId: number;
  /** Timesheet row of the LAST day segment (where a completion is recorded). */
  lastTimesheetId: number;
}

const TASK_SELECT = {
  id: true,
  taskCode: true,
  title: true,
  projectId: true,
  status: true,
  priority: true,
  points: true,
  hoursToComplete: true,
  assignedToId: true,
} as const;

/**
 * All writes of the employee task lifecycle — Start / Resume / Pause /
 * Complete, the legacy stopwatch calls, manual entries and the stale-session
 * close — in ONE place, so every path produces the same rows: a session in
 * `project_time_entries` linked to the day's `hr.timesheets` row, the IST work
 * date, a midnight split when needed, and an audit row for every task status
 * change.
 *
 * Every public method is one transaction that takes (in this order) the
 * employee's timesheet advisory lock and the task row lock, so a double-click,
 * a network retry or two tabs cannot open two sessions or complete twice.
 * Lock order with attendance is documented in TimesheetDayService.
 */
@Injectable()
export class TaskLifecycleRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly day: TimesheetDayService,
    private readonly audit: AuditWriter,
  ) {}

  // ---------------------------------------------------------------------------
  // Start / resume / begin
  // ---------------------------------------------------------------------------

  @OrgScoped()
  begin(
    scope: OrgScope,
    input: {
      taskId: number;
      employeeId: number;
      /** null on the legacy `timer/start` path (its repository signature has
       * no user): the actor is then the employee's own user. */
      userId: number | null;
      now: Date;
      mode: BeginMode;
      notes?: string | undefined;
    },
  ): Promise<ActionResult> {
    return this.prisma.$transaction(async (tx) => {
      await this.day.lockEmployee(tx, scope.organizationId, input.employeeId);
      const actorUserId = await this.actorOf(
        tx,
        input.employeeId,
        input.userId,
      );
      const task = await this.lockTask(tx, scope.organizationId, input.taskId);

      const open = await tx.projectTimeEntry.findFirst({
        where: {
          organizationId: scope.organizationId,
          employeeId: input.employeeId,
          endedAt: null,
        },
        include: { task: { select: { taskCode: true } } },
      });
      if (open) {
        if (open.taskId === task.id) {
          // Double-click / retry: the session is already running — a no-op.
          return {
            taskId: task.id,
            status: task.status,
            sessionId: open.id,
            timesheetId: open.timesheetId,
            dailyStatus: "IN_PROGRESS",
            replayed: true,
          };
        }
        throw new BusinessRuleViolationException(
          `Another timer is already running for task ${open.task.taskCode}. Please stop it before starting a new timer.`,
          "TIMER_ALREADY_RUNNING",
        );
      }

      const nextStatus =
        input.mode === "begin"
          ? beginTimerTarget(task.status)
          : applyTaskAction(task.status, input.mode);

      const workDate = businessDateOf(input.now);
      const row = await this.day.ensureTaskRow(tx, {
        organizationId: scope.organizationId,
        employeeId: input.employeeId,
        taskId: task.id,
        projectId: task.projectId,
        title: task.title,
        workDate,
        actorUserId,
      });
      if (row.dailyStatus !== "IN_PROGRESS") {
        await this.setDailyStatus(tx, row.id, "IN_PROGRESS");
      }

      const session = await tx.projectTimeEntry.create({
        data: {
          organizationId: scope.organizationId,
          taskId: task.id,
          employeeId: input.employeeId,
          startedAt: input.now,
          entryDate: parseDateOnly(workDate),
          timesheetId: row.id,
          source: "TIMER",
          createdBy: actorUserId,
          ...(input.notes ? { notes: input.notes } : {}),
        },
      });

      await this.changeTaskStatus(tx, task, nextStatus, {
        userId: actorUserId,
        reason: `employee ${input.mode}`,
      });

      return {
        taskId: task.id,
        status: nextStatus,
        sessionId: session.id,
        timesheetId: row.id,
        dailyStatus: "IN_PROGRESS",
        replayed: false,
      };
    });
  }

  // ---------------------------------------------------------------------------
  // Pause
  // ---------------------------------------------------------------------------

  @OrgScoped()
  pause(
    scope: OrgScope,
    input: {
      taskId: number;
      employeeId: number;
      userId: number;
      now: Date;
      notes?: string | undefined;
    },
  ): Promise<ActionResult> {
    return this.prisma.$transaction(async (tx) => {
      await this.day.lockEmployee(tx, scope.organizationId, input.employeeId);
      const task = await this.lockTask(tx, scope.organizationId, input.taskId);
      const nextStatus = applyTaskAction(task.status, "pause");

      const open = await this.findOpenSession(
        tx,
        scope.organizationId,
        input.employeeId,
        task.id,
      );
      let timesheetId: number | null = null;
      let sessionId: number | null = null;
      if (open) {
        const closed = await this.closeSession(tx, {
          session: open,
          task,
          organizationId: scope.organizationId,
          employeeId: input.employeeId,
          userId: input.userId,
          endedAt: input.now,
          closedReason: "PAUSED",
          notes: input.notes,
          rollup: true,
        });
        sessionId = closed.firstSessionId;
        timesheetId = closed.lastTimesheetId;
      }

      await this.changeTaskStatus(tx, task, nextStatus, {
        userId: input.userId,
        reason: input.notes?.trim() || "employee pause",
      });
      return {
        taskId: task.id,
        status: nextStatus,
        sessionId,
        timesheetId,
        // A pause is not a daily status: the day stays In Progress.
        dailyStatus: timesheetId ? dailyStatusAfterAction("pause") : null,
        replayed: false,
      };
    });
  }

  // ---------------------------------------------------------------------------
  // Complete
  // ---------------------------------------------------------------------------

  @OrgScoped()
  complete(
    scope: OrgScope,
    input: {
      taskId: number;
      employeeId: number;
      userId: number;
      now: Date;
      notes?: string | undefined;
    },
  ): Promise<ActionResult> {
    return this.prisma.$transaction(async (tx) => {
      await this.day.lockEmployee(tx, scope.organizationId, input.employeeId);
      const task = await this.lockTask(tx, scope.organizationId, input.taskId);
      // A second Complete (double-click / retry) lands here and is refused:
      // the task is already completed.
      const nextStatus = applyTaskAction(task.status, "complete");

      const workDate = businessDateOf(input.now);
      const open = await this.findOpenSession(
        tx,
        scope.organizationId,
        input.employeeId,
        task.id,
      );
      let sessionId: number | null = null;
      let timesheetId: number;
      if (open) {
        const closed = await this.closeSession(tx, {
          session: open,
          task,
          organizationId: scope.organizationId,
          employeeId: input.employeeId,
          userId: input.userId,
          endedAt: input.now,
          closedReason: "COMPLETED",
          notes: input.notes,
          rollup: true,
        });
        sessionId = closed.firstSessionId;
        timesheetId = closed.lastTimesheetId;
      } else {
        // Completing from hold records today's row with 0 new minutes — no
        // session is fabricated.
        const row = await this.day.ensureTaskRow(tx, {
          organizationId: scope.organizationId,
          employeeId: input.employeeId,
          taskId: task.id,
          projectId: task.projectId,
          title: task.title,
          workDate,
          actorUserId: input.userId,
        });
        timesheetId = row.id;
      }
      // Only the completion day becomes COMPLETED; earlier days keep their status.
      await this.setDailyStatus(
        tx,
        timesheetId,
        dailyStatusAfterAction("complete"),
      );
      if (input.notes?.trim()) {
        await tx.$executeRaw`UPDATE "hr"."timesheets" SET "notes" = ${input.notes.trim()}, "updated_at" = now() WHERE "id" = ${timesheetId}`;
      }

      await tx.projectTask.updateMany({
        where: { id: task.id, organizationId: scope.organizationId },
        data: {
          completionPercent: 100,
          actualEndDate: parseDateOnly(workDate),
          updatedBy: input.userId,
        },
      });
      await this.changeTaskStatus(tx, task, nextStatus, {
        userId: input.userId,
        reason: input.notes?.trim() || "employee complete",
      });
      // With time-based points on, a task is measured by the timer: finishing
      // one with no timer time at all would earn the on-time bonus for free.
      if (
        (await isTimeBasedPointsEnabled(tx, scope.organizationId)) &&
        (await sumTimerMinutes(
          tx,
          scope.organizationId,
          task.id,
          input.employeeId,
        )) === 0
      ) {
        throw new BusinessRuleViolationException(
          "Start the timer and log time on this task before completing it.",
          "NO_TIMER_TIME_LOGGED",
        );
      }
      await this.awardPointsOnce(
        tx,
        scope.organizationId,
        task,
        input.employeeId,
      );

      return {
        taskId: task.id,
        status: nextStatus,
        sessionId,
        timesheetId,
        dailyStatus: "COMPLETED",
        replayed: false,
      };
    });
  }

  // ---------------------------------------------------------------------------
  // Closing an open session (legacy stop, auto-pause, stale resolution)
  // ---------------------------------------------------------------------------

  /** Closes one open session at `endedAt`. Idempotent: an already-closed
   * session returns null. Used by the legacy `timer/stop`, the check-out
   * auto-pause and the stale-session resolver. */
  @OrgScoped()
  closeSessionAt(
    scope: OrgScope,
    input: {
      sessionId: number;
      endedAt: Date;
      closedReason: ClosedReason;
      reviewState?: "OK" | "REVIEW_REQUIRED" | "STALE_UNRESOLVED";
      notes?: string | undefined;
      totalMinutes?: number | undefined;
      rollup: boolean;
      userId: number | null;
    },
  ) {
    return this.prisma.$transaction(async (tx) => {
      const peek = await tx.projectTimeEntry.findFirst({
        where: { id: input.sessionId, organizationId: scope.organizationId },
        select: { employeeId: true },
      });
      if (!peek) return null;
      await this.day.lockEmployee(tx, scope.organizationId, peek.employeeId);
      const session = await tx.projectTimeEntry.findFirst({
        where: {
          id: input.sessionId,
          organizationId: scope.organizationId,
          endedAt: null,
        },
        include: {
          task: { select: { id: true, projectId: true, title: true } },
        },
      });
      if (!session) return null; // someone else closed it first
      const closed = await this.closeSession(tx, {
        session,
        task: session.task,
        organizationId: scope.organizationId,
        employeeId: session.employeeId,
        userId: await this.actorOf(tx, session.employeeId, input.userId),
        endedAt: input.endedAt,
        closedReason: input.closedReason,
        ...(input.reviewState ? { reviewState: input.reviewState } : {}),
        notes: input.notes,
        totalMinutes: input.totalMinutes,
        rollup: input.rollup,
      });
      return tx.projectTimeEntry.findUniqueOrThrow({
        where: { id: closed.firstSessionId },
        include: { task: true },
      });
    });
  }

  // ---------------------------------------------------------------------------
  // HR correction of a flagged session
  // ---------------------------------------------------------------------------

  /**
   * HR confirms the real end of a session that was closed with no (or doubtful)
   * time: a forgotten timer closed with 0 minutes (`STALE_UNRESOLVED`), or an
   * auto-checkout close awaiting review (`REVIEW_REQUIRED`). The employee never
   * edits a task session, so this is the only way hours are added to one after
   * the fact.
   *
   * It works on a submitted or approved day too: the content triggers allow a
   * write only inside this transaction's `app.allow_timesheet_correction`
   * setting, and the change is audited with its reason. The end must be a real
   * IST clock time on the session's own day, after its start, not in the future,
   * within the open-session cap, and clear of the employee's other work. The
   * task's and member's logged hours move by the difference.
   */
  @OrgScoped()
  correctSessionEnd(
    scope: OrgScope,
    input: {
      sessionId: number;
      /** IST `HH:mm` on the session's work date. */
      endTime: string;
      reason: string;
      actorUserId: number;
      now: Date;
    },
  ) {
    return this.prisma.$transaction(async (tx) => {
      const peek = await tx.projectTimeEntry.findFirst({
        where: { id: input.sessionId, organizationId: scope.organizationId },
        select: { employeeId: true },
      });
      if (!peek)
        throw new ResourceNotFoundException("Session", input.sessionId);
      await this.day.lockEmployee(tx, scope.organizationId, peek.employeeId);

      const session = await tx.projectTimeEntry.findFirst({
        where: { id: input.sessionId, organizationId: scope.organizationId },
        include: {
          task: { select: { id: true, projectId: true } },
          employee: {
            select: { userId: true, fullName: true, employeeCode: true },
          },
        },
      });
      if (!session)
        throw new ResourceNotFoundException("Session", input.sessionId);

      if (session.employee.userId === input.actorUserId) {
        throw new ForbiddenException("You cannot correct your own time");
      }
      if (session.endedAt === null) {
        throw new BusinessRuleViolationException(
          "This timer is still running; it has to be stopped first",
          "SESSION_STILL_RUNNING",
        );
      }
      if (session.reviewState === "OK") {
        throw new BusinessRuleViolationException(
          "Only a session flagged for review can be corrected",
          "SESSION_NOT_FLAGGED",
        );
      }

      const workDate = session.entryDate.toISOString().slice(0, 10);
      const end = businessInstant(workDate, input.endTime);
      if (!end) {
        throw new BusinessRuleViolationException(
          "The end time must be a valid HH:mm time",
          "INVALID_TIME",
        );
      }
      if (end.getTime() <= session.startedAt.getTime()) {
        throw new BusinessRuleViolationException(
          "The end time must be after the start of the session",
          "SESSION_END_BEFORE_START",
        );
      }
      if (end.getTime() > input.now.getTime()) {
        throw new BusinessRuleViolationException(
          "The end time cannot be in the future",
          "SESSION_END_IN_FUTURE",
        );
      }
      const minutes = sessionMinutes(session.startedAt, end);
      if (minutes > MAX_OPEN_SESSION_HOURS * 60) {
        throw new BusinessRuleViolationException(
          `A session cannot be longer than ${MAX_OPEN_SESSION_HOURS} hours`,
          "SESSION_TOO_LONG",
        );
      }

      // Clear of the employee's other work: other sessions (a running one
      // overlaps anything after its start) and custom activities.
      const [otherSession, activity] = await Promise.all([
        tx.projectTimeEntry.findFirst({
          where: {
            organizationId: scope.organizationId,
            employeeId: session.employeeId,
            id: { not: session.id },
            // a logged duration has no real clock interval to overlap
            timePrecision: "EXACT",
            startedAt: { lt: end },
            OR: [{ endedAt: null }, { endedAt: { gt: session.startedAt } }],
          },
          select: { id: true },
        }),
        tx.timesheet.findFirst({
          where: {
            organizationId: scope.organizationId,
            employeeId: session.employeeId,
            deletedAt: null,
            category: { not: "TASK" },
            startedAt: { lt: end },
            endedAt: { gt: session.startedAt },
          },
          select: { title: true },
        }),
      ]);
      if (otherSession || activity) {
        throw new BusinessRuleViolationException(
          activity
            ? `This would overlap the activity "${activity.title}"`
            : "This would overlap another work session of the employee",
          "SESSION_OVERLAP",
        );
      }

      const before = {
        endedAt: session.endedAt.toISOString(),
        durationMinutes: session.durationMinutes,
        reviewState: session.reviewState,
      };
      // The one place the locked-day triggers let a session change.
      await tx.$executeRaw`SELECT set_config('app.allow_timesheet_correction', 'on', true)`;
      const updated = await tx.projectTimeEntry.update({
        where: { id: session.id },
        data: {
          endedAt: end,
          durationMinutes: minutes,
          closedReason: "CORRECTED",
          reviewState: "OK",
        },
        select: { id: true, durationMinutes: true },
      });
      const delta = minutes - session.durationMinutes;
      if (delta !== 0) {
        await this.rollupLoggedHours(
          tx,
          scope.organizationId,
          session.task,
          session.employeeId,
          delta,
        );
      }
      await this.audit.write(tx, {
        entityType: "project_time_entry",
        entityId: session.id,
        action: "correct",
        before,
        after: {
          endedAt: end.toISOString(),
          durationMinutes: minutes,
          reviewState: "OK",
        },
        reason: input.reason,
      });
      return {
        sessionId: updated.id,
        employeeId: session.employeeId,
        employeeUserId: session.employee.userId,
        employeeName: session.employee.fullName,
        employeeCode: session.employee.employeeCode,
        workDate,
        minutes,
        previousMinutes: session.durationMinutes,
      };
    });
  }

  // ---------------------------------------------------------------------------
  // Reads for the open-session sweep (system job: no signed-in user)
  // ---------------------------------------------------------------------------

  /** Organizations that currently have at least one running session. */
  async organizationsWithOpenSessions(): Promise<number[]> {
    const rows = await this.prisma.projectTimeEntry.groupBy({
      by: ["organizationId"],
      where: { endedAt: null },
    });
    return rows.map((r) => r.organizationId);
  }

  /** Running sessions of one organization, optionally of one employee. */
  @OrgScoped()
  findOpenSessions(scope: OrgScope, employeeId?: number, take = 500) {
    return this.prisma.projectTimeEntry.findMany({
      where: {
        organizationId: scope.organizationId,
        endedAt: null,
        ...(employeeId !== undefined ? { employeeId } : {}),
      },
      select: {
        id: true,
        employeeId: true,
        startedAt: true,
        task: { select: { taskCode: true, title: true } },
        employee: { select: { userId: true } },
      },
      orderBy: { id: "asc" },
      take,
    });
  }

  // ---------------------------------------------------------------------------
  // Manual (legacy duration-only) entry
  // ---------------------------------------------------------------------------

  /** The legacy manual entry: a date and a duration. Stored as a
   * `DURATION_ONLY` session — its instants are the day-start convention the old
   * code used, never presented as a real clock interval. */
  @OrgScoped()
  addManualEntry(
    scope: OrgScope,
    input: {
      taskId: number;
      employeeId: number;
      userId: number | null;
      /** Business date the work happened, `YYYY-MM-DD`. */
      entryDate: string;
      durationMinutes: number;
      notes?: string | null | undefined;
    },
  ) {
    return this.prisma.$transaction(async (tx) => {
      await this.day.lockEmployee(tx, scope.organizationId, input.employeeId);
      const actorUserId = await this.actorOf(
        tx,
        input.employeeId,
        input.userId,
      );
      const task = await tx.projectTask.findFirst({
        where: {
          id: input.taskId,
          organizationId: scope.organizationId,
          deletedAt: null,
        },
        select: TASK_SELECT,
      });
      if (!task) throw new ResourceNotFoundException("Task", input.taskId);

      const row = await this.day.ensureTaskRow(tx, {
        organizationId: scope.organizationId,
        employeeId: input.employeeId,
        taskId: task.id,
        projectId: task.projectId,
        title: task.title,
        workDate: input.entryDate,
        actorUserId,
      });
      const startedAt = parseDateOnly(input.entryDate);
      return tx.projectTimeEntry.create({
        data: {
          organizationId: scope.organizationId,
          taskId: task.id,
          employeeId: input.employeeId,
          startedAt,
          endedAt: new Date(
            startedAt.getTime() + input.durationMinutes * 60_000,
          ),
          durationMinutes: input.durationMinutes,
          entryDate: startedAt,
          notes: input.notes ?? null,
          timesheetId: row.id,
          source: "MANUAL",
          timePrecision: "DURATION_ONLY",
          createdBy: actorUserId,
        },
      });
    });
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  /** The user an employee-initiated action is attributed to: the caller's own
   * user id when known, else the employee's linked user (an employee acting
   * on their own timer). */
  private async actorOf(
    tx: Prisma.TransactionClient,
    employeeId: number,
    userId: number | null,
  ): Promise<number | null> {
    if (userId !== null) return userId;
    const employee = await tx.employee.findUnique({
      where: { id: employeeId },
      select: { userId: true },
    });
    return employee?.userId ?? null;
  }

  /** Locks the task row (so concurrent actions on it queue) and reads it. */
  private async lockTask(
    tx: Prisma.TransactionClient,
    organizationId: number,
    taskId: number,
  ): Promise<TaskRow> {
    await tx.$queryRaw`SELECT "id" FROM "projects"."project_tasks" WHERE "id" = ${taskId} AND "organization_id" = ${organizationId} AND "deleted_at" IS NULL FOR UPDATE`;
    const task = await tx.projectTask.findFirst({
      where: { id: taskId, organizationId, deletedAt: null },
      select: TASK_SELECT,
    });
    if (!task) throw new ResourceNotFoundException("Task", taskId);
    return task;
  }

  private findOpenSession(
    tx: Prisma.TransactionClient,
    organizationId: number,
    employeeId: number,
    taskId: number,
  ) {
    return tx.projectTimeEntry.findFirst({
      where: { organizationId, employeeId, taskId, endedAt: null },
    });
  }

  /** Daily status of one timesheet row (today's row only — the database
   * trigger refuses a change to a past day). */
  private async setDailyStatus(
    tx: Prisma.TransactionClient,
    timesheetId: number,
    status: DailyStatus,
  ) {
    await tx.$executeRaw`UPDATE "hr"."timesheets" SET "daily_status" = ${status}, "updated_at" = now() WHERE "id" = ${timesheetId}`;
  }

  /** The single place a task's status changes in the employee flow: updates
   * the task and writes the audit row that is the task's status history. */
  private async changeTaskStatus(
    tx: Prisma.TransactionClient,
    task: TaskRow,
    next: TaskStatus,
    ctx: { userId: number | null; reason: string },
  ) {
    if (task.status === next) return;
    await tx.projectTask.updateMany({
      where: { id: task.id },
      data: {
        status: next,
        ...(ctx.userId !== null ? { updatedBy: ctx.userId } : {}),
      },
    });
    await this.audit.write(tx, {
      entityType: "project_task",
      entityId: task.id,
      action: "status_change",
      before: { status: task.status },
      after: { status: next },
      reason: ctx.reason,
    });
  }

  /** Points are awarded once per task and employee, ever (see
   * `awardTaskPoints`, shared with the manager update path). */
  private async awardPointsOnce(
    tx: Prisma.TransactionClient,
    organizationId: number,
    task: TaskRow,
    employeeId: number,
  ) {
    await awardTaskPoints(tx, organizationId, task, employeeId);
  }

  /**
   * Closes a session at `endedAt`, splitting it at IST midnight so no stored
   * session spans two work dates. The recorded total is preserved exactly (the
   * last segment takes the rounding remainder). Each later day gets its own
   * timesheet row; earlier days are never touched.
   */
  private async closeSession(
    tx: Prisma.TransactionClient,
    a: CloseArgs,
  ): Promise<CloseResult> {
    const startedAt = new Date(a.session.startedAt);
    const reviewState = a.reviewState ?? "OK";

    // Real end unknown (stale): closed at its own start, zero minutes.
    if (a.endedAt.getTime() <= startedAt.getTime()) {
      const session = await tx.projectTimeEntry.update({
        where: { id: a.session.id },
        data: {
          endedAt: startedAt,
          durationMinutes: 0,
          closedReason: a.closedReason,
          reviewState,
          ...(a.notes !== undefined ? { notes: a.notes } : {}),
        },
        select: { id: true, timesheetId: true },
      });
      return {
        totalMinutes: 0,
        firstSessionId: session.id,
        lastTimesheetId: session.timesheetId,
      };
    }

    const total = a.totalMinutes ?? sessionMinutes(startedAt, a.endedAt);
    const segments = splitAtBusinessMidnight(startedAt, a.endedAt);
    const minutes = allocateSegmentMinutes(segments, total);
    const first = segments[0]!;
    const crossed = segments.length > 1;

    const firstRow = await tx.projectTimeEntry.update({
      where: { id: a.session.id },
      data: {
        endedAt: first.end,
        durationMinutes: minutes[0]!,
        closedReason: crossed ? "MIDNIGHT_SPLIT" : a.closedReason,
        reviewState,
        ...(a.notes !== undefined ? { notes: a.notes } : {}),
      },
      select: { id: true, timesheetId: true },
    });

    let lastTimesheetId = firstRow.timesheetId;
    for (let i = 1; i < segments.length; i++) {
      const seg = segments[i]!;
      const row = await this.day.ensureTaskRow(tx, {
        organizationId: a.organizationId,
        employeeId: a.employeeId,
        taskId: a.task.id,
        projectId: a.task.projectId,
        title: a.task.title,
        workDate: seg.date,
        actorUserId: a.userId,
        // closing a timer past midnight must not fail on a later day's review
        guardDay: false,
      });
      await tx.projectTimeEntry.create({
        data: {
          organizationId: a.organizationId,
          taskId: a.task.id,
          employeeId: a.employeeId,
          startedAt: seg.start,
          endedAt: seg.end,
          durationMinutes: minutes[i]!,
          entryDate: parseDateOnly(seg.date),
          timesheetId: row.id,
          source: "TIMER",
          createdBy: a.userId,
          // Only the final segment carries the real reason.
          closedReason:
            i === segments.length - 1 ? a.closedReason : "MIDNIGHT_SPLIT",
          reviewState,
        },
      });
      lastTimesheetId = row.id;
    }

    if (a.rollup) {
      await this.rollupLoggedHours(
        tx,
        a.organizationId,
        a.task,
        a.employeeId,
        total,
      );
    }
    return {
      totalMinutes: total,
      firstSessionId: firstRow.id,
      lastTimesheetId,
    };
  }

  private async rollupLoggedHours(
    tx: Prisma.TransactionClient,
    organizationId: number,
    task: { id: number; projectId: number },
    employeeId: number,
    minutes: number,
  ) {
    const hours = new Prisma.Decimal(Math.round((minutes / 60) * 100) / 100);
    await tx.projectTask.updateMany({
      where: { id: task.id, organizationId },
      data: { loggedHours: { increment: hours } },
    });
    await tx.projectMember.updateMany({
      where: { projectId: task.projectId, employeeId },
      data: { loggedHours: { increment: hours } },
    });
  }
}
