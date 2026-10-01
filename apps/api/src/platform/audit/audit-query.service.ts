import { BadRequestException, Injectable } from "@nestjs/common";
import { PaginatedResponseDto } from "../../common/dto/paginated-response.dto.js";
import type { PaginationDto } from "../../common/dto/pagination.dto.js";
import { TenantContextService } from "../tenancy/tenant-context.service.js";
import { AuditRepository } from "./audit.repository.js";
import type { QueryAuditLogDto } from "./dto/query-audit-log.dto.js";

/** Public read surface of the audit trail. Domain modules call
 * `history()` for "the history of this employee/leave request" — they never
 * import `AuditRepository` (module-boundary rule). Always organization-scoped. */
@Injectable()
export class AuditQueryService {
  constructor(
    private readonly repository: AuditRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  async findAll(query: QueryAuditLogDto) {
    if (query.entityId !== undefined && !query.entityType) {
      throw new BadRequestException("entityId requires entityType");
    }
    const from = query.from ? new Date(query.from) : undefined;
    const to = query.to ? new Date(query.to) : undefined;
    if (from && to && from >= to) {
      throw new BadRequestException("`from` must be earlier than `to`");
    }
    const { items, total } = await this.repository.findMany(
      this.tenantContext.getOrgScope(),
      {
        entityType: query.entityType,
        entityId: query.entityId,
        actorUserId: query.actorUserId,
        action: query.action,
        from,
        to,
      },
      query,
    );
    return new PaginatedResponseDto(items, total, query.page, query.limit);
  }

  /** Newest first. The caller has already established that the current user
   * may see this entity — audit visibility follows entity visibility. */
  async history(
    entityType: string,
    entityId: number,
    pagination: PaginationDto,
  ) {
    const { items, total } = await this.repository.findMany(
      this.tenantContext.getOrgScope(),
      { entityType, entityId },
      pagination,
    );
    return new PaginatedResponseDto(
      items,
      total,
      pagination.page,
      pagination.limit,
    );
  }
}
