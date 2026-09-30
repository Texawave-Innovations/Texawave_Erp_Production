import { Injectable } from "@nestjs/common";
import type { Prisma } from "@texawave-erp/database";
import { OrgScoped } from "../../common/decorators/org-scoped.decorator.js";
import type { PaginationDto } from "../../common/dto/pagination.dto.js";
import type { OrgScope } from "../../common/tenancy/org-scope.js";
import { tenantWhere } from "../../common/tenancy/tenant-where.js";
import { PrismaService } from "../../shared/prisma/prisma.service.js";

export interface AuditLogFilter {
  entityType?: string | undefined;
  entityId?: number | undefined;
  actorUserId?: number | undefined;
  action?: string | undefined;
  from?: Date | undefined;
  to?: Date | undefined;
}

/** What the API returns. `id` is a string because it is a BigInt (JSON cannot
 * carry one); `entityId` is a number because every audited entity has an Int
 * primary key. */
export interface AuditLogView {
  id: string;
  entityType: string;
  entityId: number;
  action: string;
  actorType: string;
  actorUserId: number | null;
  actorName: string | null;
  before: unknown;
  after: unknown;
  reason: string | null;
  ip: string | null;
  correlationId: string | null;
  at: Date;
}

/** READ-ONLY. Writes go through `AuditWriter` inside the caller's
 * transaction; there is deliberately no update/delete here (and the table's
 * triggers would reject one anyway). */
@Injectable()
export class AuditRepository {
  constructor(private readonly prisma: PrismaService) {}

  @OrgScoped()
  async findMany(
    scope: OrgScope,
    filter: AuditLogFilter,
    pagination: PaginationDto,
  ): Promise<{ items: AuditLogView[]; total: number }> {
    const where = tenantWhere<Prisma.AuditLogWhereInput>(scope, {
      ...(filter.entityType ? { entityType: filter.entityType } : {}),
      ...(filter.entityId !== undefined
        ? { entityId: BigInt(filter.entityId) }
        : {}),
      ...(filter.actorUserId !== undefined
        ? { actorUserId: filter.actorUserId }
        : {}),
      ...(filter.action ? { action: filter.action } : {}),
      ...(filter.from || filter.to
        ? {
            at: {
              ...(filter.from ? { gte: filter.from } : {}),
              ...(filter.to ? { lt: filter.to } : {}),
            },
          }
        : {}),
    });

    const [rows, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: { id: pagination.order ?? "desc" },
        include: { actor: { select: { fullName: true } } },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      items: rows.map((row) => ({
        id: row.id.toString(),
        entityType: row.entityType,
        entityId: Number(row.entityId),
        action: row.action,
        actorType: row.actorType,
        actorUserId: row.actorUserId,
        actorName: row.actor?.fullName ?? null,
        before: row.before,
        after: row.after,
        reason: row.reason,
        ip: row.ip,
        correlationId: row.correlationId,
        at: row.at,
      })),
      total,
    };
  }
}
