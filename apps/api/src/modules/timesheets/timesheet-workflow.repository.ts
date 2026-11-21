import { ForbiddenException, Injectable } from "@nestjs/common";
import type { Prisma } from "@texawave-erp/database";
import { parseDateOnly } from "../../common/dates/date-only.js";
import { OrgScoped } from "../../common/decorators/org-scoped.decorator.js";
import { TeamScoped } from "../../common/decorators/team-scoped.decorator.js";
import { BusinessRuleViolationException } from "../../common/exceptions/business.exception.js";
import type { OrgScope } from "../../common/tenancy/org-scope.js";
import type { TeamScope } from "../../common/tenancy/team-scope.js";
import { AuditWriter } from "../../platform/audit/audit-writer.js";
import { PrismaService } from "../../shared/prisma/prisma.service.js";
import { isTeamLead, leadsOfTeam } from "../../shared/team-leads/team-leads.js";
import { TimesheetDayService } from "./core/timesheet-day.service.js";
import {
  approvalVerdict,
  APPROVAL_REFUSAL_MESSAGE,
  dayWorkflowStatus,
} from "./timesheet-approval.js";
import {
  applyTimesheetAction,
  assertDecisionNote,
  type TimesheetAction,
} from "./timesheets.rules.js";

/** What a review list reads for every row; grouped into days by the service. */
const REVIEW_ROW_SELECT = {
  id: true,
  employeeId: true,
  workDate: true,
  status: true,
  origin: true,
  category: true,
  durationMinutes: true,
  endedAt: true,
  approvalLevels: true,
  approverBasis: true,
  attendanceStatusAtSubmit: true,
  submittedAt: true,
  submittedBy: true,
  firstDecidedAt: true,
  firstDecidedBy: true,
  firstDecisionNote: true,
  decidedAt: true,
  decidedBy: true,
  decisionNote: true,
  employee: {
    select: {
      id: true,
      employeeCode: true,
      fullName: true,
      userId: true,
      teamId: true,
      workLocationId: true,
      team: { select: { name: true } },
      reportsTo: { select: { userId: true } },
    },
  },
  sessions: {
    select: { endedAt: true, durationMinutes: true, reviewState: true },
  },
} satisfies Prisma.TimesheetSelect;

export type ReviewRow = Prisma.TimesheetGetPayload<{
  select: typeof REVIEW_ROW_SELECT;
}>;

export interface SubmitFacts {
  /** IST today (a day in the future cannot be submitted). */
  today: string;
  /** HR's status for the day now, kept on the rows to spot later changes. */
  attendanceStatus: string | null;
}

export interface SubmitResult {
  rowCount: number;
  approvalLevels: 1 | 2;
  approverBasis: "TEAM" | "HR";
  /** The team lead(s) who now owe the first approval, to be told; empty for a
   * one-level day (it goes to HR). */
  leadUserIds: number[];
}

/** The team-lead level of timesheet approval (the Team Lead role grants it). */
const TEAM_APPROVE_CODE = "hr.timesheet.approve.team";

export type DecideOutcome =
  | { kind: "not_found" }
  | {
      kind: "ok";
      final: boolean;
      override: boolean;
      stage: 1 | 2;
      rowCount: number;
      employeeUserId: number | null;
      employeeName: string;
      employeeCode: string;
      firstDecidedBy: number | null;
    };

/** Thrown by `findReviewRows` when a request would load more rows than it may. */
export class ReviewRowLimitError extends Error {}

export interface ReviewFilter {
  /** Stop (and refuse) beyond this many rows, so a wide range cannot load the
   * whole table. */
  maxRows?: number;
  statuses: readonly string[];
  teamId?: number | undefined;
  from?: string | undefined;
  to?: string | undefined;
  employeeId?: number | undefined;
}

/** Whose days a caller's `hr.timesheet` scope reaches: the employee's reporting
 * manager (every level), the caller's teams (`.team`), or everyone (`.all`).
 * The caller's own days are never in a review list. */
