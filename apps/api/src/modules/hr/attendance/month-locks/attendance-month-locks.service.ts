import { ForbiddenException, Injectable, Logger } from "@nestjs/common";
import { formatDateOnly } from "../../../../common/dates/date-only.js";
import { PaginatedResponseDto } from "../../../../common/dto/paginated-response.dto.js";
import {
  BusinessException,
  BusinessRuleViolationException,
  ResourceNotFoundException,
} from "../../../../common/exceptions/business.exception.js";
import type { TeamScope } from "../../../../common/tenancy/team-scope.js";
import { NotificationsService } from "../../../../platform/notifications/notifications.service.js";
import { TeamContextService } from "../../../../platform/tenancy/team-context.service.js";
import { TenantContextService } from "../../../../platform/tenancy/tenant-context.service.js";
import { AttendanceDayContextRepository } from "../attendance-day-context.repository.js";
import {
  AttendanceMonthSelfDecisionException,
  AttendanceMonthSubmitterDecisionException,
} from "../attendance.exceptions.js";
import { istDateOf } from "../services/attendance-calculation.service.js";
import type { EmployeeRef } from "../services/attendance-day-resolver.js";
import {
  AttendanceDayViewService,
  type StoredDay,
} from "../services/attendance-day-view.service.js";
import {
  MAX_MONTH_LOCK_BATCH,
  type BulkApproveAttendanceMonthsDto,
  type FinalizeAttendanceMonthDto,
  type QueryAttendanceMonthLocksDto,
} from "./dto/attendance-month-lock.dto.js";
import {
  AttendanceMonthLocksRepository,
  toLockView,
  type MonthLockEmployee,
  type MonthLockView,
} from "./attendance-month-locks.repository.js";
import {
  datesBetween,
  employedWindow,
  isMonthComplete,
  summarise,
  type MonthLockStatus,
} from "./month-lock.rules.js";

export const LOCK_READ = "hr.attendance_lock.read";
export const LOCK_FINALIZE = "hr.attendance_lock.finalize";
export const LOCK_APPROVE = "hr.attendance_lock.approve";

export interface FinalizeReport {
  month: string;
  submitted: { employeeId: number; id: number }[];
  skipped: { employeeId: number; code: string; message: string }[];
}

export interface BulkApproveReport {
  approved: number[];
  skipped: { id: number; code: string; message: string }[];
}

/**
 * Monthly attendance close (Docs/HR_API.md → Attendance month locks).
 *
 * RBAC, on top of the permission guard:
 *  - every action is team-scoped; a row outside the caller's scope is 404;
 *  - `.own` grants no finalize/approve (nobody closes their own month), and
 *    the caller's own employee record is skipped/refused even under `.team`
 *    or `.all`;
 *  - the user who submitted a month may not approve or return it.
 */
@Injectable()
export class AttendanceMonthLocksService {
  private readonly logger = new Logger(AttendanceMonthLocksService.name);

  constructor(
    private readonly repository: AttendanceMonthLocksRepository,
    private readonly dayContext: AttendanceDayContextRepository,
    private readonly dayViews: AttendanceDayViewService,
    private readonly teamContext: TeamContextService,
    private readonly tenantContext: TenantContextService,
    private readonly notifications: NotificationsService,
  ) {}

  async findAll(query: QueryAttendanceMonthLocksDto) {
    const scope = await this.teamContext.resolveScope(LOCK_READ);
    const { items, total } = await this.repository.findPage(
      scope,
      query.month,
      {
        status: query.status,
        employeeId: query.employeeId,
        teamId: query.teamId,
      },
      query,
    );
    return new PaginatedResponseDto(items, total, query.page, query.limit);
  }

  async findOne(id: number): Promise<MonthLockView> {
    const scope = await this.teamContext.resolveScope(LOCK_READ);
    const row = await this.repository.findOne(scope, id);
    if (!row) throw new ResourceNotFoundException("Attendance month", id);
    return toLockView(row);
  }

