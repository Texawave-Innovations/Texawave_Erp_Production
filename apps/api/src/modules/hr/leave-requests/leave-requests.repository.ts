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
import { resolveCalendar } from "../attendance/services/attendance-day-resolver.js";
import {
  type BalanceFacts,
  type BalancePolicy,
  canTransition,
  countLeaveDays,
  covers,
  type DayPortion,
  type LeaveStatus,
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
    select: { id: true, employeeCode: true, fullName: true, userId: true },
  },
  leaveType: { select: { id: true, code: true, name: true } },
  decider: { select: { id: true, fullName: true } },
} satisfies Prisma.LeaveRequestInclude;
type LeaveRow = Prisma.LeaveRequestGetPayload<{ include: typeof INCLUDE }>;

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
  decidedBy: { id: number; fullName: string } | null;
  decidedAt: Date | null;
  decisionNote: string | null;
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
    decidedBy: row.decider,
    decidedAt: row.decidedAt,
    decisionNote: row.decisionNote,
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
    decidedBy: row.decider?.id ?? null,
  };
}

export class SelfApprovalForbiddenException extends BusinessException {
  constructor() {
    super(
      "You cannot approve or reject your own leave request",
      HttpStatus.FORBIDDEN,
      "SELF_APPROVAL_FORBIDDEN",
    );
  }
}

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

  @OrgScoped()
  async create(
    scope: OrgScope,
    input: NewLeaveRequest,
    actorId: number,
  ): Promise<LeaveRequestView> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        await lockEmployee(tx, scope.organizationId, input.employeeId);
        const { days, portion } = await this.validateRequest(
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
            requestedBy: actorId,
            createdBy: actorId,
            updatedBy: actorId,
          },
          include: INCLUDE,
        });
        await this.audit.write(tx, {
          entityType: ENTITY_TYPE,
          entityId: created.id,
          action: "submit",
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

      const from = before.status as LeaveStatus;
      if (!canTransition(from, "CANCELLED")) {
        throw new InvalidStateTransitionException(
          "Leave request",
          from,
          "CANCELLED",
          "only a pending or approved request can be cancelled",
        );
      }
      if (from === "APPROVED" && formatDateOnly(before.startDate) <= asOf) {
        throw new BusinessRuleViolationException(
          "An approved leave cannot be cancelled once it has started",
          "LEAVE_ALREADY_STARTED",
        );
      }
      const after = await tx.leaveRequest.update({
        where: { id },
        data: {
          status: "CANCELLED",
          cancelledAt: new Date(),
          cancellationNote: note ?? null,
          updatedBy: actorId,
        },
        include: INCLUDE,
      });
      await this.audit.write(tx, {
        entityType: ENTITY_TYPE,
        entityId: id,
        action: "cancel",
        before: snapshot(before),
        after: snapshot(after),
        reason: note,
      });
      return toView(after);
    });
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
        const { days, portion } = await this.validateRequest(
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
            decidedBy: null,
            decidedAt: null,
            decisionNote: null,
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
   * lock the employee and the row → find it THROUGH the caller's scope (else
   * `null` → 404) → refuse the employee's own user (maker-checker) → refuse
   * anything but PENDING → on approval, re-check the balance including this
   * request (it is already held as pending) → write the decision and audit row.
   */
  @TeamScoped()
  async decide(
    scope: TeamScope,
    id: number,
    decision: { status: "APPROVED" | "REJECTED"; note: string | undefined },
    actorId: number,
  ): Promise<LeaveRequestView | null> {
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
        throw new SelfApprovalForbiddenException();
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
      }
      const after = await tx.leaveRequest.update({
        where: { id },
        data: {
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
        action: decision.status === "APPROVED" ? "approve" : "reject",
        before: snapshot(before),
        after: snapshot(after),
        reason: decision.note,
      });
      return toView(after);
    });
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
    });
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
  ): Promise<{ days: number; portion: DayPortion }> {
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
    return { days, portion };
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
    const policy: BalancePolicy = {
      annualEntitlement: type.annualEntitlement.toNumber(),
      carryForwardLimit: type.carryForwardLimit.toNumber(),
      typeFirstYear: type.createdAt.getUTCFullYear(),
      joiningDate: formatDateOnly(employee.dateOfJoining),
      exitDate: employee.dateOfExit
        ? formatDateOnly(employee.dateOfExit)
        : null,
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

function assertBalance(balance: YearBalance, days: number) {
  if (!covers(balance, days)) {
    throw new BusinessRuleViolationException(
      `Insufficient leave balance: ${balance.available} day(s) available, ${days} requested`,
      "LEAVE_BALANCE_INSUFFICIENT",
    );
  }
}
