import { ForbiddenException, Injectable } from "@nestjs/common";
import {
  addDays,
  businessToday,
  weekStart,
} from "../../common/dates/business-date.js";
import { toCsv } from "../../common/csv/csv.js";
import { PaginatedResponseDto } from "../../common/dto/paginated-response.dto.js";
import {
  BusinessException,
  BusinessRuleViolationException,
  ResourceNotFoundException,
} from "../../common/exceptions/business.exception.js";
import type { TeamScope } from "../../common/tenancy/team-scope.js";
import { TeamContextService } from "../../platform/tenancy/team-context.service.js";
import { TenantContextService } from "../../platform/tenancy/tenant-context.service.js";
import { AttendanceLookupService } from "../hr/attendance/services/attendance-lookup.service.js";
import { TaskLifecycleService } from "../projects/task-lifecycle.service.js";
import { EmployeeQueryService } from "../hr/employees/employee-query.service.js";
import type {
  AwaitingQueryDto,
  CorrectSessionDto,
  ReportQueryDto,
  ReviewListQueryDto,
} from "./dto/timesheet-workflow.dto.js";
import { requireTimesheetEmployee } from "./employee-ref.js";
import { approvalVerdict } from "./timesheet-approval.js";
import { flagsForDay } from "./timesheet-flags.js";
import { TimesheetNotificationsService } from "./timesheet-notifications.service.js";
import {
  buildEmployeeReport,
  dayReportRow,
  DAY_REPORT_HEADERS,
  EMPLOYEE_REPORT_HEADERS,
  employeeReportRow,
} from "./timesheet-report.js";
import { groupDays, type GroupedDay } from "./timesheet-review-views.js";
import {
  ReviewRowLimitError,
  TimesheetWorkflowRepository,
  type ReviewFilter,
} from "./timesheet-workflow.repository.js";

export const APPROVE = "hr.timesheet.approve";
export const READ = "hr.timesheet.read";
export const EXPORT = "hr.timesheet.export";

/** Widest range a report may cover, and the most rows it may load. */
export const MAX_REPORT_DAYS = 62;
export const MAX_REPORT_ROWS = 50_000;
/** With no dates given, the "all" list shows this many days back. */
export const DEFAULT_LIST_DAYS = 92;

/** Error codes that mean "this day simply has nothing to submit" when a whole
 * week is submitted: skipped quietly, not reported as failures. */
const QUIET_SKIPS = new Set([
  "TIMESHEET_NOTHING_TO_SUBMIT",
  "TIMESHEET_ALREADY_SUBMITTED",
]);

function paginate<T>(items: readonly T[], page: number, limit: number) {
  return new PaginatedResponseDto(
    items.slice((page - 1) * limit, page * limit),
    items.length,
    page,
    limit,
  );
}

/**
 * Submit (employee) and review (reporting manager, then HR) of timesheet days.
 * The employee is always the signed-in user; a reviewer only ever reaches the
 * employees their `hr.timesheet` scope covers (404 outside it). The rules live
 * in `timesheet-approval.ts`, the writes in `TimesheetWorkflowRepository`.
 */
@Injectable()
export class TimesheetWorkflowService {
  constructor(
    private readonly repository: TimesheetWorkflowRepository,
    private readonly tenantContext: TenantContextService,
    private readonly teamContext: TeamContextService,
    private readonly employeeQuery: EmployeeQueryService,
    private readonly attendance: AttendanceLookupService,
    private readonly notifier: TimesheetNotificationsService,
    private readonly lifecycle: TaskLifecycleService,
  ) {}

  // ---- employee ---------------------------------------------------------------

  async submitDay(date: string) {
    const scope = this.tenantContext.getOrgScope();
    const employee = await requireTimesheetEmployee(this.employeeQuery);
    const attendanceStatus =
      (await this.attendance.dayStatuses(scope, employee, date, date)).get(date)
        ?.status ?? null;

    const result = await this.repository.submitDay(
      scope,
      employee.id,
      this.tenantContext.getUserId(),
      date,
      { today: businessToday(), attendanceStatus },
    );
    await this.notifier.dayChanged(
      {
        employeeId: employee.id,
        employeeName: employee.fullName,
        employeeCode: employee.employeeCode,
        employeeUserId: employee.userId,
        date,
      },
      { kind: "submitted", managerUserId: result.managerUserId },
    );
    return {
      date,
      rowCount: result.rowCount,
      approvalLevels: result.approvalLevels,
      approverBasis: result.approverBasis,
    };
  }