  /** Submits the month for every eligible employee asked for (or every one
   * in scope). Each employee is its own transaction, so one employee's
   * problem never blocks the rest; it is reported in `skipped`. */
  async finalize(dto: FinalizeAttendanceMonthDto): Promise<FinalizeReport> {
    const scope = await this.writeScope(LOCK_FINALIZE, "submit");
    const today = istDateOf(new Date());
    if (!isMonthComplete(dto.month, today)) {
      throw new BusinessRuleViolationException(
        "A month can be submitted only after it has ended",
        "MONTH_NOT_COMPLETE",
      );
    }
    const candidates = await this.repository.findCandidates(
      scope,
      dto.month,
      { employeeIds: dto.employeeIds, teamId: dto.teamId },
      MAX_MONTH_LOCK_BATCH,
    );
    if (candidates.length > MAX_MONTH_LOCK_BATCH) {
      throw new BusinessRuleViolationException(
        `More than ${MAX_MONTH_LOCK_BATCH} employees match; narrow by team or list the employees`,
        "BATCH_TOO_LARGE",
      );
    }

    const report: FinalizeReport = {
      month: dto.month,
      submitted: [],
      skipped: [],
    };
    // Requested ids that are not in scope (or not employed that month) are
    // reported the same way, so the caller cannot probe other teams.
    if (dto.employeeIds) {
      const found = new Set(candidates.map((c) => c.id));
      for (const employeeId of dto.employeeIds) {
        if (!found.has(employeeId)) {
          report.skipped.push({
            employeeId,
            code: "NOT_FOUND",
            message:
              "Employee not found in your scope or not employed that month",
          });
        }
      }
    }

    const userId = this.tenantContext.getUserId();
    const orgScope = this.tenantContext.getOrgScope();
    for (const employee of candidates) {
      if (employee.userId === userId) {
        report.skipped.push({
          employeeId: employee.id,
          code: "SELF_APPROVAL_FORBIDDEN",
          message: "You cannot submit your own attendance month",
        });
        continue;
      }
      const window = employedWindow(
        dto.month,
        formatDateOnly(employee.dateOfJoining),
        employee.dateOfExit ? formatDateOnly(employee.dateOfExit) : null,
      );
      if (!window) continue; // filtered by the query; defensive only
      try {
        const build = await this.summaryBuilder(employee, window);
        const outcome = await this.repository.finalizeOne(
          orgScope,
          { employeeId: employee.id, month: dto.month, window, userId },
          build,
        );
        if (outcome.result === "submitted") {
          report.submitted.push({ employeeId: employee.id, id: outcome.id });
        } else {
          report.skipped.push({
            employeeId: employee.id,
            code: outcome.code,
            message: outcome.message,
          });
        }
      } catch (error) {
        if (!(error instanceof BusinessException)) throw error;
        report.skipped.push({
          employeeId: employee.id,
          code: errorCodeOf(error),
          message: error.message,
        });
      }
    }
    return report;
  }

  async approve(id: number, note: string | undefined): Promise<MonthLockView> {
    return this.decide(id, {
      from: "SUBMITTED",
      to: "APPROVED",
      action: "approve",
      note: note || null,
    });
  }

  /** Approves each id independently; a failure is reported, not thrown. */
  async approveMany(
    dto: BulkApproveAttendanceMonthsDto,
  ): Promise<BulkApproveReport> {
    const report: BulkApproveReport = { approved: [], skipped: [] };
    for (const id of dto.ids) {
      try {
        await this.approve(id, dto.note);
        report.approved.push(id);
      } catch (error) {
        if (!(error instanceof BusinessException)) throw error;
        report.skipped.push({
          id,
          code: errorCodeOf(error),
          message: error.message,
        });
      }
    }
    return report;
  }

