import { Injectable } from "@nestjs/common";
import { PaginationDto } from "../../../common/dto/pagination.dto.js";
import { PaginatedResponseDto } from "../../../common/dto/paginated-response.dto.js";
import { ResourceNotFoundException } from "../../../common/exceptions/business.exception.js";
import { TenantContextService } from "../../../platform/tenancy/tenant-context.service.js";
import { CrmTasksRepository, type CrmTaskFilter } from "./tasks.repository.js";
import type {
  CreateCrmTaskDto,
  QueryCrmTaskDto,
  UpdateCrmTaskDto,
  UpdateCrmTaskStatusDto,
} from "./dto/task.dto.js";

@Injectable()
export class CrmTasksService {
  constructor(
    private readonly repository: CrmTasksRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  async findAll(query: QueryCrmTaskDto) {
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
    return new PaginatedResponseDto(items, total, query.page, query.limit);
  }

  /** Read-only feed for global search / calendar (additive): same org
   * scoping as findAll, capped at `limit`. */
  async findFeed(filter: CrmTaskFilter, limit: number) {
    const { items } = await this.repository.findMany(
      this.tenantContext.getOrgScope(),
      filter,
      Object.assign(new PaginationDto(), { limit }),
    );
    return items;
  }

  async findOne(id: number) {
    const row = await this.repository.findOne(
      this.tenantContext.getOrgScope(),
      id,
    );
    if (!row) throw new ResourceNotFoundException("CrmTask", id);
    return row;
  }

  create(dto: CreateCrmTaskDto) {
    return this.repository.create(
      this.tenantContext.getOrgScope(),
      dto,
      this.tenantContext.getUserId(),
    );
  }

  async update(id: number, dto: UpdateCrmTaskDto) {
    const row = await this.repository.update(
      this.tenantContext.getOrgScope(),
      id,
      dto,
      this.tenantContext.getUserId(),
    );
    if (!row) throw new ResourceNotFoundException("CrmTask", id);
    return row;
  }

  async updateStatus(id: number, dto: UpdateCrmTaskStatusDto) {
    const row = await this.repository.updateStatus(
      this.tenantContext.getOrgScope(),
      id,
      dto.status,
      this.tenantContext.getUserId(),
    );
    if (!row) throw new ResourceNotFoundException("CrmTask", id);
    return row;
  }

  async remove(id: number) {
    const row = await this.repository.softDelete(
      this.tenantContext.getOrgScope(),
      id,
      this.tenantContext.getUserId(),
    );
    if (!row) throw new ResourceNotFoundException("CrmTask", id);
    return row;
  }
}
