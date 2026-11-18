import { Injectable, Logger } from "@nestjs/common";
import type { OrgScope } from "../../common/tenancy/org-scope.js";
import { NotificationsService } from "../../platform/notifications/notifications.service.js";
import { AttendanceLookupService } from "../hr/attendance/services/attendance-lookup.service.js";
import { resolveOpenSession } from "../timesheets/timesheets.rules.js";
import { TaskLifecycleRepository } from "./task-lifecycle.repository.js";

export interface SweepResult {
  /** Sessions closed at a real attendance check-out. */
  closedAtCheckout: number;
  /** Sessions with no real end: closed with 0 minutes and flagged for review. */
  closedStale: number;
  /** Sessions still running normally. */
  kept: number;
  failed: number;
}

const empty = (): SweepResult => ({
  closedAtCheckout: 0,
  closedStale: 0,
  kept: 0,
  failed: 0,
});

/**
 * Closes stopwatch sessions that were forgotten — never inventing hours
 * (`resolveOpenSession` in timesheets.rules.ts decides, using real instants
 * only):
 *  - the employee checked out after the timer started -> the session ends at
 *    that recorded check-out (split at IST midnight if it spans two days);
 *  - no check-out, and the session crossed IST midnight or ran past the cap ->
 *    it is closed at its own start with ZERO minutes and flagged
 *    STALE_UNRESOLVED; the employee is told, and the real end can only come
 *    from an authorized correction.
 *
 * Run by the scheduler every few minutes, and lazily for one employee when
 * they try to start a timer (so a forgotten timer from yesterday never blocks
 * today). Safe to repeat: closing an already-closed session is a no-op.
 */
@Injectable()
export class OpenSessionSweepService {
  private readonly logger = new Logger(OpenSessionSweepService.name);

  constructor(
    private readonly lifecycle: TaskLifecycleRepository,
    private readonly attendance: AttendanceLookupService,
    private readonly notifications: NotificationsService,
  ) {}

  async runForAllOrganizations(now: Date = new Date()): Promise<SweepResult> {
    const total = empty();
    const orgIds = await this.lifecycle.organizationsWithOpenSessions();
    for (const organizationId of orgIds) {
      try {
        add(total, await this.runForOrganization(organizationId, now));
      } catch (error) {
        total.failed += 1;
        this.logger.error(
          `open-session sweep failed for organization ${organizationId}`,
          error instanceof Error ? error.stack : undefined,
        );
      }
    }
    return total;
  }

  async runForOrganization(
    organizationId: number,
    now: Date = new Date(),
    employeeId?: number,
  ): Promise<SweepResult> {
    const scope: OrgScope = { organizationId };
    const open = await this.lifecycle.findOpenSessions(scope, employeeId);
    const result = empty();
    for (const session of open) {
      try {
        const startedAt = new Date(session.startedAt);
        const checkOutAt = await this.attendance.firstCheckOutSince(
          organizationId,
          session.employeeId,
          startedAt,
        );
        const decision = resolveOpenSession({
          startedAt,
          now,
          attendanceCheckOutAt: checkOutAt,
        });

        if (decision.kind === "KEEP_OPEN") {
          result.kept += 1;
        } else if (decision.kind === "CLOSE_AT_CHECKOUT") {
          await this.lifecycle.closeSessionAt(scope, {
            sessionId: session.id,
            endedAt: decision.endedAt,
            closedReason: decision.closedReason,
            ...(decision.reviewRequired
              ? { reviewState: "REVIEW_REQUIRED" as const }
              : {}),
            rollup: true,
            userId: null,
          });
          result.closedAtCheckout += 1;
        } else {
          const closed = await this.lifecycle.closeSessionAt(scope, {
            sessionId: session.id,
            endedAt: decision.endedAt,
            closedReason: "STALE",
            reviewState: "STALE_UNRESOLVED",
            rollup: false,
            userId: null,
          });
          if (closed) {
            result.closedStale += 1;
            await this.tellEmployee(scope, session);
          }
        }
      } catch (error) {
        result.failed += 1;
        this.logger.error(
          `could not resolve open session ${session.id}`,
          error instanceof Error ? error.stack : undefined,
        );
      }
    }
    return result;
  }

  /** Lazy path: before a start is refused because of a forgotten timer. */
  resolveEmployee(
    organizationId: number,
    employeeId: number,
    now: Date = new Date(),
  ): Promise<SweepResult> {
    return this.runForOrganization(organizationId, now, employeeId);
  }

  private async tellEmployee(
    scope: OrgScope,
    session: {
      id: number;
      startedAt: Date;
      task: { taskCode: string; title: string };
      employee: { userId: number | null };
    },
  ): Promise<void> {
    const userId = session.employee.userId;
    if (userId === null) return;
    // Best effort and de-duplicated per session: a failed notice never undoes
    // the close, and a repeated sweep never tells them twice.
    await this.notifications.notifyUser(scope, userId, {
      type: "timesheet.stale_session",
      title: "A timer was left running",
      body: `Your timer on ${session.task.taskCode} (${session.task.title}) was never stopped, so it was closed with 0 minutes. Ask your manager or HR to correct the time if you worked on it.`,
      link: "/portal/work",
      dedupKey: `timesheet.stale:${session.id}`,
    });
  }
}

function add(total: SweepResult, part: SweepResult): void {
  total.closedAtCheckout += part.closedAtCheckout;
  total.closedStale += part.closedStale;
  total.kept += part.kept;
  total.failed += part.failed;
}