  async returnMonth(id: number, note: string): Promise<MonthLockView> {
    const view = await this.decide(id, {
      from: "SUBMITTED",
      to: "RETURNED",
      action: "return",
      note,
    });
    await this.tellSubmitter(view, "returned");
    return view;
  }

  async reopen(id: number, note: string): Promise<MonthLockView> {
    const view = await this.decide(id, {
      from: "APPROVED",
      to: "REOPENED",
      action: "reopen",
      note,
    });
    await this.tellSubmitter(view, "reopened");
    return view;
  }

  // ---- internals -----------------------------------------------------------

  private async decide(
    id: number,
    change: {
      from: MonthLockStatus;
      to: MonthLockStatus;
      action: "approve" | "return" | "reopen";
      note: string | null;
    },
  ): Promise<MonthLockView> {
    const scope = await this.writeScope(LOCK_APPROVE, "decide");
    const row = await this.repository.findOne(scope, id);
    if (!row) throw new ResourceNotFoundException("Attendance month", id);
    const userId = this.tenantContext.getUserId();
    if (row.employee.userId === userId) {
      throw new AttendanceMonthSelfDecisionException();
    }
    // Reopening is not a decision on the submission, so the submitter's own
    // approver may reopen; approving or returning needs a second person.
    if (change.action !== "reopen" && row.submittedBy === userId) {
      throw new AttendanceMonthSubmitterDecisionException();
    }
    return this.repository.transition(this.tenantContext.getOrgScope(), id, {
      ...change,
      userId,
    });
  }

  /** `.own` holds no finalize/approve right (reserved permissions). */
  private async writeScope(
    permission: string,
    verb: string,
  ): Promise<TeamScope> {
    const scope = await this.teamContext.resolveScope(permission);
    if (scope.level === "own") {
      throw new ForbiddenException(`You may not ${verb} attendance months`);
    }
    return scope;
  }

  /** Loads the calendar for the employee's window once, and returns the pure
   * function the repository runs on the days it read inside its transaction. */
  private async summaryBuilder(
    employee: MonthLockEmployee,
    window: { from: string; to: string },
  ) {
    const ref: EmployeeRef = {
      id: employee.id,
      teamId: employee.teamId,
      workLocationId: employee.workLocationId,
    };
    const ctx = await this.dayContext.load(
      this.tenantContext.getOrgScope(),
      [ref],
      window.from,
      window.to,
    );
    return (stored: StoredDay[]) => {
      const byDate = new Map(stored.map((d) => [d.attendanceDate, d]));
      const days: StoredDay[] = datesBetween(window.from, window.to).map(
        (date) =>
          byDate.get(date) ?? {
            recordId: null,
            employeeId: employee.id,
            attendanceDate: date,
            storedStatus: null,
            sessions: [],
          },
      );
      const views = this.dayViews.build(
        ctx,
        new Map([[employee.id, ref]]),
        days,
        new Date(),
      );
      return summarise(window, views);
    };
  }

  /** Best effort: a failed notification never undoes the decision. */
  private async tellSubmitter(
    view: MonthLockView,
    verb: "returned" | "reopened",
  ): Promise<void> {
    if (!view.submittedBy || view.id === null) return;
    try {
      await this.notifications.notify(this.tenantContext.getOrgScope(), [
        {
          userId: view.submittedBy.id,
          type: `attendance.month_${verb}`,
          title: `Attendance month ${verb}`,
          body: `${view.employee.fullName} (${view.employee.employeeCode}), ${view.month}: ${view.decisionNote ?? ""}`.trim(),
          link: "/hr/attendance",
          dedupKey: `attendance.month_${verb}:${view.id}:${view.decidedAt?.toISOString() ?? ""}`,
        },
      ]);
    } catch (error) {
      this.logger.warn(
        `could not notify the submitter of attendance month ${view.id}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}

function errorCodeOf(error: BusinessException): string {
  return error.errorCode ?? "ERROR";
}
