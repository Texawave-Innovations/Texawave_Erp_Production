import { HttpStatus, Injectable } from "@nestjs/common";
import { Prisma } from "@texawave-erp/database";
import { classifyDbError } from "../../../common/database/db-errors.js";
import {
  formatDateOnly,
  inclusiveDays,
  parseDateOnly,
} from "../../../common/dates/date-only.js";
import { OrgScoped } from "../../../common/decorators/org-scoped.decorator.js";
import { TeamScoped } from "../../../common/decorators/team-scoped.decorator.js";
import type { PaginationDto } from "../../../common/dto/pagination.dto.js";
import {
  BusinessException,
  BusinessRuleConflictException,
  BusinessRuleViolationException,
  InvalidStateTransitionException,
} from "../../../common/exceptions/business.exception.js";
import type { OrgScope } from "../../../common/tenancy/org-scope.js";
import type { TeamScope } from "../../../common/tenancy/team-scope.js";
import { teamWhere } from "../../../common/tenancy/team-where.js";
import { tenantWhere } from "../../../common/tenancy/tenant-where.js";
import { AuditWriter } from "../../../platform/audit/audit-writer.js";
import { PrismaService } from "../../../shared/prisma/prisma.service.js";
import { AttendanceDayContextRepository } from "../attendance/attendance-day-context.repository.js";
import { AttendanceMonthLockedException } from "../attendance/attendance.exceptions.js";
import { LOCKED_STATUSES } from "../attendance/month-locks/month-lock.rules.js";
import { resolveCalendar } from "../attendance/services/attendance-day-resolver.js";
import {
  type ApprovalRefusal,
  approvalVerdict,
  awaitingStage,
  type AwaitingStage,
  type BalanceFacts,
  type BalancePolicy,
  canTransition,
  countLeaveDays,
  covers,
  type DayPortion,
  type LeaveStatus,
  monthsTouched,
  OPEN_STATUSES,
  requestsConflict,
  spansYears,
  yearBalance,
  type YearBalance,
} from "./leave-domain.js";
import type { LeaveStatus as DtoLeaveStatus } from "./dto/leave-request.dto.js";

const ENTITY_TYPE = "leave_request";
const ENTITLEMENT_ENTITY = "leave_entitlement";
const EXIT_STATUSES = ["RESIGNED", "TERMINATED"];
/** Team/own scope reaches leave requests THROUGH the employee. */
const VIA_EMPLOYEE = {
  teamField: "employee.teamId",
  ownerField: "employee.userId",
};

const INCLUDE = {
  employee: {
    select: {
      id: true,
      employeeCode: true,
      fullName: true,
      userId: true,
      teamId: true,
      reportsTo: { select: { userId: true } },
    },
  },
  leaveType: { select: { id: true, code: true, name: true } },
  decider: { select: { id: true, fullName: true } },
  firstDecider: { select: { id: true, fullName: true } },
  canceller: { select: { id: true, fullName: true } },
  requester: { select: { id: true, fullName: true } },
} satisfies Prisma.LeaveRequestInclude;
type LeaveRow = Prisma.LeaveRequestGetPayload<{ include: typeof INCLUDE }>;

type UserRef = { id: number; fullName: string };

export interface LeaveRequestView {
  id: number;
  employee: { id: number; employeeCode: string; fullName: string };
  leaveType: { id: number; code: string; name: string };
  startDate: string;
  endDate: string;
  dayPortion: DayPortion;
  /** Working days consumed (weekly-offs and holidays excluded; half = 0.5). */
  leaveDays: number;
  /** Inclusive calendar days, kept for history. Not what balances consume. */
  calendarDays: number;
  reason: string;
  status: LeaveStatus;
  /** 1 or 2 approvals, fixed at (re)submission. */
  approvalLevels: number;
  /** Who a PENDING request waits for; null once it is no longer pending. */
  awaiting: AwaitingStage | null;
  /** Who submitted it: the employee, or HR on the employee's behalf. */
  requestedBy: UserRef;
  firstDecidedBy: UserRef | null;
  firstDecidedAt: Date | null;
  firstDecisionNote: string | null;
  decidedBy: UserRef | null;
  decidedAt: Date | null;
  decisionNote: string | null;
  cancelledBy: UserRef | null;
  cancelledAt: Date | null;
  cancellationNote: string | null;
  createdAt: Date;
}

export function toView(row: LeaveRow): LeaveRequestView {
  return {
    id: row.id,
    employee: {
      id: row.employee.id,
      employeeCode: row.employee.employeeCode,
      fullName: row.employee.fullName,
    },
    leaveType: row.leaveType,
    startDate: formatDateOnly(row.startDate),
    endDate: formatDateOnly(row.endDate),
    dayPortion: row.dayPortion as DayPortion,
    leaveDays: row.leaveDays.toNumber(),
    calendarDays: inclusiveDays(row.startDate, row.endDate),
    reason: row.reason,
    status: row.status as LeaveStatus,
    approvalLevels: row.approvalLevels,
    awaiting: awaitingStage(row),
    requestedBy: row.requester,
    firstDecidedBy: row.firstDecider,
    firstDecidedAt: row.firstDecidedAt,
    firstDecisionNote: row.firstDecisionNote,
    decidedBy: row.decider,
    decidedAt: row.decidedAt,
    decisionNote: row.decisionNote,
    cancelledBy: row.canceller,
    cancelledAt: row.cancelledAt,
    cancellationNote: row.cancellationNote,
    createdAt: row.createdAt,
  };
}

/** Free text (the reason, the decision and cancellation notes) stays out of
 * the audit snapshot; it lives on the request itself. */
function snapshot(row: LeaveRow) {
  return {
    employeeId: row.employee.id,
    leaveTypeId: row.leaveType.id,
    startDate: formatDateOnly(row.startDate),
    endDate: formatDateOnly(row.endDate),
    dayPortion: row.dayPortion,
    leaveDays: row.leaveDays.toNumber(),
    status: row.status,
    approvalLevels: row.approvalLevels,
    requestedBy: row.requestedBy,
    firstDecidedBy: row.firstDecider?.id ?? null,
    decidedBy: row.decider?.id ?? null,
    cancelledBy: row.canceller?.id ?? null,
  };
}

export class SelfApprovalForbiddenException extends BusinessException {
  constructor(submitted = false) {
    super(
      submitted
        ? "You cannot approve or reject a leave request you submitted on someone's behalf"
        : "You cannot approve or reject your own leave request",
      HttpStatus.FORBIDDEN,
      "SELF_APPROVAL_FORBIDDEN",
    );
  }
}

/** Stage 2 of a two-level request is HR's (`hr.leave.approve.all`). */
export class LeaveAwaitingHrException extends BusinessException {
  constructor() {
    super(
      "This request has its first approval and now waits for HR",
      HttpStatus.FORBIDDEN,
      "LEAVE_AWAITING_HR",
    );
  }
}

