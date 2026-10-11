import { Injectable } from "@nestjs/common";
import type { Prisma } from "@texawave-erp/database";
import {
  formatDateOnly,
  parseDateOnly,
} from "../../../common/dates/date-only.js";
import { OrgScoped } from "../../../common/decorators/org-scoped.decorator.js";
import type { PaginationDto } from "../../../common/dto/pagination.dto.js";
import {
  BusinessRuleConflictException,
  BusinessRuleViolationException,
} from "../../../common/exceptions/business.exception.js";
import type { OrgScope } from "../../../common/tenancy/org-scope.js";
import { tenantWhere } from "../../../common/tenancy/tenant-where.js";
import { AuditWriter } from "../../../platform/audit/audit-writer.js";
import { PrismaService } from "../../../shared/prisma/prisma.service.js";
import { APPROVE_CODES } from "./leave-requests.repository.js";

const ENTITY_TYPE = "leave_delegation";

const INCLUDE = {
  delegator: { select: { id: true, fullName: true } },
  delegate: { select: { id: true, fullName: true } },
} satisfies Prisma.LeaveApprovalDelegationInclude;
type DelegationRow = Prisma.LeaveApprovalDelegationGetPayload<{
  include: typeof INCLUDE;
}>;

export interface LeaveDelegationView {
  id: number;
  delegator: { id: number; fullName: string };
  delegate: { id: number; fullName: string };
  startDate: string;
  endDate: string;
  reason: string | null;
  isActive: boolean;
  createdAt: Date;
}

function toView(row: DelegationRow): LeaveDelegationView {
  return {
    id: row.id,
    delegator: row.delegator,
    delegate: row.delegate,
    startDate: formatDateOnly(row.startDate),
    endDate: formatDateOnly(row.endDate),
    reason: row.reason,
    isActive: row.isActive,
    createdAt: row.createdAt,
  };
}

function snapshot(row: DelegationRow) {
  return {
    delegatorUserId: row.delegatorUserId,
    delegateUserId: row.delegateUserId,
    startDate: formatDateOnly(row.startDate),
    endDate: formatDateOnly(row.endDate),
    isActive: row.isActive,
  };
}

/**
 * Leave approval delegations (Docs/HR_LEAVE.md §6.2). User-to-user rows, not
 * employee data: every read and write is keyed by the organization AND the
 * caller as delegator (writes) or as delegator/delegate (reads), so a user
 * only ever sees or changes delegations they are part of.
 */
@Injectable()
export class LeaveDelegationsRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditWriter,
  ) {}

  /** Delegations the caller gave or received, newest first. */
  @OrgScoped()
  async findMine(
    scope: OrgScope,
    userId: number,
    activeOnly: boolean,
    pagination: PaginationDto,
  ) {
    const where = tenantWhere<Prisma.LeaveApprovalDelegationWhereInput>(scope, {
      OR: [{ delegatorUserId: userId }, { delegateUserId: userId }],
      ...(activeOnly ? { isActive: true } : {}),
    });
    const [rows, total] = await Promise.all([
      this.prisma.leaveApprovalDelegation.findMany({
        where,
        include: INCLUDE,
        orderBy: [{ startDate: "desc" }, { id: "desc" }],
        skip: pagination.skip,
        take: pagination.limit,
      }),
      this.prisma.leaveApprovalDelegation.count({ where }),
    ]);
    return { items: rows.map(toView), total };
  }

  /**
   * Creates a delegation FROM the caller. The delegate must be another active
   * user of the organization who holds some `hr.leave.approve` grant (without
   * one, the route guard would refuse them anyway). One stand-in at a time:
   * a range overlapping another active delegation of the caller is refused.
   * Serialised per delegator by an advisory lock, so two concurrent creates
   * cannot both pass the overlap check.
   */
  @OrgScoped()
  async create(
    scope: OrgScope,
    delegatorUserId: number,
    input: {
      delegateUserId: number;
      startDate: string;
      endDate: string;
      reason?: string | undefined;
    },
  ): Promise<LeaveDelegationView> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`leave-delegation:${scope.organizationId}:${delegatorUserId}`}))::text`;
      const delegate = await tx.user.findFirst({
        where: {
          id: input.delegateUserId,
          organizationId: scope.organizationId,
          isActive: true,
          deletedAt: null,
        },
        select: {
          id: true,
          userRoles: {
            where: {
              isActive: true,
              role: {
                organizationId: scope.organizationId,
                isActive: true,
                rolePermissions: {
                  some: {
                    isActive: true,
                    permission: {
                      code: { in: Object.values(APPROVE_CODES) },
                      isActive: true,
                    },
                  },
                },
              },
            },
            select: { roleId: true },
          },
        },
      });
      if (!delegate) {
        throw new BusinessRuleViolationException(
          "The delegate must be an active user of this organization",
          "INVALID_DELEGATE",
        );
      }
      if (delegate.userRoles.length === 0) {
        throw new BusinessRuleViolationException(
          "The delegate holds no leave approval permission, so they could not act on your behalf",
          "DELEGATE_CANNOT_APPROVE",
        );
      }
      const overlap = await tx.leaveApprovalDelegation.findFirst({
        where: {
          organizationId: scope.organizationId,
          delegatorUserId,
          isActive: true,
          startDate: { lte: parseDateOnly(input.endDate) },
          endDate: { gte: parseDateOnly(input.startDate) },
        },
        select: { id: true, startDate: true, endDate: true },
      });
      if (overlap) {
        throw new BusinessRuleConflictException(
          `You already have an active delegation from ${formatDateOnly(overlap.startDate)} to ${formatDateOnly(overlap.endDate)} (#${overlap.id}); revoke it first`,
          "LEAVE_DELEGATION_OVERLAP",
        );
      }
      const row = await tx.leaveApprovalDelegation.create({
        data: {
          organizationId: scope.organizationId,
          delegatorUserId,
          delegateUserId: input.delegateUserId,
          startDate: parseDateOnly(input.startDate),
          endDate: parseDateOnly(input.endDate),
          reason: input.reason ?? null,
          createdBy: delegatorUserId,
          updatedBy: delegatorUserId,
        },
        include: INCLUDE,
      });
      await this.audit.write(tx, {
        entityType: ENTITY_TYPE,
        entityId: row.id,
        action: "create",
        after: snapshot(row),
      });
      return toView(row);
    });
  }

  /** Revokes one of the CALLER'S OWN delegations. Another user's id, or
   * another organization's, is null (→ 404). Revoking twice is a no-op. */
  @OrgScoped()
  async revoke(
    scope: OrgScope,
    delegatorUserId: number,
    id: number,
  ): Promise<LeaveDelegationView | null> {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.leaveApprovalDelegation.findFirst({
        where: tenantWhere<Prisma.LeaveApprovalDelegationWhereInput>(scope, {
          id,
          delegatorUserId,
        }),
        include: INCLUDE,
      });
      if (!before) return null;
      if (!before.isActive) return toView(before);
      const after = await tx.leaveApprovalDelegation.update({
        where: { id },
        data: { isActive: false, updatedBy: delegatorUserId },
        include: INCLUDE,
      });
      await this.audit.write(tx, {
        entityType: ENTITY_TYPE,
        entityId: id,
        action: "revoke",
        before: snapshot(before),
        after: snapshot(after),
      });
      return toView(after);
    });
  }
}