  /** Submits every day of the ISO week that has work to submit (up to today).
   * Each day is its own transaction; a day that cannot be submitted (for
   * example a timer still running) is reported, the others still go through. */
  async submitWeek(anyDateInWeek: string) {
    const start = weekStart(anyDateInWeek);
    const today = businessToday();
    const submitted: { date: string; rowCount: number }[] = [];
    const skipped: { date: string; reason: string }[] = [];
    for (let i = 0; i < 7; i += 1) {
      const date = addDays(start, i);
      if (date > today) break;
      try {
        const result = await this.submitDay(date);
        submitted.push({ date, rowCount: result.rowCount });
      } catch (error) {
        if (error instanceof BusinessException) {
          if (QUIET_SKIPS.has(error.errorCode ?? "")) continue;
          skipped.push({ date, reason: error.message });
          continue;
        }
        throw error;
      }
    }
    return { weekStart: start, submitted, skipped };
  }

  // ---- reviewer ---------------------------------------------------------------

  /** Whether the caller may decide this day right now (the same rule the write
   * applies), so a list shows only what the caller can act on. */
  private canDecide(scope: TeamScope, day: GroupedDay): boolean {
    const { summary, facts } = day;
    return approvalVerdict({
      approvalLevels: summary.approvalLevels,
      firstDecidedAt: summary.firstApprovedAt,
      firstDecidedBy: facts.firstDecidedBy,
      actorUserId: scope.userId,
      employeeUserId: facts.employeeUserId,
      submittedByUserId: facts.submittedBy,
      isManager: facts.managerUserId === scope.userId,
      inScope:
        scope.level === "all" ||
        (scope.level === "team" && scope.teamIds.includes(facts.teamId)),
      scopeLevel: scope.level,
    }).ok;
  }

  /** Submitted days waiting for the caller: the first approval for the
   * reporting manager / team, the second (or the only) for HR. */
  async findAwaiting(query: AwaitingQueryDto) {
    const scope = await this.teamContext.resolveScope(APPROVE);
    const rows = await this.loadRows(scope, {
      statuses: ["SUBMITTED"],
      employeeId: query.employeeId,
    });
    const days = groupDays(rows)
      .filter((d) => this.canDecide(scope, d))
      .map((d) => d.summary);
    return paginate(days, query.page, query.limit);
  }

  /** Submitted, approved and returned days in the caller's reach. */
  async findAll(query: ReviewListQueryDto) {
    const scope = await this.teamContext.resolveScope(READ);
    // No dates means "recent": the whole history is never loaded for a list.
    const from =
      query.from === undefined && query.to === undefined
        ? addDays(businessToday(), -DEFAULT_LIST_DAYS)
        : query.from;
    const rows = await this.loadRows(scope, {
      statuses: query.status
        ? [query.status]
        : ["SUBMITTED", "APPROVED", "REJECTED"],
      from,
      to: query.to,
      employeeId: query.employeeId,
    });
    return paginate(
      groupDays(rows).map((d) => d.summary),
      query.page,
      query.limit,
    );
  }

  /** One day for a reviewer: the rows, sessions, totals, HR's attendance now,
   * and the flags (including a change of attendance since it was submitted). */
  async findDay(employeeId: number, date: string) {
    const scope = await this.teamContext.resolveScope(READ);
    const rows = await this.repository.findReviewDay(scope, employeeId, date);
    const lead = rows[0];
    if (!lead) {
      throw new ResourceNotFoundException("Timesheet", `${employeeId}/${date}`);
    }

    const grouped = groupDays(rows)[0]!;
    const attendance = (
      await this.attendance.dayStatuses(
        this.tenantContext.getOrgScope(),
        {
          id: lead.employee.id,
          teamId: lead.employee.teamId,
          workLocationId: lead.employee.workLocationId,
        },
        date,
        date,
      )
    ).get(date);

    const flags = flagsForDay({
      date,
      today: businessToday(),
      attendanceStatus: attendance?.status ?? null,
      totalMinutes: grouped.summary.totalMinutes,
      sessionReviewStates: rows.flatMap((r) =>
        r.sessions.map((s) => s.reviewState),
      ),
      attendanceStatusAtSubmit: lead.attendanceStatusAtSubmit,
    });

    // The caller may be allowed to read but not decide: ask the approve scope.
    const approveScope = await this.approveScopeOrNull();
    const canDecide =
      approveScope !== null && this.canDecide(approveScope, grouped);
    // Only HR (.all) reopens an approved day or confirms a timer's end, and
    // never for themselves.
    const isHr =
      approveScope?.level === "all" &&
      grouped.facts.employeeUserId !== approveScope.userId;

    return {
      ...grouped.summary,
      canDecide,
      canReopen: isHr && grouped.summary.status === "APPROVED",
      canCorrect: isHr,
      attendance: attendance
        ? {
            status: attendance.status,
            workedMinutes: attendance.workedMinutes,
            overtimeMinutes: attendance.overtimeMinutes,
            targetMinutes: attendance.targetMinutes,
          }
        : null,
      attendanceStatusAtSubmit: lead.attendanceStatusAtSubmit,
      flags,
      rows: rows.map((r) => ({
        id: r.id,
        category: r.category,
        title: r.title,
        description: r.description,
        notes: r.notes,
        taskCode: r.task?.taskCode ?? null,
        projectName: r.project?.name ?? null,
        dailyStatus: r.dailyStatus,
        isBackdated: r.isBackdated,
        lateEntryReason: r.lateEntryReason,
        startedAt: r.startedAt,
        endedAt: r.endedAt,
        durationMinutes:
          r.category === "TASK"
            ? r.sessions.reduce(
                (n, s) => (s.endedAt ? n + s.durationMinutes : n),
                0,
              )
            : (r.durationMinutes ?? 0),
        sessions: r.sessions,
      })),
    };
  }