/** Two-level approval needs two different people. */
export class LeaveSameApproverException extends BusinessException {
  constructor() {
    super(
      "You gave the first approval; a different HR approver must give the second",
      HttpStatus.FORBIDDEN,
      "LEAVE_SAME_APPROVER",
    );
  }
}

/** HR endpoints act on other people's leave; one's own goes through
 * self-service, where the self-service rules apply. */
export class LeaveOwnViaSelfServiceException extends BusinessException {
  constructor() {
    super(
      "Use My Leave for your own leave requests",
      HttpStatus.FORBIDDEN,
      "LEAVE_OWN_VIA_SELF_SERVICE",
    );
  }
}

/** What `decide()` returns when the request is not one the actor may act on
 * (null) or the actor may see it but not decide it now. */
export type DecideOutcome =
  | { kind: "decided"; view: LeaveRequestView; stage: 1 | 2; final: boolean }
  | { kind: "not_found" };

/** Facts the notifier needs about one request (never sent to a client). */
export interface LeaveNotificationFacts {
  id: number;
  employeeId: number;
  employeeName: string;
  employeeCode: string;
  employeeUserId: number | null;
  teamId: number;
  managerUserId: number | null;
  leaveTypeName: string;
  startDate: string;
  endDate: string;
  leaveDays: number;
  status: LeaveStatus;
  requestedBy: number;
  firstDecidedBy: number | null;
  decidedBy: number | null;
  decisionNote: string | null;
  cancellationNote: string | null;
}

export const APPROVE_CODES = {
  own: "hr.leave.approve.own",
  team: "hr.leave.approve.team",
  all: "hr.leave.approve.all",
} as const;

export interface LeaveFilter {
  employeeId?: number | undefined;
  status?: DtoLeaveStatus | undefined;
  leaveTypeId?: number | undefined;
  from?: string | undefined;
  to?: string | undefined;
  sortBy?: "startDate" | "createdAt" | "status" | undefined;
}

export interface NewLeaveRequest {
  employeeId: number;
  leaveTypeId: number;
  startDate: string;
  endDate: string;
  reason: string;
  dayPortion?: DayPortion | undefined;
}

export interface LeaveBalanceView {
  leaveTypeId: number;
  code: string;
  name: string;
  isPaid: boolean;
  year: number;
  opening: number;
  entitlement: number;
  accrued: number;
  used: number;
  pending: number;
  /** null for unpaid leave: it is not balance-limited. */
  available: number | null;
}

export interface EmployeeBalanceRow {
  employee: {
    id: number;
    employeeCode: string;
    fullName: string;
    teamId: number;
  };
  balances: (LeaveBalanceView & {
    /** An entitlement override exists for this employee, type and year. */
    isOverride: boolean;
  })[];
}

export interface EntitlementView {
  employeeId: number;
  leaveTypeId: number;
  year: number;
  annualEntitlement: number | null;
}

function filterWhere(filter: LeaveFilter): Prisma.LeaveRequestWhereInput {
  return {
    deletedAt: null,
    ...(filter.employeeId !== undefined
      ? { employeeId: filter.employeeId }
      : {}),
    ...(filter.status ? { status: filter.status } : {}),
    ...(filter.leaveTypeId !== undefined
      ? { leaveTypeId: filter.leaveTypeId }
      : {}),
    // Range overlap: it ends on/after `from` and starts on/before `to`.
    ...(filter.from ? { endDate: { gte: parseDateOnly(filter.from) } } : {}),
    ...(filter.to ? { startDate: { lte: parseDateOnly(filter.to) } } : {}),
  };
}

/** Serialises every balance-affecting write for one employee. Taken before
 * any row lock, so the order is always employee → request. Transaction-scoped:
 * released on commit or rollback. */
async function lockEmployee(
  tx: Prisma.TransactionClient,
  organizationId: number,
  employeeId: number,
) {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`leave:${organizationId}:${employeeId}`}))::text`;
}

/**
 * Refuses a change to APPROVED leave that touches a month whose attendance is
 * SUBMITTED or APPROVED (409 ATTENDANCE_MONTH_LOCKED): approved leave is part
 * of that month's attendance, so approving or withdrawing it would silently
 * change a closed month. First takes the same per-employee lock attendance
 * changes and the month close take (`(organization, employee)`), so a month
 * cannot be closed between this check and the commit. Always taken after
 * `lockEmployee()`; nothing takes them in the other order.
 */
async function assertMonthsOpen(
  tx: Prisma.TransactionClient,
  organizationId: number,
  employeeId: number,
  start: string,
  end: string,
) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${organizationId}::int, ${employeeId}::int)`;
  const locked = await tx.attendanceMonthLock.findFirst({
    where: {
      organizationId,
      employeeId,
      month: { in: monthsTouched(start, end).map(parseDateOnly) },
      status: { in: [...LOCKED_STATUSES] },
      deletedAt: null,
    },
    orderBy: { month: "asc" },
    select: { month: true },
  });
  if (locked) {
    throw new AttendanceMonthLockedException(
      formatDateOnly(locked.month).slice(0, 7),
    );
  }
}

/** Today in the server's calendar (UTC), as YYYY-MM-DD. */
export function today(): string {
  return formatDateOnly(new Date());
}

/** Month (1–12) through which accrual counts for a balance viewed as of
 * `today`. Past years are complete; future years have no accrual yet. */
export function accrualMonthFor(year: number, asOf: string): number {
  const asOfYear = Number(asOf.slice(0, 4));
  if (year < asOfYear) return 12;
  if (year > asOfYear) return 0;
  return Number(asOf.slice(5, 7));
}

/** Only place `PrismaService` is called for leave requests. Reads through
 * `teamWhere()` (via the employee). Every write takes the employee's advisory
 * lock, then the request row lock, and writes its audit row in the same
 * transaction. */
