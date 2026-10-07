import { HttpStatus, Injectable } from "@nestjs/common";
import { Prisma } from "@texawave-erp/database";
import {
  formatDateOnly,
  parseDateOnly,
} from "../../../common/dates/date-only.js";
import { OrgScoped } from "../../../common/decorators/org-scoped.decorator.js";
import { TeamScoped } from "../../../common/decorators/team-scoped.decorator.js";
import type { PaginationDto } from "../../../common/dto/pagination.dto.js";
import {
  BusinessException,
  BusinessRuleViolationException,
  InvalidStateTransitionException,
} from "../../../common/exceptions/business.exception.js";
import type { OrgScope } from "../../../common/tenancy/org-scope.js";
import type { TeamScope } from "../../../common/tenancy/team-scope.js";
import { teamWhere } from "../../../common/tenancy/team-where.js";
import { tenantWhere } from "../../../common/tenancy/tenant-where.js";
import { AuditWriter } from "../../../platform/audit/audit-writer.js";
import { PrismaService } from "../../../shared/prisma/prisma.service.js";
import type { WorkLogStatus } from "./dto/work-log.dto.js";

const ENTITY_TYPE = "work_log";

export class WorkLogSelfApprovalForbiddenException extends BusinessException {
  constructor() {
    super(
      "You cannot approve or reject your own work log",
      HttpStatus.FORBIDDEN,
      "SELF_APPROVAL_FORBIDDEN",
    );
  }
}

export interface WorkLogFilter {
  employeeId?: number | undefined;
  status?: WorkLogStatus | undefined;
  from?: string | undefined;
  to?: string | undefined;
}

export interface NewWorkLog {
  employeeId: number;
  workDate: string;
  hoursWorked: number;
  taskDescription: string;
}

const INCLUDE = {
  employee: { select: { id: true, fullName: true, userId: true } },
  decider: { select: { id: true, fullName: true } },
} satisfies Prisma.WorkLogInclude;
type WorkLogRow = Prisma.WorkLogGetPayload<{ include: typeof INCLUDE }>;

/** Team/own scope reaches work logs THROUGH the employee. */
const VIA_EMPLOYEE = {
  teamField: "employee.teamId",
  ownerField: "employee.userId",
};

function filterWhere(filter: WorkLogFilter): Prisma.WorkLogWhereInput {
  const workDate: Prisma.DateTimeFilter = {};
  if (filter.from) workDate.gte = parseDateOnly(filter.from);
  if (filter.to) workDate.lte = parseDateOnly(filter.to);
  return {
    ...(filter.employeeId !== undefined
      ? { employeeId: filter.employeeId }
      : {}),
    ...(filter.status ? { status: filter.status } : {}),
    ...(Object.keys(workDate).length > 0 ? { workDate } : {}),
  };
}

export interface WorkLogView {
  id: number;
  employee: { id: number; fullName: string };
  workDate: string;
  hoursWorked: number;
  taskDescription: string;
  status: WorkLogStatus;
  decidedBy: { id: number; fullName: string } | null;
  decidedAt: Date | null;
  decisionNote: string | null;
  createdAt: Date;
}

function toView(row: WorkLogRow): WorkLogView {
  return {
    id: row.id,
    employee: { id: row.employee.id, fullName: row.employee.fullName },
    workDate: formatDateOnly(row.workDate),
    hoursWorked: row.hoursWorked.toNumber(),
    taskDescription: row.taskDescription,
    status: row.status as WorkLogStatus,
    decidedBy: row.decider,
    decidedAt: row.decidedAt,
    decisionNote: row.decisionNote,
    createdAt: row.createdAt,
  };
}

/** Audit snapshot: the business facts only. The task description is kept
 * out, as the leave snapshot keeps its reason out. */
function snapshot(row: WorkLogRow) {
  return {
    employeeId: row.employee.id,
    workDate: formatDateOnly(row.workDate),
    hoursWorked: row.hoursWorked.toNumber(),
    status: row.status,
    decidedBy: row.decider?.id ?? null,
  };
}