  private async approveScopeOrNull(): Promise<TeamScope | null> {
    try {
      return await this.teamContext.resolveScope(APPROVE);
    } catch (error) {
      if (error instanceof ForbiddenException) return null;
      throw error;
    }
  }

  /** `findReviewRows` with a row cap, as a business error instead of a crash. */
  private async loadRows(scope: TeamScope, filter: ReviewFilter) {
    try {
      return await this.repository.findReviewRows(scope, {
        maxRows: MAX_REPORT_ROWS,
        ...filter,
      });
    } catch (error) {
      if (error instanceof ReviewRowLimitError) {
        throw new BusinessRuleViolationException(
          "That is too many timesheets to load at once; narrow the date range, team or employee",
          "TIMESHEET_REPORT_TOO_LARGE",
        );
      }
      throw error;
    }
  }

  // ---- reopen and correction (HR) --------------------------------------------

  /** HR sends an approved day back to the employee, with a reason. */
  async reopen(employeeId: number, date: string, note: string | undefined) {
    const scope = await this.teamContext.resolveScope(APPROVE);
    const outcome = await this.repository.reopenDay(
      scope,
      employeeId,
      date,
      note,
    );
    if (outcome.kind === "not_found") {
      throw new ResourceNotFoundException("Timesheet", `${employeeId}/${date}`);
    }
    await this.notifier.dayChanged(
      {
        employeeId,
        employeeName: outcome.employeeName,
        employeeCode: outcome.employeeCode,
        employeeUserId: outcome.employeeUserId,
        date,
      },
      { kind: "reopened", note: note?.trim() || null },
    );
    return {
      employeeId,
      date,
      status: "REJECTED" as const,
      rowCount: outcome.rowCount,
    };
  }

  /** HR confirms the real end of a session that was closed with no time
   * counted (or flagged for review). Works on submitted and approved days. */
  async correctSession(sessionId: number, dto: CorrectSessionDto) {
    const scope = await this.teamContext.resolveScope(APPROVE);
    if (scope.level !== "all") {
      throw new ForbiddenException("Only HR can correct a timer");
    }
    const reason = dto.reason.trim();
    if (reason.length < 3) {
      throw new BusinessRuleViolationException(
        "A reason is required to correct a timer",
        "TIMESHEET_DECISION_NOTE_REQUIRED",
      );
    }
    const result = await this.lifecycle.correctSessionEnd({
      sessionId,
      endTime: dto.endTime,
      reason,
    });
    await this.notifier.dayChanged(
      {
        employeeId: result.employeeId,
        employeeName: result.employeeName,
        employeeCode: result.employeeCode,
        employeeUserId: result.employeeUserId,
        date: result.workDate,
      },
      {
        kind: "corrected",
        fromMinutes: result.previousMinutes,
        toMinutes: result.minutes,
      },
    );
    return {
      sessionId: result.sessionId,
      employeeId: result.employeeId,
      date: result.workDate,
      minutes: result.minutes,
      previousMinutes: result.previousMinutes,
    };
  }

  // ---- counts and reports -------------------------------------------------------