@Injectable()
export class LeaveRequestsRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditWriter,
    private readonly calendar: AttendanceDayContextRepository,
  ) {}

  @TeamScoped()
  async findMany(
    scope: TeamScope,
    filter: LeaveFilter,
    pagination: PaginationDto,
  ) {
    const where: Prisma.LeaveRequestWhereInput = teamWhere(
      scope,
      filterWhere(filter),
      VIA_EMPLOYEE,
    );
    const [rows, total] = await Promise.all([
      this.prisma.leaveRequest.findMany({
        where,
        include: INCLUDE,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: [
          { [filter.sortBy ?? "startDate"]: pagination.order ?? "desc" },
          { id: "desc" },
        ],
      }),
      this.prisma.leaveRequest.count({ where }),
    ]);
    return { items: rows.map(toView), total };
  }

  @TeamScoped()
  async findOne(scope: TeamScope, id: number) {
    const row = await this.prisma.leaveRequest.findFirst({
      where: teamWhere(scope, { id, deletedAt: null }, VIA_EMPLOYEE),
      include: INCLUDE,
    });
    return row ? toView(row) : null;
  }

  /** The caller's OWN requests: `employeeId` is resolved from the JWT by the
   * service, never taken from the client. */
  @OrgScoped()
  async findMine(
    scope: OrgScope,
    employeeId: number,
    filter: LeaveFilter,
    pagination: PaginationDto,
  ) {
    const where = tenantWhere<Prisma.LeaveRequestWhereInput>(scope, {
      ...filterWhere({ ...filter, employeeId }),
    });
    const [rows, total] = await Promise.all([
      this.prisma.leaveRequest.findMany({
        where,
        include: INCLUDE,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: [
          { [filter.sortBy ?? "startDate"]: pagination.order ?? "desc" },
          { id: "desc" },
        ],
      }),
      this.prisma.leaveRequest.count({ where }),
    ]);
    return { items: rows.map(toView), total };
  }

  /** The caller's own request by id. Another employee's id is a plain 404. */
  @OrgScoped()
  async findMineOne(scope: OrgScope, employeeId: number, id: number) {
    const row = await this.prisma.leaveRequest.findFirst({
      where: tenantWhere<Prisma.LeaveRequestWhereInput>(scope, {
        id,
        employeeId,
        deletedAt: null,
      }),
      include: INCLUDE,
    });
    return row ? toView(row) : null;
  }

  /** Submits a request: by the employee (self-service, `submit`) or by HR on
   * the employee's behalf (`submit_on_behalf`; the caller has already checked
   * the employee is in HR's scope and is not HR's own record). */
  @OrgScoped()
  async create(
    scope: OrgScope,
    input: NewLeaveRequest,
    actorId: number,
    action: "submit" | "submit_on_behalf" = "submit",
  ): Promise<LeaveRequestView> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        await lockEmployee(tx, scope.organizationId, input.employeeId);
        const { days, portion, approvalLevels } = await this.validateRequest(
          tx,
          scope,
          input,
          null,
        );
        const created = await tx.leaveRequest.create({
          data: {
            organizationId: scope.organizationId,
            employeeId: input.employeeId,
            leaveTypeId: input.leaveTypeId,
            startDate: parseDateOnly(input.startDate),
            endDate: parseDateOnly(input.endDate),
            dayPortion: portion,
            leaveDays: days,
            reason: input.reason,
            status: "PENDING",
            approvalLevels,
            requestedBy: actorId,
            createdBy: actorId,
            updatedBy: actorId,
          },
          include: INCLUDE,
        });
        await this.audit.write(tx, {
          entityType: ENTITY_TYPE,
          entityId: created.id,
          action,
          after: snapshot(created),
        });
        return toView(created);
      });
    } catch (error) {
      throw await this.explainOverlap(
        error,
        scope.organizationId,
        input.employeeId,
        { start: input.startDate, end: input.endDate },
        null,
      );
    }
  }

  /**
   * Withdraws the employee's own PENDING request, or an APPROVED one that has
   * not started. Releases its balance and its Attendance effect (both derive
   * from status). Final for the request's history; resubmission is separate.
   */
  @OrgScoped()
  async cancel(
    scope: OrgScope,
    employeeId: number,
    id: number,
    note: string | undefined,
    actorId: number,
    asOf: string,
  ): Promise<LeaveRequestView | null> {
    return this.prisma.$transaction(async (tx) => {
      await lockEmployee(tx, scope.organizationId, employeeId);
      await tx.$queryRaw`
        SELECT id FROM hr.leave_requests
         WHERE id = ${id} AND organization_id = ${scope.organizationId} FOR UPDATE`;
      const before = await tx.leaveRequest.findFirst({
        where: {
          id,
          organizationId: scope.organizationId,
          employeeId,
          deletedAt: null,
        },
        include: INCLUDE,
      });
      if (!before) return null;

      if (
        before.status === "APPROVED" &&
        formatDateOnly(before.startDate) <= asOf
      ) {
        throw new BusinessRuleViolationException(
          "An approved leave cannot be cancelled once it has started",
          "LEAVE_ALREADY_STARTED",
        );
      }
      return this.applyCancel(tx, before, note ?? null, actorId, "cancel");
    });
  }

  /**
   * HR cancels someone's PENDING or APPROVED request — an approved one even
   * after it has started (e.g. the employee came back to work). Found through
   * the caller's `hr.leave.cancel` scope (else null → 404); never the
   * caller's own request (self-service has its own rules). A reason is
   * mandatory. Balance and Attendance follow from the status, as for any
   * cancellation; a closed attendance month is refused.
   */
  @TeamScoped()
  async hrCancel(
    scope: TeamScope,
    id: number,
    note: string,
    actorId: number,
  ): Promise<{ view: LeaveRequestView; previous: LeaveStatus } | null> {
    return this.prisma.$transaction(async (tx) => {
      const probe = await tx.leaveRequest.findFirst({
        where: { id, organizationId: scope.organizationId, deletedAt: null },
        select: { employeeId: true },
      });
      if (!probe) return null;
      await lockEmployee(tx, scope.organizationId, probe.employeeId);
      await tx.$queryRaw`
        SELECT id FROM hr.leave_requests
         WHERE id = ${id} AND organization_id = ${scope.organizationId} FOR UPDATE`;
      const before = await tx.leaveRequest.findFirst({
        where: teamWhere(scope, { id, deletedAt: null }, VIA_EMPLOYEE),
        include: INCLUDE,
      });
      if (!before) return null;
      if (
        before.employee.userId !== null &&
        before.employee.userId === actorId
      ) {
        throw new LeaveOwnViaSelfServiceException();
      }
      const previous = before.status as LeaveStatus;
      const view = await this.applyCancel(
        tx,
        before,
        note,
        actorId,
        "cancel_by_hr",
      );
      return { view, previous };
    });
  }

  /** The shared cancellation write: transition check, closed-month check for
   * approved leave, the update and its audit row. Runs inside the caller's
   * transaction, after the employee and row locks. */
  private async applyCancel(
    tx: Prisma.TransactionClient,
    before: LeaveRow,
    note: string | null,
    actorId: number,
    action: "cancel" | "cancel_by_hr",
  ): Promise<LeaveRequestView> {
    const from = before.status as LeaveStatus;
    if (!canTransition(from, "CANCELLED")) {
      throw new InvalidStateTransitionException(
        "Leave request",
        from,
        "CANCELLED",
        "only a pending or approved request can be cancelled",
      );
    }
    if (from === "APPROVED") {
      await assertMonthsOpen(
        tx,
        before.organizationId,
        before.employee.id,
        formatDateOnly(before.startDate),
        formatDateOnly(before.endDate),
      );
    }
    const after = await tx.leaveRequest.update({
      where: { id: before.id },
      data: {
        status: "CANCELLED",
        cancelledBy: actorId,
        cancelledAt: new Date(),
        cancellationNote: note,
        updatedBy: actorId,
      },
      include: INCLUDE,
    });
    await this.audit.write(tx, {
      entityType: ENTITY_TYPE,
      entityId: before.id,
      action,
      before: snapshot(before),
      after: snapshot(after),
      reason: note ?? undefined,
    });
    return toView(after);
  }

  /**
   * Puts a REJECTED or CANCELLED request back to PENDING, under the same rules
   * as a new submission (re-validated against today's calendar, overlaps and
   * balance). Edits nothing the employee submitted; the request keeps its id,
   * so no duplicate is created.
   */
  @OrgScoped()
  async resubmit(
    scope: OrgScope,
    employeeId: number,
    id: number,
    actorId: number,
    asOf: string,
  ): Promise<LeaveRequestView | null> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        await lockEmployee(tx, scope.organizationId, employeeId);
        await tx.$queryRaw`
          SELECT id FROM hr.leave_requests
           WHERE id = ${id} AND organization_id = ${scope.organizationId} FOR UPDATE`;
        const before = await tx.leaveRequest.findFirst({
          where: {
            id,
            organizationId: scope.organizationId,
            employeeId,
            deletedAt: null,
          },
          include: INCLUDE,
        });
        if (!before) return null;

        const from = before.status as LeaveStatus;
        if (!canTransition(from, "PENDING")) {
          throw new InvalidStateTransitionException(
            "Leave request",
            from,
            "PENDING",
            "only a rejected or cancelled request can be resubmitted",
          );
        }
        const startDate = formatDateOnly(before.startDate);
        if (startDate < asOf) {
          throw new BusinessRuleViolationException(
            "A request whose start date has passed cannot be resubmitted",
            "LEAVE_DATES_PAST",
          );
        }
        const { days, portion, approvalLevels } = await this.validateRequest(
          tx,
          scope,
          {
            employeeId,
            leaveTypeId: before.leaveType.id,
            startDate,
            endDate: formatDateOnly(before.endDate),
            dayPortion: before.dayPortion as DayPortion,
          },
          id,
        );
        const after = await tx.leaveRequest.update({
          where: { id },
          data: {
            status: "PENDING",
            leaveDays: days,
            dayPortion: portion,
            approvalLevels,
            firstDecidedBy: null,
            firstDecidedAt: null,
            firstDecisionNote: null,
            decidedBy: null,
            decidedAt: null,
            decisionNote: null,
            cancelledBy: null,
            cancelledAt: null,
            cancellationNote: null,
            updatedBy: actorId,
          },
          include: INCLUDE,
        });
        await this.audit.write(tx, {
          entityType: ENTITY_TYPE,
          entityId: id,
          action: "resubmit",
          before: snapshot(before),
          after: snapshot(after),
        });
        return toView(after);
      });
    } catch (error) {
      const row = await this.prisma.leaveRequest.findFirst({
        where: { id, organizationId: scope.organizationId, employeeId },
        select: { startDate: true, endDate: true },
      });
      if (!row) throw error;
      throw await this.explainOverlap(
        error,
        scope.organizationId,
        employeeId,
        {
          start: formatDateOnly(row.startDate),
          end: formatDateOnly(row.endDate),
        },
        id,
      );
    }
  }

  /**
   * Approves or rejects a PENDING request the caller may act on. In order:
   * lock the employee and the row → work out the caller's authority: the
   * employee's reporting manager (or that manager's delegate today), and/or a
   * team/all approve scope covering the employee — neither → `not_found`
   * (404) → maker-checker and stage rules (`approvalVerdict`) → refuse
   * anything but PENDING → on approval, re-check the balance including this
   * request (it is already held as pending) → on the FINAL approval, refuse a
   * closed attendance month → write the decision and audit row.
   *
   * A first approval of a two-level request records `first_decided_*` and
   * leaves the request PENDING for HR; a rejection at either stage is final.
   */
  @TeamScoped()
  async decide(
    scope: TeamScope,
    id: number,
    decision: { status: "APPROVED" | "REJECTED"; note: string | undefined },
    actorId: number,
    asOf: string,
  ): Promise<DecideOutcome> {
    return this.prisma.$transaction(async (tx) => {
      const probe = await tx.leaveRequest.findFirst({
        where: { id, organizationId: scope.organizationId, deletedAt: null },
        select: { employeeId: true },
      });
      if (!probe) return { kind: "not_found" } as const;
      await lockEmployee(tx, scope.organizationId, probe.employeeId);
      await tx.$queryRaw`
        SELECT id FROM hr.leave_requests
         WHERE id = ${id} AND organization_id = ${scope.organizationId} FOR UPDATE`;
      const before = await tx.leaveRequest.findFirst({
        where: { id, organizationId: scope.organizationId, deletedAt: null },
        include: INCLUDE,
      });
      if (!before) return { kind: "not_found" } as const;

      const managerUserId = before.employee.reportsTo?.userId ?? null;
      const isManager =
        managerUserId !== null &&
        (managerUserId === actorId ||
          (
            await this.delegatorsOf(tx, scope.organizationId, actorId, asOf)
          ).includes(managerUserId));
      const inScope =
        scope.level !== "own" &&
        (await tx.leaveRequest.count({
          where: teamWhere(scope, { id }, VIA_EMPLOYEE),
        })) > 0;
      const verdict = approvalVerdict({
        approvalLevels: before.approvalLevels,
        firstDecidedAt: before.firstDecidedAt,
        firstDecidedBy: before.firstDecidedBy,
        actorId,
        employeeUserId: before.employee.userId,
        requestedBy: before.requestedBy,
        isManager,
        inScope,
        scopeLevel: scope.level,
      });
      if (!verdict.ok) {
        if (verdict.reason === "NOT_VISIBLE") {
          return { kind: "not_found" } as const;
        }
        throw refusal(verdict.reason);
      }
      if (before.status !== "PENDING") {
        throw new InvalidStateTransitionException(
          "Leave request",
          before.status,
          decision.status,
          "a decided request is final",
        );
      }
      if (decision.status === "APPROVED") {
        const employee = await tx.employee.findUniqueOrThrow({
          where: { id: before.employee.id },
          select: { dateOfJoining: true, dateOfExit: true },
        });
        const type = await tx.leaveType.findUniqueOrThrow({
          where: { id: before.leaveType.id },
          select: {
            isPaid: true,
            annualEntitlement: true,
            carryForwardLimit: true,
            createdAt: true,
          },
        });
        if (type.isPaid) {
          const end = formatDateOnly(before.endDate);
          const balance = await this.balanceFor(
            tx,
            scope.organizationId,
            before.employee.id,
            employee,
            before.leaveType.id,
            type,
            Number(end.slice(0, 4)),
            Number(end.slice(5, 7)),
          );
          assertBalance(balance, 0);
        }
        if (verdict.final) {
          await assertMonthsOpen(
            tx,
            scope.organizationId,
            before.employee.id,
            formatDateOnly(before.startDate),
            formatDateOnly(before.endDate),
          );
        }
      }
      const firstApproval = decision.status === "APPROVED" && !verdict.final;
      const after = await tx.leaveRequest.update({
        where: { id },
        data: firstApproval
          ? {
              firstDecidedBy: actorId,
              firstDecidedAt: new Date(),
              firstDecisionNote: decision.note ?? null,
              updatedBy: actorId,
            }
          : {
              status: decision.status,
              decidedBy: actorId,
              decidedAt: new Date(),
              decisionNote: decision.note ?? null,
              updatedBy: actorId,
            },
        include: INCLUDE,
      });
      await this.audit.write(tx, {
        entityType: ENTITY_TYPE,
        entityId: id,
        action: firstApproval
          ? "approve_first"
          : decision.status === "APPROVED"
            ? "approve"
            : "reject",
        before: snapshot(before),
        after: snapshot(after),
        reason: decision.note,
      });
      return {
        kind: "decided",
        view: toView(after),
        stage: verdict.stage,
        final: decision.status === "REJECTED" || verdict.final,
      } as const;
    });
  }

  /**
   * PENDING requests waiting for THIS caller's decision: stage 1 of requests
   * whose employee reports to the caller (or to someone who delegated to the
   * caller today) or is in the caller's team/all approve scope, and — for an
   * `.all` approver — stage 2 of two-level requests someone else approved
   * first. Never the caller's own requests, nor ones the caller submitted.
   */
  @TeamScoped()
  async findAwaiting(
    scope: TeamScope,
    actorId: number,
    asOf: string,
    filter: LeaveFilter,
    pagination: PaginationDto,
  ) {
    const managers = [
      actorId,
      ...(await this.delegatorsOf(
        this.prisma,
        scope.organizationId,
        actorId,
        asOf,
      )),
    ];
    const reportsToMe: Prisma.LeaveRequestWhereInput = {
      employee: { reportsTo: { userId: { in: managers } } },
    };
    const scoped: Prisma.LeaveRequestWhereInput[] =
      scope.level === "own" ? [] : [teamWhere(scope, {}, VIA_EMPLOYEE)];
    const stageOne: Prisma.LeaveRequestWhereInput = {
      OR: [{ approvalLevels: 1 }, { firstDecidedAt: null }],
      AND: [{ OR: [reportsToMe, ...scoped] }],
    };
    const stageTwo: Prisma.LeaveRequestWhereInput[] =
      scope.level === "all"
        ? [
            {
              approvalLevels: 2,
              firstDecidedAt: { not: null },
              NOT: { firstDecidedBy: actorId },
            },
          ]
        : [];
    const where: Prisma.LeaveRequestWhereInput = {
      AND: [
        filterWhere({ ...filter, status: "PENDING" }),
        { organizationId: scope.organizationId },
        { NOT: { requestedBy: actorId } },
        { NOT: { employee: { userId: actorId } } },
        { OR: [stageOne, ...stageTwo] },
      ],
    };
    const [rows, total] = await Promise.all([
      this.prisma.leaveRequest.findMany({
        where,
        include: INCLUDE,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: [
          { [filter.sortBy ?? "startDate"]: pagination.order ?? "asc" },
          { id: "asc" },
        ],
      }),
      this.prisma.leaveRequest.count({ where }),
    ]);
    return { items: rows.map(toView), total };
  }

  /** Users who made `delegateUserId` their leave approver for `asOf`. */
  private async delegatorsOf(
    tx: Prisma.TransactionClient | PrismaService,
    organizationId: number,
    delegateUserId: number,
    asOf: string,
  ): Promise<number[]> {
    const day = parseDateOnly(asOf);
    const rows = await tx.leaveApprovalDelegation.findMany({
      where: {
        organizationId,
        delegateUserId,
        isActive: true,
        startDate: { lte: day },
        endDate: { gte: day },
        delegator: { isActive: true, deletedAt: null },
      },
      select: { delegatorUserId: true },
    });
    return rows.map((r) => r.delegatorUserId);
  }

  // ---- notification facts and recipients ------------------------------------

  @OrgScoped()
  async notificationFacts(
    scope: OrgScope,
    id: number,
  ): Promise<LeaveNotificationFacts | null> {
    const row = await this.prisma.leaveRequest.findFirst({
      where: tenantWhere<Prisma.LeaveRequestWhereInput>(scope, {
        id,
        deletedAt: null,
      }),
      include: INCLUDE,
    });
    if (!row) return null;
    return {
      id: row.id,
      employeeId: row.employee.id,
      employeeName: row.employee.fullName,
      employeeCode: row.employee.employeeCode,
      employeeUserId: row.employee.userId,
      teamId: row.employee.teamId,
      managerUserId: row.employee.reportsTo?.userId ?? null,
      leaveTypeName: row.leaveType.name,
      startDate: formatDateOnly(row.startDate),
      endDate: formatDateOnly(row.endDate),
      leaveDays: row.leaveDays.toNumber(),
      status: row.status as LeaveStatus,
      requestedBy: row.requestedBy,
      firstDecidedBy: row.firstDecidedBy,
      decidedBy: row.decidedBy,
      decisionNote: row.decisionNote,
      cancellationNote: row.cancellationNote,
    };
  }

  /** Active delegates of these users for `asOf` (the manager's stand-ins). */
  @OrgScoped()
  async activeDelegatesOf(
    scope: OrgScope,
    delegatorUserIds: number[],
    asOf: string,
  ): Promise<number[]> {
    if (delegatorUserIds.length === 0) return [];
    const day = parseDateOnly(asOf);
    const rows = await this.prisma.leaveApprovalDelegation.findMany({
      where: {
        organizationId: scope.organizationId,
        delegatorUserId: { in: delegatorUserIds },
        isActive: true,
        startDate: { lte: day },
        endDate: { gte: day },
        delegate: { isActive: true, deletedAt: null },
      },
      select: { delegateUserId: true },
    });
    return [...new Set(rows.map((r) => r.delegateUserId))];
  }

  /**
   * Active users holding any of `codes` through an active role and grant —
   * the same rule permission resolution applies. With `teamId`, `.team`
   * codes count only for users with active access to that team.
   */
  @OrgScoped()
  async usersWithApprove(
    scope: OrgScope,
    levels: readonly ("team" | "all")[],
    teamId: number | null,
  ): Promise<number[]> {
    const holding = (code: string): Prisma.UserWhereInput => ({
      userRoles: {
        some: {
          isActive: true,
          role: {
            organizationId: scope.organizationId,
            isActive: true,
            rolePermissions: {
              some: { isActive: true, permission: { code, isActive: true } },
            },
          },
        },
      },
    });
    const or: Prisma.UserWhereInput[] = [];
    if (levels.includes("all")) or.push(holding(APPROVE_CODES.all));
    if (levels.includes("team") && teamId !== null) {
      or.push({
        AND: [
          holding(APPROVE_CODES.team),
          { teamAccess: { some: { teamId, isActive: true } } },
        ],
      });
    }
    if (or.length === 0) return [];
    const rows = await this.prisma.user.findMany({
      where: {
        organizationId: scope.organizationId,
        isActive: true,
        deletedAt: null,
        OR: or,
      },
      select: { id: true },
    });
    return rows.map((r) => r.id);
  }

  /** Whether an employee is inside the caller's own/team/all scope. */
  @TeamScoped()
  async employeeVisible(
    scope: TeamScope,
    employeeId: number,
  ): Promise<boolean> {
    const found = await this.prisma.employee.findFirst({
      where: teamWhere(scope, { id: employeeId, deletedAt: null }),
      select: { id: true },
    });
    return found !== null;
  }

  /** Balances of every active leave type for one employee in `year`, as of `asOf`. */
  @OrgScoped()
  async balanceSheet(
    scope: OrgScope,
    employeeId: number,
    year: number,
    asOf: string,
  ): Promise<LeaveBalanceView[] | null> {
    const employee = await this.prisma.employee.findFirst({
      where: {
        id: employeeId,
        organizationId: scope.organizationId,
        deletedAt: null,
      },
      select: { id: true, dateOfJoining: true, dateOfExit: true },
    });
    if (!employee) return null;
    const types = await this.prisma.leaveType.findMany({
      where: {
        organizationId: scope.organizationId,
        deletedAt: null,
        isActive: true,
      },
      select: {
        id: true,
        code: true,
        name: true,
        isPaid: true,
        annualEntitlement: true,
        carryForwardLimit: true,
        createdAt: true,
      },
      orderBy: { id: "asc" },
    });
    const month = accrualMonthFor(year, asOf);
    const out: LeaveBalanceView[] = [];
    for (const type of types) {
      const balance = await this.balanceFor(
        this.prisma,
        scope.organizationId,
        employee.id,
        employee,
        type.id,
        type,
        year,
        month,
      );
      out.push({
        leaveTypeId: type.id,
        code: type.code,
        name: type.name,
        isPaid: type.isPaid,
        year,
        opening: balance.opening,
        entitlement: balance.entitlement,
        accrued: balance.accrued,
        used: balance.used,
        pending: balance.pending,
        available: type.isPaid ? balance.available : null,
      });
    }
    return out;
  }

  /**
   * One page of employees in the caller's read scope, each with the balance
   * of every active leave type for `year` as of `asOf` — the allotment /
   * balance report. Four queries per page whatever its size: employees,
   * types, overrides and requests of the page's employees.
   */
  @TeamScoped()
  async balanceReport(
    scope: TeamScope,
    filter: { teamId?: number | undefined; search?: string | undefined },
    year: number,
    asOf: string,
    pagination: PaginationDto,
  ): Promise<{ items: EmployeeBalanceRow[]; total: number }> {
    const where = teamWhere(scope, {
      deletedAt: null,
      ...(filter.teamId !== undefined ? { teamId: filter.teamId } : {}),
      ...(filter.search
        ? {
            OR: [
              { fullName: { contains: filter.search, mode: "insensitive" } },
              {
                employeeCode: { contains: filter.search, mode: "insensitive" },
              },
            ],
          }
        : {}),
      // Employed at some point in the year.
      dateOfJoining: { lte: parseDateOnly(`${year}-12-31`) },
      AND: [
        {
          OR: [
            { dateOfExit: null },
            { dateOfExit: { gte: parseDateOnly(`${year}-01-01`) } },
          ],
        },
      ],
    }) as Prisma.EmployeeWhereInput;
    const [employees, total, types] = await Promise.all([
      this.prisma.employee.findMany({
        where,
        select: {
          id: true,
          employeeCode: true,
          fullName: true,
          teamId: true,
          dateOfJoining: true,
          dateOfExit: true,
        },
        orderBy: [{ employeeCode: "asc" }, { id: "asc" }],
        skip: pagination.skip,
        take: pagination.limit,
      }),
      this.prisma.employee.count({ where }),
      this.prisma.leaveType.findMany({
        where: {
          organizationId: scope.organizationId,
          deletedAt: null,
          isActive: true,
        },
        select: {
          id: true,
          code: true,
          name: true,
          isPaid: true,
          annualEntitlement: true,
          carryForwardLimit: true,
          createdAt: true,
        },
        orderBy: { id: "asc" },
      }),
    ]);
    const ids = employees.map((e) => e.id);
    const [overrides, requests] = await Promise.all([
      this.prisma.leaveEntitlement.findMany({
        where: {
          organizationId: scope.organizationId,
          employeeId: { in: ids },
        },
        select: {
          employeeId: true,
          leaveTypeId: true,
          year: true,
          annualEntitlement: true,
        },
      }),
      this.prisma.leaveRequest.findMany({
        where: {
          organizationId: scope.organizationId,
          employeeId: { in: ids },
          deletedAt: null,
          status: { in: ["APPROVED", "PENDING"] },
        },
        select: {
          employeeId: true,
          leaveTypeId: true,
          startDate: true,
          leaveDays: true,
          status: true,
        },
      }),
    ]);
    const month = accrualMonthFor(year, asOf);
    const items = employees.map((e) => ({
      employee: {
        id: e.id,
        employeeCode: e.employeeCode,
        fullName: e.fullName,
        teamId: e.teamId,
      },
      balances: types.map((t) => {
        const own = overrides.filter(
          (o) => o.employeeId === e.id && o.leaveTypeId === t.id,
        );
        const b = computeBalance(
          t,
          e,
          own,
          requests.filter(
            (r) => r.employeeId === e.id && r.leaveTypeId === t.id,
          ),
          year,
          month,
        );
        return {
          leaveTypeId: t.id,
          code: t.code,
          name: t.name,
          isPaid: t.isPaid,
          year,
          isOverride: own.some((o) => o.year === year),
          opening: b.opening,
          entitlement: b.entitlement,
          accrued: b.accrued,
          used: b.used,
          pending: b.pending,
          available: t.isPaid ? b.available : null,
        };
      }),
    }));
    return { items, total };
  }

  /** Requests in the caller's export scope for a CSV, oldest first. Reads one
   * row past `max` so the caller can tell the export is too large. */
  @TeamScoped()
  async findForExport(scope: TeamScope, filter: LeaveFilter, max: number) {
    const rows = await this.prisma.leaveRequest.findMany({
      where: teamWhere(scope, filterWhere(filter), VIA_EMPLOYEE),
      include: INCLUDE,
      orderBy: [{ startDate: "asc" }, { id: "asc" }],
      take: max + 1,
    });
    return rows.map(toView);
  }

  /**
   * Sets or clears (`null`) one employee's annual entitlement for a leave type
   * and year. Takes the employee lock, so it cannot interleave with a balance
   * check. Audited with the old and new values only.
   */
  @OrgScoped()
  async setEntitlement(
    scope: OrgScope,
    input: {
      employeeId: number;
      leaveTypeId: number;
      year: number;
      annualEntitlement: number | null;
    },
    actorId: number,
  ): Promise<EntitlementView> {
    return this.prisma.$transaction(async (tx) => {
      await lockEmployee(tx, scope.organizationId, input.employeeId);
      return this.writeEntitlement(tx, scope, input, actorId);
    });
  }

  /**
   * Sets or clears many entitlements in ONE transaction: all or none. Takes
   * every affected employee's lock first, in ascending id order, so two bulk
   * writes can never deadlock each other or a single-employee write.
   */
  @OrgScoped()
  async setEntitlements(
    scope: OrgScope,
    items: readonly {
      employeeId: number;
      leaveTypeId: number;
      year: number;
      annualEntitlement: number | null;
    }[],
    actorId: number,
  ): Promise<EntitlementView[]> {
    return this.prisma.$transaction(
      async (tx) => {
        const ids = [...new Set(items.map((i) => i.employeeId))].sort(
          (a, b) => a - b,
        );
        for (const id of ids) await lockEmployee(tx, scope.organizationId, id);
        const out: EntitlementView[] = [];
        for (const item of items) {
          out.push(await this.writeEntitlement(tx, scope, item, actorId));
        }
        return out;
      },
      { timeout: 60_000 },
    );
  }

  /** Employee ids by code, for an import (organization-wide, as entitlement
   * administration is: Docs/HR_LEAVE.md §6, D11). */
  @OrgScoped()
  async employeeIdsByCode(
    scope: OrgScope,
    codes: string[],
  ): Promise<Map<string, number>> {
    const rows = await this.prisma.employee.findMany({
      where: {
        organizationId: scope.organizationId,
        deletedAt: null,
        employeeCode: { in: codes },
      },
      select: { id: true, employeeCode: true },
    });
    return new Map(rows.map((r) => [r.employeeCode.toUpperCase(), r.id]));
  }

  @OrgScoped()
  async leaveTypeIdsByCode(scope: OrgScope): Promise<Map<string, number>> {
    const rows = await this.prisma.leaveType.findMany({
      where: { organizationId: scope.organizationId, deletedAt: null },
      select: { id: true, code: true },
    });
    return new Map(rows.map((r) => [r.code.toUpperCase(), r.id]));
  }

  /** One entitlement write with its audit row; the caller holds the lock. */
  private async writeEntitlement(
    tx: Prisma.TransactionClient,
    scope: OrgScope,
    input: {
      employeeId: number;
      leaveTypeId: number;
      year: number;
      annualEntitlement: number | null;
    },
    actorId: number,
  ): Promise<EntitlementView> {
    const employee = await tx.employee.findFirst({
      where: {
        id: input.employeeId,
        organizationId: scope.organizationId,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (!employee) {
      throw new BusinessRuleViolationException(
        "Employee not found",
        "INVALID_EMPLOYEE",
      );
    }
    const type = await tx.leaveType.findFirst({
      where: {
        id: input.leaveTypeId,
        organizationId: scope.organizationId,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (!type) {
      throw new BusinessRuleViolationException(
        "Leave type not found",
        "INVALID_LEAVE_TYPE",
      );
    }
    const key = {
      employeeId: input.employeeId,
      leaveTypeId: input.leaveTypeId,
      year: input.year,
    };
    const existing = await tx.leaveEntitlement.findFirst({
      where: { organizationId: scope.organizationId, ...key },
    });
    const before = existing ? existing.annualEntitlement.toNumber() : null;

    if (input.annualEntitlement === null) {
      if (existing) {
        await tx.leaveEntitlement.delete({ where: { id: existing.id } });
      }
    } else {
      await tx.leaveEntitlement.upsert({
        where: { employeeId_leaveTypeId_year: key },
        create: {
          organizationId: scope.organizationId,
          ...key,
          annualEntitlement: input.annualEntitlement,
          createdBy: actorId,
          updatedBy: actorId,
        },
        update: {
          annualEntitlement: input.annualEntitlement,
          updatedBy: actorId,
        },
      });
    }
    if (before !== input.annualEntitlement) {
      await this.audit.write(tx, {
        entityType: ENTITLEMENT_ENTITY,
        entityId: existing?.id ?? 0,
        action: input.annualEntitlement === null ? "clear" : "set",
        before: { ...key, annualEntitlement: before },
        after: { ...key, annualEntitlement: input.annualEntitlement },
      });
    }
    return { ...key, annualEntitlement: input.annualEntitlement };
  }

  // ---- internals -----------------------------------------------------------

  /** Shared validation for a submission and for a resubmission. Returns the
   * working days the request consumes. Runs inside the employee lock. */
  private async validateRequest(
    tx: Prisma.TransactionClient,
    scope: OrgScope,
    input: {
      employeeId: number;
      leaveTypeId: number;
      startDate: string;
      endDate: string;
      dayPortion?: DayPortion | undefined;
    },
    selfId: number | null,
  ): Promise<{ days: number; portion: DayPortion; approvalLevels: number }> {
    const { startDate: start, endDate: end } = input;
    if (end < start) {
      throw new BusinessRuleViolationException(
        "endDate cannot be before startDate",
        "LEAVE_DATES_INVALID",
      );
    }
    const portion: DayPortion = input.dayPortion ?? "FULL";
    if (portion !== "FULL" && start !== end) {
      throw new BusinessRuleViolationException(
        "A half-day must be a single date",
        "LEAVE_HALF_DAY_INVALID",
      );
    }
    const employee = await tx.employee.findFirst({
      where: {
        id: input.employeeId,
        organizationId: scope.organizationId,
        deletedAt: null,
      },
      select: {
        id: true,
        status: true,
        teamId: true,
        workLocationId: true,
        dateOfJoining: true,
        dateOfExit: true,
      },
    });
    if (!employee) {
      throw new BusinessRuleViolationException(
        "Employee not found",
        "INVALID_EMPLOYEE",
      );
    }
    if (employee.status !== "ACTIVE") {
      throw new BusinessRuleViolationException(
        EXIT_STATUSES.includes(employee.status)
          ? "An employee who has left cannot request leave"
          : "Only an ACTIVE employee can request leave",
        "EMPLOYEE_NOT_ACTIVE",
      );
    }
    const joining = formatDateOnly(employee.dateOfJoining);
    if (start < joining) {
      throw new BusinessRuleViolationException(
        "Leave cannot start before the date of joining",
        "LEAVE_BEFORE_JOINING",
      );
    }
    if (employee.dateOfExit && end > formatDateOnly(employee.dateOfExit)) {
      throw new BusinessRuleViolationException(
        "Leave cannot extend past the date of exit",
        "LEAVE_AFTER_EXIT",
      );
    }

    const type = await tx.leaveType.findFirst({
      where: {
        id: input.leaveTypeId,
        organizationId: scope.organizationId,
        deletedAt: null,
        isActive: true,
      },
      select: {
        id: true,
        isPaid: true,
        annualEntitlement: true,
        carryForwardLimit: true,
        approvalLevels: true,
        createdAt: true,
      },
    });
    if (!type) {
      throw new BusinessRuleViolationException(
        `Leave type ${input.leaveTypeId} does not exist in this organization or is inactive`,
        "INVALID_LEAVE_TYPE",
      );
    }

    if (spansYears(start, end)) {
      throw new BusinessRuleViolationException(
        "A leave request cannot span two calendar years",
        "LEAVE_SPANS_YEAR",
      );
    }

    const days = await this.workingDays(scope, employee, start, end, portion);
    if (days <= 0) {
      throw new BusinessRuleViolationException(
        "The requested dates contain no working day",
        "LEAVE_NO_WORKING_DAYS",
      );
    }

    await this.assertNoClash(
      tx,
      scope.organizationId,
      employee.id,
      { start, end, portion },
      selfId,
    );

    if (type.isPaid) {
      const balance = await this.balanceFor(
        tx,
        scope.organizationId,
        employee.id,
        employee,
        type.id,
        type,
        Number(end.slice(0, 4)),
        Number(end.slice(5, 7)),
      );
      assertBalance(balance, days);
    }
    return { days, portion, approvalLevels: type.approvalLevels };
  }

  /** Working days in a range for an employee, using the shared calendar
   * precedence (holiday > weekly-off) that Attendance uses. */
  private async workingDays(
    scope: OrgScope,
    employee: { id: number; teamId: number; workLocationId: number | null },
    start: string,
    end: string,
    portion: DayPortion,
  ): Promise<number> {
    const ref = {
      id: employee.id,
      teamId: employee.teamId,
      workLocationId: employee.workLocationId,
    };
    const ctx = await this.calendar.load(scope, [ref], start, end);
    return countLeaveDays({ start, end, portion }, (date) => {
      const day = resolveCalendar(ctx, ref, date);
      return !day.holiday && !day.weeklyOff;
    });
  }

  private async assertNoClash(
    tx: Prisma.TransactionClient,
    organizationId: number,
    employeeId: number,
    span: { start: string; end: string; portion: DayPortion },
    selfId: number | null,
  ) {
    const open = await tx.leaveRequest.findMany({
      where: {
        organizationId,
        employeeId,
        deletedAt: null,
        status: { in: [...OPEN_STATUSES] },
        startDate: { lte: parseDateOnly(span.end) },
        endDate: { gte: parseDateOnly(span.start) },
        ...(selfId !== null ? { id: { not: selfId } } : {}),
      },
      orderBy: { startDate: "asc" },
    });
    const clash = open.find((row) =>
      requestsConflict(
        {
          start: formatDateOnly(row.startDate),
          end: formatDateOnly(row.endDate),
          portion: row.dayPortion as DayPortion,
        },
        span,
      ),
    );
    if (clash) {
      throw clashError(clash);
    }
  }

  /** Balance of one paid leave type in the year of `throughDate`, as of
   * `asOf`. Pending requests of the year are held against it. */
  private async balanceFor(
    tx: Prisma.TransactionClient | PrismaService,
    organizationId: number,
    employeeId: number,
    employee: { dateOfJoining: Date; dateOfExit: Date | null },
    leaveTypeId: number,
    type: {
      annualEntitlement: Prisma.Decimal;
      carryForwardLimit: Prisma.Decimal;
      createdAt: Date;
    },
    year: number,
    month: number,
  ): Promise<YearBalance> {
    const [overrideRows, requests] = await Promise.all([
      tx.leaveEntitlement.findMany({
        where: { organizationId, employeeId, leaveTypeId },
        select: { year: true, annualEntitlement: true },
      }),
      tx.leaveRequest.findMany({
        where: {
          organizationId,
          employeeId,
          leaveTypeId,
          deletedAt: null,
          status: { in: ["APPROVED", "PENDING"] },
        },
        select: { startDate: true, leaveDays: true, status: true },
      }),
    ]);
    return computeBalance(type, employee, overrideRows, requests, year, month);
  }

  /** Turns a database exclusion violation into the named overlap error. The
   * service check normally fires first; this covers any race that slips past. */
  private async explainOverlap(
    error: unknown,
    organizationId: number,
    employeeId: number,
    span: { start: string; end: string },
    selfId: number | null,
  ): Promise<unknown> {
    if (error instanceof BusinessException) return error;
    if (classifyDbError(error)?.kind !== "exclusion") return error;
    const clash = await this.prisma.leaveRequest.findFirst({
      where: {
        organizationId,
        employeeId,
        deletedAt: null,
        status: { in: [...OPEN_STATUSES] },
        startDate: { lte: parseDateOnly(span.end) },
        endDate: { gte: parseDateOnly(span.start) },
        ...(selfId !== null ? { id: { not: selfId } } : {}),
      },
      orderBy: { startDate: "asc" },
    });
    return clash ? clashError(clash) : error;
  }
}

function clashError(clash: {
  id: number;
  status: string;
  startDate: Date;
  endDate: Date;
}) {
  return new BusinessRuleConflictException(
    `Overlaps an existing pending or approved leave request (request #${clash.id}, ${clash.status}: ${formatDateOnly(clash.startDate)} to ${formatDateOnly(clash.endDate)})`,
    "LEAVE_OVERLAP",
  );
}

/** One leave type's balance for one employee, from the loaded facts. Shared
 * by the single-employee path (inside the employee lock) and the
 * many-employee report (one batch of queries per page). */
function computeBalance(
  type: {
    annualEntitlement: Prisma.Decimal;
    carryForwardLimit: Prisma.Decimal;
    createdAt: Date;
  },
  employee: { dateOfJoining: Date; dateOfExit: Date | null },
  overrideRows: readonly { year: number; annualEntitlement: Prisma.Decimal }[],
  requests: readonly {
    startDate: Date;
    leaveDays: Prisma.Decimal;
    status: string;
  }[],
  year: number,
  month: number,
): YearBalance {
  const policy: BalancePolicy = {
    annualEntitlement: type.annualEntitlement.toNumber(),
    carryForwardLimit: type.carryForwardLimit.toNumber(),
    typeFirstYear: type.createdAt.getUTCFullYear(),
    joiningDate: formatDateOnly(employee.dateOfJoining),
    exitDate: employee.dateOfExit ? formatDateOnly(employee.dateOfExit) : null,
    overrides: new Map(
      overrideRows.map((o) => [o.year, o.annualEntitlement.toNumber()]),
    ),
  };
  const usedByYear = new Map<number, number>();
  let pendingInYear = 0;
  for (const r of requests) {
    const y = r.startDate.getUTCFullYear();
    if (r.status === "APPROVED") {
      usedByYear.set(y, (usedByYear.get(y) ?? 0) + r.leaveDays.toNumber());
    } else if (y === year) {
      pendingInYear += r.leaveDays.toNumber();
    }
  }
  const facts: BalanceFacts = { usedByYear, pendingInYear };
  return yearBalance(policy, facts, year, month);
}

function refusal(reason: Exclude<ApprovalRefusal, "NOT_VISIBLE">) {
  switch (reason) {
    case "SELF":
      return new SelfApprovalForbiddenException();
    case "REQUESTER":
      return new SelfApprovalForbiddenException(true);
    case "AWAITING_HR":
      return new LeaveAwaitingHrException();
    case "SAME_APPROVER":
      return new LeaveSameApproverException();
  }
}

function assertBalance(balance: YearBalance, days: number) {
  if (!covers(balance, days)) {
    throw new BusinessRuleViolationException(
      `Insufficient leave balance: ${balance.available} day(s) available, ${days} requested`,
      "LEAVE_BALANCE_INSUFFICIENT",
    );
  }
}