function reviewableEmployees(scope: TeamScope): Prisma.EmployeeWhereInput {
  const reach: Prisma.EmployeeWhereInput =
    scope.level === "all"
      ? {}
      : {
          OR: [
            { reportsTo: { userId: scope.userId } },
            ...(scope.level === "team"
              ? [{ teamId: { in: scope.teamIds } }]
              : []),
          ],
        };
  return { AND: [reach, { NOT: { userId: scope.userId } }] };
}

/**
 * Submit and decide timesheet days. Every write is one transaction under the
 * employee's timesheet lock (the same lock the timer and custom activities
 * take), so a submit cannot interleave with a late edit and two approvers
 * cannot both decide. Submit and every decision act on ALL rows of the
 * employee-day together; the audit log records each step.
 */
@Injectable()
export class TimesheetWorkflowRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly day: TimesheetDayService,
    private readonly audit: AuditWriter,
  ) {}

  // ---- employee: submit -----------------------------------------------------

  @OrgScoped()
  submitDay(
    scope: OrgScope,
    employeeId: number,
    userId: number,
    date: string,
    facts: SubmitFacts,
  ): Promise<SubmitResult> {
    return this.prisma.$transaction(async (tx) => {
      await this.day.lockEmployee(tx, scope.organizationId, employeeId);

      if (date > facts.today) {
        throw new BusinessRuleViolationException(
          "A day in the future cannot be submitted",
          "TIMESHEET_FUTURE_DAY",
        );
      }
      const rows = await tx.timesheet.findMany({
        where: {
          organizationId: scope.organizationId,
          employeeId,
          workDate: parseDateOnly(date),
          deletedAt: null,
        },
        select: {
          id: true,
          status: true,
          sessions: { select: { endedAt: true } },
        },
      });
      if (
        rows.some((r) => r.status === "SUBMITTED" || r.status === "APPROVED")
      ) {
        throw new BusinessRuleViolationException(
          `The timesheet for ${date} is already submitted or approved`,
          "TIMESHEET_ALREADY_SUBMITTED",
        );
      }
      const submittable = rows.filter(
        (r) => r.status === "DRAFT" || r.status === "REJECTED",
      );
      if (submittable.length === 0) {
        throw new BusinessRuleViolationException(
          `There is no work recorded for ${date} to submit`,
          "TIMESHEET_NOTHING_TO_SUBMIT",
        );
      }
      // A running timer's time is not in the day yet; the reviewer would be
      // approving hours that are about to change.
      if (rows.some((r) => r.sessions.some((s) => s.endedAt === null))) {
        throw new BusinessRuleViolationException(
          "A timer is still running on this day. Stop it before submitting",
          "TIMESHEET_OPEN_SESSION",
        );
      }

      // Routing: the lead of the employee's team (a team-level approver
      // assigned to the team) gives the first approval and HR the second. A
      // team lead's own day, or a day from a team with no lead, goes to HR
      // alone - never to someone who cannot act.
      const employee = await tx.employee.findFirstOrThrow({
        where: { id: employeeId, organizationId: scope.organizationId },
        select: { userId: true, teamId: true },
      });
      const employeeIsLead =
        employee.userId !== null &&
        (await tx.user.count({
          where: isTeamLead(
            scope.organizationId,
            employee.userId,
            TEAM_APPROVE_CODE,
          ),
        })) > 0;
      const leads = employeeIsLead
        ? []
        : await tx.userTeamAccess.findMany({
            where: leadsOfTeam({
              organizationId: scope.organizationId,
              teamId: employee.teamId,
              teamApproveCode: TEAM_APPROVE_CODE,
              excludeUserId: employee.userId,
            }),
            select: { userId: true },
          });
      const hasLead = leads.length > 0;
      const approvalLevels = hasLead ? 2 : 1;
      const approverBasis = hasLead ? "TEAM" : "HR";

      const ids = submittable.map((r) => r.id);
      const wasReturned = submittable.some((r) => r.status === "REJECTED");
      await tx.timesheet.updateMany({
        where: { id: { in: ids }, status: { in: ["DRAFT", "REJECTED"] } },
        data: {
          status: "SUBMITTED",
          submittedAt: new Date(),
          submittedBy: userId,
          approverEmployeeId: null,
          approverBasis,
          approvalLevels,
          attendanceStatusAtSubmit: facts.attendanceStatus,
          decidedAt: null,
          decidedBy: null,
          decisionNote: null,
          firstDecidedAt: null,
          firstDecidedBy: null,
          firstDecisionNote: null,
          version: { increment: 1 },
          updatedBy: userId,
        },
      });
      await this.audit.write(tx, {
        entityType: "timesheet_day",
        entityId: ids[0]!,
        action: "submit",
        after: {
          employeeId,
          workDate: date,
          rows: ids.length,
          approvalLevels,
          approverBasis,
          attendanceStatus: facts.attendanceStatus,
          resubmitted: wasReturned,
        },
      });
      return {
        rowCount: ids.length,
        approvalLevels,
        approverBasis,
        leadUserIds: leads.map((l) => l.userId),
      };
    });
  }

  // ---- reviewer: decide -----------------------------------------------------

  /** Approve or reject one submitted day. `not_found` = the day does not exist
   * or the caller has no authority over the employee (404, never 403). Any
   * other refusal is a 403 with the reason. */
  @TeamScoped()
  decide(
    scope: TeamScope,
    employeeId: number,
    date: string,
    decision: {
      action: Extract<TimesheetAction, "approve" | "reject">;
      note?: string;
    },
  ): Promise<DecideOutcome> {
    return this.prisma.$transaction(async (tx) => {
      await this.day.lockEmployee(tx, scope.organizationId, employeeId);
      const rows = await tx.timesheet.findMany({
        where: {
          organizationId: scope.organizationId,
          employeeId,
          workDate: parseDateOnly(date),
          deletedAt: null,
        },
        select: REVIEW_ROW_SELECT,
      });
      const first = rows[0];
      if (!first) return { kind: "not_found" } as const;

      const employee = first.employee;
      const submitted = rows.filter((r) => r.status === "SUBMITTED");
      const lead = submitted[0] ?? first;
      const verdict = approvalVerdict({
        approvalLevels: lead.approvalLevels === 2 ? 2 : 1,
        firstDecidedAt: lead.firstDecidedAt,
        firstDecidedBy: lead.firstDecidedBy,
        actorUserId: scope.userId,
        employeeUserId: employee.userId,
        submittedByUserId: lead.submittedBy,
        // Only a day routed before team-lead routing still waits for the
        // reporting manager; every newer day goes to the team lead (inScope).
        isManager:
          lead.approverBasis === "REPORTING_MANAGER" &&
          employee.reportsTo?.userId === scope.userId,
        inScope:
          scope.level === "all" ||
          (scope.level === "team" && scope.teamIds.includes(employee.teamId)),
        scopeLevel: scope.level,
      });
      if (!verdict.ok) {
        if (verdict.reason === "NOT_VISIBLE")
          return { kind: "not_found" } as const;
        throw new ForbiddenException(APPROVAL_REFUSAL_MESSAGE[verdict.reason]);
      }

      // The day must be waiting for a decision.
      const status = dayWorkflowStatus(rows.map((r) => r.status));
      applyTimesheetAction(status ?? "DRAFT", decision.action);
      assertDecisionNote(decision.action, decision.note);
      const note = decision.note?.trim() || null;

      const ids = submitted.map((r) => r.id);
      const now = new Date();
      let action: string;
      if (decision.action === "reject") {
        action = "reject";
        await tx.timesheet.updateMany({
          where: { id: { in: ids }, status: "SUBMITTED" },
          data: {
            status: "REJECTED",
            decidedAt: now,
            decidedBy: scope.userId,
            decisionNote: note,
            version: { increment: 1 },
            updatedBy: scope.userId,
          },
        });
      } else if (!verdict.final) {
        action = "first_approve";
        await tx.timesheet.updateMany({
          where: { id: { in: ids }, status: "SUBMITTED" },
          data: {
            firstDecidedAt: now,
            firstDecidedBy: scope.userId,
            firstDecisionNote: note,
            version: { increment: 1 },
            updatedBy: scope.userId,
          },
        });
      } else {
        action = verdict.override ? "override_approve" : "approve";
        await tx.timesheet.updateMany({
          where: { id: { in: ids }, status: "SUBMITTED" },
          data: {
            status: "APPROVED",
            decidedAt: now,
            decidedBy: scope.userId,
            decisionNote: note,
            version: { increment: 1 },
            updatedBy: scope.userId,
          },
        });
      }
      await this.audit.write(tx, {
        entityType: "timesheet_day",
        entityId: ids[0]!,
        action,
        after: {
          employeeId,
          workDate: date,
          rows: ids.length,
          stage: verdict.stage,
          final: decision.action === "reject" ? true : verdict.final,
        },
        reason: note ?? undefined,
      });
      return {
        kind: "ok",
        final: decision.action === "reject" ? true : verdict.final,
        override: verdict.override,
        stage: verdict.stage,
        rowCount: ids.length,
        employeeUserId: employee.userId,
        employeeName: employee.fullName,
        employeeCode: employee.employeeCode,
        firstDecidedBy: lead.firstDecidedBy,
      } as const;
    });
  }

  /** HR sends an approved day back to the employee with a reason (the day
   * becomes `REJECTED`, editable and resubmittable, and the review starts
   * over). Only `.all` (HR); never one's own day. */
  @TeamScoped()
  reopenDay(
    scope: TeamScope,
    employeeId: number,
    date: string,
    note: string | undefined,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await this.day.lockEmployee(tx, scope.organizationId, employeeId);
      const rows = await tx.timesheet.findMany({
        where: {
          organizationId: scope.organizationId,
          employeeId,
          workDate: parseDateOnly(date),
          deletedAt: null,
        },
        select: REVIEW_ROW_SELECT,
      });
      const first = rows[0];
      // Not HR, or no such day: say nothing about whether the day exists.
      if (!first || scope.level !== "all") {
        return { kind: "not_found" } as const;
      }
      if (first.employee.userId === scope.userId) {
        throw new ForbiddenException("You cannot reopen your own timesheet");
      }
      const status = dayWorkflowStatus(rows.map((r) => r.status));
      applyTimesheetAction(status ?? "DRAFT", "reopen");
      assertDecisionNote("reopen", note);

      const ids = rows.filter((r) => r.status === "APPROVED").map((r) => r.id);
      await tx.timesheet.updateMany({
        where: { id: { in: ids }, status: "APPROVED" },
        data: {
          status: "REJECTED",
          decidedAt: new Date(),
          decidedBy: scope.userId,
          decisionNote: note!.trim(),
          firstDecidedAt: null,
          firstDecidedBy: null,
          firstDecisionNote: null,
          version: { increment: 1 },
          updatedBy: scope.userId,
        },
      });
      await this.audit.write(tx, {
        entityType: "timesheet_day",
        entityId: ids[0]!,
        action: "reopen",
        after: { employeeId, workDate: date, rows: ids.length },
        reason: note!.trim(),
      });
      return {
        kind: "ok",
        rowCount: ids.length,
        employeeUserId: first.employee.userId,
        employeeName: first.employee.fullName,
        employeeCode: first.employee.employeeCode,
      } as const;
    });
  }

  // ---- reads ---------------------------------------------------------------

  /** Rows in the caller's reach whose status is one of `filter.statuses`. */
  @TeamScoped()
  async findReviewRows(
    scope: TeamScope,
    filter: ReviewFilter,
  ): Promise<ReviewRow[]> {
    const rows = await this.prisma.timesheet.findMany({
      ...(filter.maxRows !== undefined ? { take: filter.maxRows + 1 } : {}),
      where: {
        organizationId: scope.organizationId,
        deletedAt: null,
        status: { in: [...filter.statuses] },
        ...(filter.from !== undefined || filter.to !== undefined
          ? {
              workDate: {
                ...(filter.from !== undefined
                  ? { gte: parseDateOnly(filter.from) }
                  : {}),
                ...(filter.to !== undefined
                  ? { lte: parseDateOnly(filter.to) }
                  : {}),
              },
            }
          : {}),
        ...(filter.employeeId !== undefined
          ? { employeeId: filter.employeeId }
          : {}),
        employee:
          filter.teamId !== undefined
            ? {
                AND: [reviewableEmployees(scope), { teamId: filter.teamId }],
              }
            : reviewableEmployees(scope),
      },
      select: REVIEW_ROW_SELECT,
      orderBy: [{ workDate: "desc" }, { employeeId: "asc" }, { id: "asc" }],
    });
    if (filter.maxRows !== undefined && rows.length > filter.maxRows) {
      throw new ReviewRowLimitError();
    }
    return rows;
  }

  /** The employee, if they are in the caller's reach (never the caller). */
  @TeamScoped()
  findReviewableEmployee(scope: TeamScope, employeeId: number) {
    return this.prisma.employee.findFirst({
      where: {
        AND: [
          { id: employeeId, organizationId: scope.organizationId },
          reviewableEmployees(scope),
        ],
      },
      select: {
        id: true,
        employeeCode: true,
        fullName: true,
        teamId: true,
        workLocationId: true,
        team: { select: { name: true } },
      },
    });
  }

  /** The attendance references (team and location) of these employees. */
  @OrgScoped()
  findEmployeeRefs(scope: OrgScope, employeeIds: readonly number[]) {
    return this.prisma.employee.findMany({
      where: {
        organizationId: scope.organizationId,
        id: { in: [...employeeIds] },
      },
      select: { id: true, teamId: true, workLocationId: true },
    });
  }

  /** Every row of one employee-day, if the employee is in the caller's reach. */
  @TeamScoped()
  findReviewDay(
    scope: TeamScope,
    employeeId: number,
    date: string,
    includeDrafts = false,
  ) {
    return this.prisma.timesheet.findMany({
      where: {
        organizationId: scope.organizationId,
        employeeId,
        workDate: parseDateOnly(date),
        deletedAt: null,
        // A reviewer's queue never shows a day the employee has not submitted;
        // the employee drill-down asks for them explicitly (read-only).
        ...(includeDrafts ? {} : { status: { not: "DRAFT" } }),
        employee: reviewableEmployees(scope),
      },
      select: {
        ...REVIEW_ROW_SELECT,
        title: true,
        description: true,
        notes: true,
        dailyStatus: true,
        startedAt: true,
        lateEntryReason: true,
        isBackdated: true,
        task: { select: { taskCode: true } },
        project: { select: { name: true } },
        sessions: {
          orderBy: { startedAt: "asc" },
          select: {
            id: true,
            startedAt: true,
            endedAt: true,
            durationMinutes: true,
            closedReason: true,
            reviewState: true,
          },
        },
      },
      orderBy: { id: "asc" },
    });
  }

  /** Active users holding `hr.timesheet.approve.all` (HR), to be told that a day
   * waits for the second approval. */
  @OrgScoped()
  async hrApproverUserIds(scope: OrgScope): Promise<number[]> {
    const rows = await this.prisma.user.findMany({
      where: {
        organizationId: scope.organizationId,
        isActive: true,
        deletedAt: null,
        userRoles: {
          some: {
            isActive: true,
            role: {
              organizationId: scope.organizationId,
              isActive: true,
              rolePermissions: {
                some: {
                  isActive: true,
                  permission: {
                    code: "hr.timesheet.approve.all",
                    isActive: true,
                  },
                },
              },
            },
          },
        },
      },
      select: { id: true },
    });
    return rows.map((r) => r.id);
  }
}