/** Only place `PrismaService` is called for work logs. Reads go through
 * `teamWhere()` or `tenantWhere()`; writes are one transaction with the row
 * lock, the change and its audit row. A decision is final. */
@Injectable()
export class WorkLogsRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditWriter,
  ) {}

  @TeamScoped()
  async findMany(
    scope: TeamScope,
    filter: WorkLogFilter,
    pagination: PaginationDto,
  ) {
    const where = teamWhere(scope, filterWhere(filter), VIA_EMPLOYEE);
    return this.page(where, pagination);
  }

  @TeamScoped()
  async findOne(scope: TeamScope, id: number) {
    const row = await this.prisma.workLog.findFirst({
      where: teamWhere(scope, { id }, VIA_EMPLOYEE),
      include: INCLUDE,
    });
    return row ? toView(row) : null;
  }

  /** The caller's OWN logs: `employeeId` is resolved from the JWT by the
   * service, never taken from the client. */
  @OrgScoped()
  async findMine(
    scope: OrgScope,
    employeeId: number,
    filter: WorkLogFilter,
    pagination: PaginationDto,
  ) {
    const where = tenantWhere<Prisma.WorkLogWhereInput>(
      scope,
      filterWhere({ ...filter, employeeId }),
    );
    return this.page(where, pagination);
  }

  /** Logs submitted by the caller's direct reports (`reportsToId` = caller). */
  @OrgScoped()
  async findDirectReports(
    scope: OrgScope,
    managerEmployeeId: number,
    filter: WorkLogFilter,
    pagination: PaginationDto,
  ) {
    const where = tenantWhere<Prisma.WorkLogWhereInput>(scope, {
      ...filterWhere(filter),
      employee: { reportsToId: managerEmployeeId },
    });
    return this.page(where, pagination);
  }

  @OrgScoped()
  async create(
    scope: OrgScope,
    input: NewWorkLog,
    actorId: number,
  ): Promise<WorkLogView> {
    const workDate = parseDateOnly(input.workDate);
    return this.prisma.$transaction(async (tx) => {
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
      const created = await tx.workLog.create({
        data: {
          organizationId: scope.organizationId,
          employeeId: input.employeeId,
          workDate,
          hoursWorked: input.hoursWorked,
          taskDescription: input.taskDescription,
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
        action: "create",
        after: snapshot(created),
      });
      return toView(created);
    });
  }

  /**
   * Approves or rejects a PENDING log whose employee reports to the caller.
   * Lock → find it inside the organization AND under the caller as manager
   * (else `null` → 404, so other logs are not revealed) → refuse the caller's
   * own log → refuse anything but PENDING → write the decision and its audit row.
   */
  @OrgScoped()
  async decide(
    scope: OrgScope,
    id: number,
    approverEmployeeId: number,
    decision: { status: "APPROVED" | "REJECTED"; note: string | undefined },
    actorId: number,
  ): Promise<WorkLogView | null> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT id FROM hr.work_logs
         WHERE id = ${id} AND organization_id = ${scope.organizationId} FOR UPDATE`;
      const before = await tx.workLog.findFirst({
        where: {
          id,
          organizationId: scope.organizationId,
          employee: { reportsToId: approverEmployeeId, deletedAt: null },
        },
        include: INCLUDE,
      });
      if (!before) return null;

      if (before.employee.id === approverEmployeeId) {
        throw new WorkLogSelfApprovalForbiddenException();
      }
      if (before.status !== "PENDING") {
        throw new InvalidStateTransitionException(
          "Work log",
          before.status,
          decision.status,
          "a decided work log is final",
        );
      }
      const after = await tx.workLog.update({
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

  private async page(
    where: Prisma.WorkLogWhereInput,
    pagination: PaginationDto,
  ) {
    const [rows, total] = await Promise.all([
      this.prisma.workLog.findMany({
        where,
        include: INCLUDE,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: [{ workDate: pagination.order ?? "desc" }, { id: "desc" }],
      }),
      this.prisma.workLog.count({ where }),
    ]);
    return { items: rows.map(toView), total };
  }
}
