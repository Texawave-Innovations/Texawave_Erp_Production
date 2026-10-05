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
import type { LeaveStatus } from "./dto/leave-request.dto.js";

const ENTITY_TYPE = "leave_request";
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
  /** Calendar days, both ends included. Not "working days": weekly-offs and
   * holidays are NOT excluded — how leave counts against them is unapproved policy. */
  calendarDays: number;
  reason: string;
  status: LeaveStatus;
  decidedBy: { id: number; fullName: string } | null;
  decidedAt: Date | null;
  decisionNote: string | null;
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
    calendarDays: inclusiveDays(row.startDate, row.endDate),
    reason: row.reason,
    status: row.status as LeaveStatus,
    decidedBy: row.decider,
    decidedAt: row.decidedAt,
    decisionNote: row.decisionNote,
    createdAt: row.createdAt,
  };
}

/** The employee's free-text reason (possibly medical) and the decision note
 * are kept out of the audit snapshot; they live on the request itself. */
function snapshot(row: LeaveRow) {
  return {
    employeeId: row.employee.id,
    leaveTypeId: row.leaveType.id,
    startDate: formatDateOnly(row.startDate),
    endDate: formatDateOnly(row.endDate),
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
  status?: LeaveStatus | undefined;
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

/** Only place `PrismaService` is called for leave requests. Reads through
 * `teamWhere()` (via the employee); writes are one transaction with the row
 * lock, the change and its audit row. A decision is final. */
@Injectable()
export class LeaveRequestsRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditWriter,
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

  @OrgScoped()
  async create(
    scope: OrgScope,
    input: NewLeaveRequest,
    actorId: number,
  ): Promise<LeaveRequestView> {
    const start = parseDateOnly(input.startDate);
    const end = parseDateOnly(input.endDate);
    if (end < start) {
      throw new BusinessRuleViolationException(
        "endDate cannot be before startDate",
        "LEAVE_DATES_INVALID",
      );
    }
    try {
      return await this.prisma.$transaction(async (tx) => {
        const employee = await tx.employee.findFirst({
          where: {
            id: input.employeeId,
            organizationId: scope.organizationId,
            deletedAt: null,
          },
          select: { status: true, dateOfJoining: true },
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
        if (start < employee.dateOfJoining) {
          throw new BusinessRuleViolationException(
            "Leave cannot start before the date of joining",
            "LEAVE_BEFORE_JOINING",
          );
        }
        const type = await tx.leaveType.findFirst({
          where: {
            id: input.leaveTypeId,
            organizationId: scope.organizationId,
            deletedAt: null,
            isActive: true,
          },
          select: { id: true },
        });
        if (!type) {
          throw new BusinessRuleViolationException(
            `Leave type ${input.leaveTypeId} does not exist in this organization or is inactive`,
            "INVALID_LEAVE_TYPE",
          );
        }
        const created = await tx.leaveRequest.create({
          data: {
            organizationId: scope.organizationId,
            employeeId: input.employeeId,
            leaveTypeId: input.leaveTypeId,
            startDate: start,
            endDate: end,
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
        input,
        start,
        end,
      );
    }
  }

  /**
   * Approves or rejects a PENDING request the caller may act on. In order:
   * lock the row → find it THROUGH the caller's scope (else `null` → 404) →
   * refuse the employee's own user (maker-checker) → refuse anything but
   * PENDING (a decision is final, and two approvers racing can only have one
   * winner) → write the decision and its audit row.
   */
  @TeamScoped()
  async decide(
    scope: TeamScope,
    id: number,
    decision: { status: "APPROVED" | "REJECTED"; note: string | undefined },
    actorId: number,
  ): Promise<LeaveRequestView | null> {
    return this.prisma.$transaction(async (tx) => {
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

  private async explainOverlap(
    error: unknown,
    organizationId: number,
    input: NewLeaveRequest,
    start: Date,
    end: Date,
  ): Promise<unknown> {
    if (classifyDbError(error)?.kind !== "exclusion") return error;
    const clash = await this.prisma.leaveRequest.findFirst({
      where: {
        organizationId,
        employeeId: input.employeeId,
        status: { in: ["PENDING", "APPROVED"] },
        startDate: { lte: end },
        endDate: { gte: start },
      },
      orderBy: { startDate: "asc" },
    });
    const detail = clash
      ? ` (request #${clash.id}, ${clash.status}: ${formatDateOnly(clash.startDate)} to ${formatDateOnly(clash.endDate)})`
      : "";
    return new BusinessRuleConflictException(
      `Overlaps an existing pending or approved leave request${detail}`,
      "LEAVE_OVERLAP",
    );
  }
}
