import { Injectable } from "@nestjs/common";
import { PaginatedResponseDto } from "../../../common/dto/paginated-response.dto.js";
import {
  BusinessRuleViolationException,
  ResourceNotFoundException,
} from "../../../common/exceptions/business.exception.js";
import { TenantContextService } from "../../../platform/tenancy/tenant-context.service.js";
import type {
  QueryRecycleBinDto,
  RecycleBinEntityType,
} from "./dto/recycle-bin.dto.js";
import { RecycleBinRepository } from "./recycle-bin.repository.js";
import { RecycleBinHandlers } from "./recycle-bin.handlers.js";
import type {
  RecycleBinHandler,
  RecycleBinItem,
} from "./recycle-bin.registry.js";

@Injectable()
export class RecycleBinService {
  constructor(
    private readonly handlers: RecycleBinHandlers,
    private readonly tenantContext: TenantContextService,
    private readonly repository: RecycleBinRepository,
  ) {}

  private handlerFor(entityType: RecycleBinEntityType): RecycleBinHandler {
    const handler = this.handlers.all.find((h) => h.entityType === entityType);
    if (!handler) throw new ResourceNotFoundException("RecycleBinType", 0);
    return handler;
  }

  private async collect(entityType?: RecycleBinEntityType) {
    const scope = this.tenantContext.getOrgScope();
    const selected = entityType
      ? [this.handlerFor(entityType)]
      : this.handlers.all;
    const lists = await Promise.all(selected.map((h) => h.list(scope)));
    return lists.flat();
  }

  async findAll(query: QueryRecycleBinDto) {
    let items: RecycleBinItem[] = await this.collect(query.entityType);
    if (query.search) {
      const needle = query.search.toLowerCase();
      items = items.filter((i) =>
        `${i.label} ${i.subtitle ?? ""} ${i.entityTypeLabel}`
          .toLowerCase()
          .includes(needle),
      );
    }
    items.sort((a, b) => b.deletedAt.getTime() - a.deletedAt.getTime());
    const scope = this.tenantContext.getOrgScope();
    const slice = items.slice(query.skip, query.skip + query.limit);
    const names = await this.repository.userNames(
      scope,
      slice.map((i) => i.deletedBy),
    );
    const cascade = await this.repository.accountCascadeCounts(
      scope,
      slice
        .filter((i) => i.entityType === "account")
        .map((i) => ({ id: i.id, deletedAt: i.deletedAt })),
    );
    const page = slice.map((i) => ({
      ...i,
      deletedByName: i.deletedBy ? (names.get(i.deletedBy) ?? null) : null,
      ...(i.entityType === "account"
        ? { relatedCount: cascade.get(i.id) ?? 0 }
        : {}),
    }));
    return new PaginatedResponseDto(
      page,
      items.length,
      query.page,
      query.limit,
    );
  }

  /** Per-type counts for the tab badges. */
  async summary() {
    const scope = this.tenantContext.getOrgScope();
    const counts = await Promise.all(
      this.handlers.all.map(async (h) => ({
        entityType: h.entityType,
        entityTypeLabel: h.entityTypeLabel,
        count: (await h.list(scope)).length,
      })),
    );
    return { total: counts.reduce((n, c) => n + c.count, 0), types: counts };
  }

  async restore(entityType: RecycleBinEntityType, id: number) {
    const row = await this.handlerFor(entityType).restore(
      this.tenantContext.getOrgScope(),
      id,
      this.tenantContext.getUserId(),
    );
    if (!row) throw new ResourceNotFoundException("RecycleBinEntry", id);
    return { entityType, id, restored: true };
  }

  async purge(entityType: RecycleBinEntityType, id: number, confirm: boolean) {
    if (confirm !== true) {
      throw new BusinessRuleViolationException(
        "Permanent delete is irreversible and requires explicit confirmation",
        "CONFIRMATION_REQUIRED",
      );
    }
    const row = await this.handlerFor(entityType).purge(
      this.tenantContext.getOrgScope(),
      id,
    );
    if (!row) throw new ResourceNotFoundException("RecycleBinEntry", id);
    return { entityType, id, purged: true };
  }
}
