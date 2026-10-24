import { Injectable } from "@nestjs/common";
import { PaginatedResponseDto } from "../../../common/dto/paginated-response.dto.js";
import { ResourceNotFoundException } from "../../../common/exceptions/business.exception.js";
import { TenantContextService } from "../../../platform/tenancy/tenant-context.service.js";
import type { CreateMasterListItemDto } from "./dto/create-master-list-item.dto.js";
import type { QueryMasterListItemDto } from "./dto/query-master-list-item.dto.js";
import type { UpdateMasterListItemDto } from "./dto/update-master-list-item.dto.js";
import { MasterListItemsRepository } from "./master-list-items.repository.js";

@Injectable()
export class MasterListItemsService {
  constructor(
    private readonly repository: MasterListItemsRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  async findAll(query: QueryMasterListItemDto) {
    const scope = this.tenantContext.getOrgScope();
    const { items, total } = await this.repository.findMany(scope, query);
    return new PaginatedResponseDto(items, total, query.page, query.limit);
  }

  async findOne(id: number) {
    const scope = this.tenantContext.getOrgScope();
    const item = await this.repository.findOne(scope, id);
    if (!item) {
      throw new ResourceNotFoundException("Master list item", id);
    }
    return item;
  }

  create(dto: CreateMasterListItemDto) {
    const scope = this.tenantContext.getOrgScope();
    return this.repository.create(scope, dto, this.tenantContext.getUserId());
  }

  async update(id: number, dto: UpdateMasterListItemDto) {
    const scope = this.tenantContext.getOrgScope();
    const updated = await this.repository.update(
      scope,
      id,
      dto,
      this.tenantContext.getUserId(),
    );
    if (!updated) {
      throw new ResourceNotFoundException("Master list item", id);
    }
    return updated;
  }

  async remove(id: number): Promise<void> {
    const scope = this.tenantContext.getOrgScope();
    const deleted = await this.repository.softDelete(
      scope,
      id,
      this.tenantContext.getUserId(),
    );
    if (!deleted) {
      throw new ResourceNotFoundException("Master list item", id);
    }
  }
}
