import { Injectable } from "@nestjs/common";
import { PaginatedResponseDto } from "../../../common/dto/paginated-response.dto.js";
import { ResourceNotFoundException } from "../../../common/exceptions/business.exception.js";
import { TenantContextService } from "../../../platform/tenancy/tenant-context.service.js";
import { ActivitiesRepository } from "./activities.repository.js";
import type {
  CreateActivityDto,
  QueryActivityDto,
  UpdateActivityDto,
} from "./dto/activity.dto.js";

@Injectable()
export class ActivitiesService {
  constructor(
    private readonly repository: ActivitiesRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  async findAll(query: QueryActivityDto) {
    const { items, total } = await this.repository.findMany(
      this.tenantContext.getOrgScope(),
      {
        relatedType: query.relatedType,
        relatedId: query.relatedId,
        type: query.type,
      },
      query,
    );
    return new PaginatedResponseDto(items, total, query.page, query.limit);
  }

  async findOne(id: number) {
    const row = await this.repository.findOne(
      this.tenantContext.getOrgScope(),
      id,
    );
    if (!row) throw new ResourceNotFoundException("Activity", id);
    return row;
  }

  create(dto: CreateActivityDto) {
    return this.repository.create(
      this.tenantContext.getOrgScope(),
      dto,
      this.tenantContext.getUserId(),
    );
  }

  async update(id: number, dto: UpdateActivityDto) {
    const row = await this.repository.update(
      this.tenantContext.getOrgScope(),
      id,
      dto,
      this.tenantContext.getUserId(),
    );
    if (!row) throw new ResourceNotFoundException("Activity", id);
    return row;
  }

  async remove(id: number) {
    const row = await this.repository.softDelete(
      this.tenantContext.getOrgScope(),
      id,
      this.tenantContext.getUserId(),
    );
    if (!row) throw new ResourceNotFoundException("Activity", id);
    return row;
  }
}
