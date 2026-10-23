import { Injectable } from "@nestjs/common";
import { PaginationDto } from "../../../common/dto/pagination.dto.js";
import { PaginatedResponseDto } from "../../../common/dto/paginated-response.dto.js";
import { ResourceNotFoundException } from "../../../common/exceptions/business.exception.js";
import { TenantContextService } from "../../../platform/tenancy/tenant-context.service.js";
import type {
  CreateFollowUpDto,
  QueryFollowUpDto,
  RescheduleFollowUpDto,
  UpdateFollowUpDto,
  UpdateFollowUpStatusDto,
} from "./dto/follow-up.dto.js";
import {
  FollowUpsRepository,
  type FollowUpFilter,
} from "./follow-ups.repository.js";

/** Legacy `getEffectiveFollowUpStatus()` — DISPLAY only, never persisted
 * (see the repository's own comment). A PENDING row whose `scheduledAt` has
 * passed is shown as OVERDUE without mutating the stored row, avoiding a
 * write race between concurrent viewers — reproduced exactly. */
function withEffectiveStatus<T extends { status: string; scheduledAt: Date }>(
  row: T,
): T & { effectiveStatus: string } {
  if (row.status !== "PENDING") return { ...row, effectiveStatus: row.status };
  return {
    ...row,
    effectiveStatus:
      row.scheduledAt.getTime() < Date.now() ? "OVERDUE" : "PENDING",
  };
}

@Injectable()
export class FollowUpsService {
  constructor(
    private readonly repository: FollowUpsRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  async findAll(query: QueryFollowUpDto) {
    const { items, total } = await this.repository.findMany(
      this.tenantContext.getOrgScope(),
      {
        relatedType: query.relatedType,
        relatedId: query.relatedId,
        rollupAccountId: query.rollupAccountId,
        status: query.status,
      },
      query,
    );
    return new PaginatedResponseDto(
      items.map(withEffectiveStatus),
      total,
      query.page,
      query.limit,
    );
  }

  /** Read-only feed for global search / calendar (additive): same org
   * scoping as findAll, capped at `limit`. */
  async findFeed(filter: FollowUpFilter, limit: number) {
    const { items } = await this.repository.findMany(
      this.tenantContext.getOrgScope(),
      filter,
      Object.assign(new PaginationDto(), { limit }),
    );
    return items.map(withEffectiveStatus);
  }

  async findOne(id: number) {
    const row = await this.repository.findOne(
      this.tenantContext.getOrgScope(),
      id,
    );
    if (!row) throw new ResourceNotFoundException("FollowUp", id);
    return withEffectiveStatus(row);
  }

  create(dto: CreateFollowUpDto) {
    return this.repository.create(
      this.tenantContext.getOrgScope(),
      dto,
      this.tenantContext.getUserId(),
    );
  }

  async update(id: number, dto: UpdateFollowUpDto) {
    const row = await this.repository.update(
      this.tenantContext.getOrgScope(),
      id,
      dto,
      this.tenantContext.getUserId(),
    );
    if (!row) throw new ResourceNotFoundException("FollowUp", id);
    return row;
  }

  async updateStatus(id: number, dto: UpdateFollowUpStatusDto) {
    const row = await this.repository.updateStatus(
      this.tenantContext.getOrgScope(),
      id,
      dto,
      this.tenantContext.getUserId(),
    );
    if (!row) throw new ResourceNotFoundException("FollowUp", id);
    return row;
  }

  async reschedule(id: number, dto: RescheduleFollowUpDto) {
    const row = await this.repository.reschedule(
      this.tenantContext.getOrgScope(),
      id,
      dto,
      this.tenantContext.getUserId(),
    );
    if (!row) throw new ResourceNotFoundException("FollowUp", id);
    return row;
  }

  async remove(id: number) {
    const row = await this.repository.softDelete(
      this.tenantContext.getOrgScope(),
      id,
      this.tenantContext.getUserId(),
    );
    if (!row) throw new ResourceNotFoundException("FollowUp", id);
    return row;
  }
}
