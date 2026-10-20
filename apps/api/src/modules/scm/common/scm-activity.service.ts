import { Injectable } from "@nestjs/common";
import { OrgScoped } from "../../../common/decorators/org-scoped.decorator.js";
import { PaginatedResponseDto } from "../../../common/dto/paginated-response.dto.js";
import type { PaginationDto } from "../../../common/dto/pagination.dto.js";
import type { OrgScope } from "../../../common/tenancy/org-scope.js";
import { TenantContextService } from "../../../platform/tenancy/tenant-context.service.js";
import { PrismaService } from "../../../shared/prisma/prisma.service.js";

export interface ScmActivityRow {
  id: number;
  entityType: string;
  entityId: number;
  action: string;
  before: unknown;
  after: unknown;
  reason: string | null;
  at: Date;
  byName: string | null;
}

/** Audit-backed activity feed shared by the Quality and Warehouse activity
 * pages (legacy read these from per-record `auditLogs` trees). */
@Injectable()
export class ScmActivityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async list(entityTypes: string[], page: PaginationDto, q?: string) {
    const { items, total } = await this.find(
      this.tenantContext.getOrgScope(),
      entityTypes,
      page,
      q,
    );
    return new PaginatedResponseDto(items, total, page.page, page.limit);
  }

  @OrgScoped()
  private async find(
    scope: OrgScope,
    entityTypes: string[],
    page: PaginationDto,
    q?: string,
  ): Promise<{ items: ScmActivityRow[]; total: number }> {
    const where = {
      organizationId: scope.organizationId,
      entityType: { in: entityTypes },
      ...(q
        ? {
            OR: [
              { action: { contains: q, mode: "insensitive" as const } },
              { reason: { contains: q, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };
    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { id: "desc" },
        skip: page.skip,
        take: page.limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    const actorIds = [
      ...new Set(
        logs.map((l) => l.actorUserId).filter((v): v is number => v !== null),
      ),
    ];
    const users = actorIds.length
      ? await this.prisma.user.findMany({
          where: { organizationId: scope.organizationId, id: { in: actorIds } },
          select: { id: true, fullName: true },
        })
      : [];
    const names = new Map(users.map((u) => [u.id, u.fullName]));
    return {
      total,
      items: logs.map((l) => ({
        id: Number(l.id),
        entityType: l.entityType,
        entityId: Number(l.entityId),
        action: l.action,
        before: l.before,
        after: l.after,
        reason: l.reason,
        at: l.at,
        byName: l.actorUserId ? (names.get(l.actorUserId) ?? null) : null,
      })),
    };
  }
}