  /** The numbers on top of the review screen, within the caller's reach. */
  async summary() {
    const scope = await this.teamContext.resolveScope(READ);
    const month = businessToday().slice(0, 7);
    const [submitted, returned, approved] = await Promise.all([
      this.loadRows(scope, { statuses: ["SUBMITTED"] }),
      this.loadRows(scope, { statuses: ["REJECTED"] }),
      this.loadRows(scope, { statuses: ["APPROVED"], from: `${month}-01` }),
    ]);
    const waiting = groupDays(submitted);
    const approveScope = await this.approveScopeOrNull();
    return {
      month,
      awaitingMe: approveScope
        ? waiting.filter((d) => this.canDecide(approveScope, d)).length
        : null,
      submitted: waiting.length,
      needsAttention: waiting.filter((d) => d.summary.needsAttention).length,
      returned: groupDays(returned).length,
      approvedThisMonth: groupDays(approved).length,
    };
  }

  private assertReportRange(query: ReportQueryDto) {
    if (query.from > query.to) {
      throw new BusinessRuleViolationException(
        "The start date must not be after the end date",
        "INVALID_DATE_RANGE",
      );
    }
    const span =
      Math.round(
        (Date.parse(`${query.to}T00:00:00Z`) -
          Date.parse(`${query.from}T00:00:00Z`)) /
          86_400_000,
      ) + 1;
    if (span > MAX_REPORT_DAYS) {
      throw new BusinessRuleViolationException(
        `The date range may span at most ${MAX_REPORT_DAYS} days`,
        "DATE_RANGE_TOO_LARGE",
      );
    }
  }

  private async reportDays(prefix: string, query: ReportQueryDto) {
    this.assertReportRange(query);
    const scope = await this.teamContext.resolveScope(prefix);
    const rows = await this.loadRows(scope, {
      statuses: ["DRAFT", "SUBMITTED", "APPROVED", "REJECTED"],
      from: query.from,
      to: query.to,
      teamId: query.teamId,
      employeeId: query.employeeId,
    });
    return groupDays(rows).map((d) => d.summary);
  }

  /** One line per employee: hours and how many days are in each review state. */
  async employeeReport(query: ReportQueryDto) {
    const days = await this.reportDays(READ, query);
    return {
      from: query.from,
      to: query.to,
      lines: buildEmployeeReport(days),
    };
  }

  /** One line per employee per day with work (drafts included): what the Week
   * grid draws. Same reach, range and row cap as the per-employee report. */
  async dayReport(query: ReportQueryDto) {
    const days = await this.reportDays(READ, query);
    return { from: query.from, to: query.to, days };
  }

  async employeeReportCsv(query: ReportQueryDto): Promise<string> {
    const days = await this.reportDays(EXPORT, query);
    return toCsv(
      EMPLOYEE_REPORT_HEADERS,
      buildEmployeeReport(days).map(employeeReportRow),
    );
  }

  async dayReportCsv(query: ReportQueryDto): Promise<string> {
    const days = await this.reportDays(EXPORT, query);
    return toCsv(DAY_REPORT_HEADERS, days.map(dayReportRow));
  }

  approve(employeeId: number, date: string, note: string | undefined) {
    return this.decide(employeeId, date, "approve", note);
  }

  reject(employeeId: number, date: string, note: string | undefined) {
    return this.decide(employeeId, date, "reject", note);
  }

  private async decide(
    employeeId: number,
    date: string,
    action: "approve" | "reject",
    note: string | undefined,
  ) {
    const scope = await this.teamContext.resolveScope(APPROVE);
    const outcome = await this.repository.decide(scope, employeeId, date, {
      action,
      ...(note !== undefined ? { note } : {}),
    });
    if (outcome.kind === "not_found") {
      throw new ResourceNotFoundException("Timesheet", `${employeeId}/${date}`);
    }
    const day = {
      employeeId,
      employeeName: outcome.employeeName,
      employeeCode: outcome.employeeCode,
      employeeUserId: outcome.employeeUserId,
      date,
    };
    const trimmed = note?.trim() || null;
    if (action === "reject") {
      await this.notifier.dayChanged(day, { kind: "rejected", note: trimmed });
    } else if (outcome.final) {
      await this.notifier.dayChanged(day, { kind: "approved", note: trimmed });
    } else {
      await this.notifier.dayChanged(day, {
        kind: "first_approved",
        firstDecidedBy: scope.userId,
      });
    }
    return {
      employeeId,
      date,
      status:
        action === "reject"
          ? ("REJECTED" as const)
          : outcome.final
            ? ("APPROVED" as const)
            : ("SUBMITTED" as const),
      stage: outcome.stage,
      override: outcome.override,
      rowCount: outcome.rowCount,
    };
  }
}
