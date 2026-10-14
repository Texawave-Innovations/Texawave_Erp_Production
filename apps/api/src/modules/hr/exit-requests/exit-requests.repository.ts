import { HttpStatus, Injectable } from "@nestjs/common";
import { Prisma } from "@texawave-erp/database";
import { translateDbError } from "../../../common/database/db-errors.js";
import {
  formatDateOnly,
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
import {
  ACTIVE_STATUSES,
  canTransition,
  type ExitRequestStatus,
  isDecision,
  isTerminal,
  type SettlementStatus,
} from "./exit-request-domain.js";

const ENTITY_TYPE = "exit_request";
/** The partial unique index that enforces one active request per employee. */
const ACTIVE_INDEX = "exit_requests_one_active_per_employee_key";

export class ExitRequestSelfDecisionForbiddenException extends BusinessException {
  constructor() {
    super(
      "You cannot review or decide your own exit request",
      HttpStatus.FORBIDDEN,
      "SELF_DECISION_FORBIDDEN",
    );
  }
}

export class ActiveExitRequestExistsException extends BusinessRuleConflictException {
  constructor() {
    super(
      "An exit request is already active for this employee",
      "ACTIVE_EXIT_REQUEST_EXISTS",
    );
  }
}

export interface ExitRequestFilter {
  employeeId?: number | undefined;
  status?: ExitRequestStatus | undefined;
}

export interface NewExitRequest {
  employeeId: number;
  reason: string;
  preferredLastWorkingDate: string;
  noticePeriodDays: number;
  additionalNotes?: string | undefined;
}

export interface ExitRequestUpdate {
  status?: ExitRequestStatus | undefined;
  confirmedLastWorkingDate?: string | undefined;
  settlementStatus?: SettlementStatus | undefined;
  hrNote?: string | undefined;
}

const INCLUDE = {
  employee: {
    select: { id: true, fullName: true, userId: true, teamId: true },
  },
  decider: { select: { id: true, fullName: true } },
} satisfies Prisma.ExitRequestInclude;
type ExitRequestRow = Prisma.ExitRequestGetPayload<{ include: typeof INCLUDE }>;

/** Team/own scope reaches requests THROUGH the employee. */
const VIA_EMPLOYEE = {
  teamField: "employee.teamId",
  ownerField: "employee.userId",
};

function filterWhere(filter: ExitRequestFilter): Prisma.ExitRequestWhereInput {
  return {
    ...(filter.employeeId !== undefined
      ? { employeeId: filter.employeeId }
      : {}),
    ...(filter.status ? { status: filter.status } : {}),
  };
}

export interface ExitRequestView {
  id: number;
  employee: { id: number; fullName: string };
  status: ExitRequestStatus;
  reason: string;
  preferredLastWorkingDate: string;
  noticePeriodDays: number;
  additionalNotes: string | null;
  confirmedLastWorkingDate: string | null;
  settlementStatus: SettlementStatus | null;
  hrNote: string | null;
  decidedBy: { id: number; fullName: string } | null;
  decidedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

function toView(row: ExitRequestRow): ExitRequestView {
  return {
    id: row.id,
    employee: { id: row.employee.id, fullName: row.employee.fullName },
    status: row.status as ExitRequestStatus,
    reason: row.reason,
    preferredLastWorkingDate: formatDateOnly(row.preferredLastWorkingDate),
    noticePeriodDays: row.noticePeriodDays,
    additionalNotes: row.additionalNotes,
    confirmedLastWorkingDate: row.confirmedLastWorkingDate
      ? formatDateOnly(row.confirmedLastWorkingDate)
      : null,
    settlementStatus: row.settlementStatus as SettlementStatus | null,
    hrNote: row.hrNote,
    decidedBy: row.decider,
    decidedAt: row.decidedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** Audit snapshot: business facts only. The reason, the employee's additional
 * notes and HR's note are free text and stay out, as in the other HR modules. */
function snapshot(row: ExitRequestRow) {
  return {
    employeeId: row.employee.id,
    status: row.status,
    preferredLastWorkingDate: formatDateOnly(row.preferredLastWorkingDate),
    noticePeriodDays: row.noticePeriodDays,
    confirmedLastWorkingDate: row.confirmedLastWorkingDate
      ? formatDateOnly(row.confirmedLastWorkingDate)
      : null,
    settlementStatus: row.settlementStatus,
    decidedBy: row.decider?.id ?? null,
  };
}

/** Audit action for a change. Only the actions the legacy workflow has. */
function actionFor(from: ExitRequestStatus, to: ExitRequestStatus): string {
  if (to === from) return "update";
  if (to === "UNDER_REVIEW") return "review";
  if (to === "APPROVED") return "approve";
  if (to === "REJECTED") return "reject";
  return "complete";
}

/** Only place `PrismaService` is called for exit requests. Reads go through
 * `teamWhere()` or `tenantWhere()`. Writes are one transaction holding the
 * employee lock and the row lock, a conditional update, and the audit row. */
@Injectable()
export class ExitRequestsRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditWriter,
  ) {}

  @TeamScoped()
  async findMany(
    scope: TeamScope,
    filter: ExitRequestFilter,
    pagination: PaginationDto,
  ) {
    const where = teamWhere(scope, filterWhere(filter), VIA_EMPLOYEE);
    return this.page(where, pagination);
  }

  @TeamScoped()
  async findOne(scope: TeamScope, id: number) {
    const row = await this.prisma.exitRequest.findFirst({
      where: teamWhere(scope, { id }, VIA_EMPLOYEE),
      include: INCLUDE,
    });
    return row ? toView(row) : null;
  }

  /** The caller's OWN requests: `employeeId` comes from the JWT via the service. */
  @OrgScoped()
  async findMine(
    scope: OrgScope,
    employeeId: number,
    filter: ExitRequestFilter,
    pagination: PaginationDto,
  ) {
    const where = tenantWhere<Prisma.ExitRequestWhereInput>(
      scope,
      filterWhere({ ...filter, employeeId }),
    );
    return this.page(where, pagination);
  }

  /** The caller's own request by id; `null` (→ 404) for anyone else's. */
  @OrgScoped()
  async findMineOne(scope: OrgScope, employeeId: number, id: number) {
    const row = await this.prisma.exitRequest.findFirst({
      where: tenantWhere<Prisma.ExitRequestWhereInput>(scope, {
        id,
        employeeId,
      }),
      include: INCLUDE,
    });
    return row ? toView(row) : null;
  }

  /**
   * Submits a request for an employee. Under the employee lock, refuses while
   * one is active (legacy `hasActiveRequest`). The partial unique index is the
   * backstop if two submissions race past the check.
   */
  @OrgScoped()
  async create(
    scope: OrgScope,
    input: NewExitRequest,
    actorId: number,
  ): Promise<ExitRequestView> {
    const preferred = parseDateOnly(input.preferredLastWorkingDate);
    try {
      return await this.prisma.$transaction(async (tx) => {
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
        const active = await tx.exitRequest.findFirst({
          where: {
            organizationId: scope.organizationId,
            employeeId: input.employeeId,
            status: { in: [...ACTIVE_STATUSES] },
          },
          select: { id: true },
        });
        if (active) throw new ActiveExitRequestExistsException();

        const created = await tx.exitRequest.create({
          data: {
            organizationId: scope.organizationId,
            employeeId: input.employeeId,
            status: "SUBMITTED",
            reason: input.reason,
            preferredLastWorkingDate: preferred,
            noticePeriodDays: input.noticePeriodDays,
            additionalNotes: input.additionalNotes ?? null,
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
    } catch (error) {
      throw translateDbError(error, {
        [ACTIVE_INDEX]: new ActiveExitRequestExistsException(),
      });
    }
  }

  /**
   * Applies an HR decision or edit inside the caller's decision scope.
   * Lock the row → find it through the scope (else `null` → 404) → refuse the
   * caller's own request → refuse any change to a final request → check the
   * transition → conditional update on the status read under the lock → audit.
   */
  @TeamScoped()
  async update(
    scope: TeamScope,
    id: number,
    reviewerEmployeeId: number | null,
    change: ExitRequestUpdate,
    actorId: number,
  ): Promise<ExitRequestView | null> {
    return this.prisma.$transaction(async (tx) => {
      // Employee lock first (the order used by every writer), then the row.
      // The probe is organization-wide only to learn which employee to lock;
      // an out-of-scope id still ends as `null` (→ 404) below.
      const probe = await tx.exitRequest.findFirst({
        where: { id, organizationId: scope.organizationId },
        select: { employeeId: true },
      });
      if (!probe) return null;
      await lockEmployee(tx, scope.organizationId, probe.employeeId);
      await tx.$queryRaw`
        SELECT id FROM hr.exit_requests
         WHERE id = ${id} AND organization_id = ${scope.organizationId} FOR UPDATE`;

      const before = await tx.exitRequest.findFirst({
        where: teamWhere(scope, { id }, VIA_EMPLOYEE),
        include: INCLUDE,
      });
      if (!before) return null;

      if (
        reviewerEmployeeId !== null &&
        before.employee.id === reviewerEmployeeId
      ) {
        throw new ExitRequestSelfDecisionForbiddenException();
      }
      const from = before.status as ExitRequestStatus;
      const to = change.status ?? from;
      const statusMoves = change.status !== undefined;

      if (isTerminal(from)) {
        throw new InvalidStateTransitionException(
          "Exit request",
          from,
          to,
          "a rejected or completed exit request is final",
        );
      }
      // Naming the current status is refused, so a second approval cannot pass
      // as a harmless field edit. Field-only edits omit `status`.
      if (statusMoves && to === from) {
        throw new InvalidStateTransitionException(
          "Exit request",
          from,
          to,
          "already in that status",
        );
      }
      if (statusMoves && !canTransition(from, to)) {
        throw new InvalidStateTransitionException("Exit request", from, to);
      }

      const decision = statusMoves && isDecision(to);
      const data: Prisma.ExitRequestUncheckedUpdateManyInput = {
        updatedBy: actorId,
        ...(statusMoves ? { status: to } : {}),
        ...(decision ? { decidedBy: actorId, decidedAt: new Date() } : {}),
        ...(change.confirmedLastWorkingDate !== undefined
          ? {
              confirmedLastWorkingDate: parseDateOnly(
                change.confirmedLastWorkingDate,
              ),
            }
          : {}),
        ...(change.settlementStatus !== undefined
          ? { settlementStatus: change.settlementStatus }
          : {}),
        ...(change.hrNote !== undefined
          ? { hrNote: change.hrNote === "" ? null : change.hrNote }
          : {}),
      };

      // Conditional on the status read under the lock: a concurrent decision
      // that won the race makes this a no-op, reported as a conflict.
      const applied = await tx.exitRequest.updateMany({
        where: { id, status: from },
        data,
      });
      if (applied.count !== 1) {
        throw new InvalidStateTransitionException(
          "Exit request",
          from,
          to,
          "the request changed while it was being reviewed; reload and try again",
        );
      }

      const after = await tx.exitRequest.findUniqueOrThrow({
        where: { id },
        include: INCLUDE,
      });
      await this.audit.write(tx, {
        entityType: ENTITY_TYPE,
        entityId: id,
        action: actionFor(from, to),
        before: snapshot(before),
        after: snapshot(after),
      });
      return toView(after);
    });
  }

  private async page(
    where: Prisma.ExitRequestWhereInput,
    pagination: PaginationDto,
  ) {
    const [rows, total] = await Promise.all([
      this.prisma.exitRequest.findMany({
        where,
        include: INCLUDE,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: [{ createdAt: pagination.order ?? "desc" }, { id: "desc" }],
      }),
      this.prisma.exitRequest.count({ where }),
    ]);
    return { items: rows.map(toView), total };
  }
}

/** Serialises writes for one employee's exit requests. Transaction-scoped:
 * released on commit or rollback. Always taken before the row lock. */
async function lockEmployee(
  tx: Prisma.TransactionClient,
  organizationId: number,
  employeeId: number,
) {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`exit:${organizationId}:${employeeId}`}))::text`;
}
