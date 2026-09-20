import { Injectable } from "@nestjs/common";
import { PaginatedResponseDto } from "../../../common/dto/paginated-response.dto.js";
import type { PaginationDto } from "../../../common/dto/pagination.dto.js";
import {
  ResourceConflictException,
  ResourceNotFoundException,
} from "../../../common/exceptions/business.exception.js";
import { TenantContextService } from "../../../platform/tenancy/tenant-context.service.js";
import type { CreateTagDto } from "./dto/create-tag.dto.js";
import type { QueryTagDto } from "./dto/query-tag.dto.js";
import type { UpdateTagDto } from "./dto/update-tag.dto.js";
import { TagsRepository } from "./tags.repository.js";

@Injectable()
export class TagsService {
  constructor(
    private readonly repository: TagsRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  async findAll(query: QueryTagDto) {
    const scope = this.tenantContext.getOrgScope();
    const pagination: PaginationDto = query;
    const { items, total } = await this.repository.findMany(
      scope,
      { search: query.search },
      pagination,
    );
    return new PaginatedResponseDto(
      items,
      total,
      pagination.page,
      pagination.limit,
    );
  }

  async findOne(id: string) {
    const scope = this.tenantContext.getOrgScope();
    const tag = await this.repository.findOne(scope, id);
    if (!tag) {
      throw new ResourceNotFoundException("Tag", id);
    }
    return tag;
  }

  async create(dto: CreateTagDto) {
    const scope = this.tenantContext.getOrgScope();
    const existing = await this.repository.findByName(scope, dto.name);
    if (existing) {
      throw new ResourceConflictException(
        `A tag named "${dto.name}" already exists`,
      );
    }
    return this.repository.create(scope, dto, this.tenantContext.getUserId());
  }

  async update(id: string, dto: UpdateTagDto) {
    const scope = this.tenantContext.getOrgScope();
    const updated = await this.repository.update(
      scope,
      id,
      dto,
      this.tenantContext.getUserId(),
    );
    if (!updated) {
      throw new ResourceNotFoundException("Tag", id);
    }
    return updated;
  }

  async remove(id: string): Promise<void> {
    const scope = this.tenantContext.getOrgScope();
    const deleted = await this.repository.softDelete(
      scope,
      id,
      this.tenantContext.getUserId(),
    );
    if (!deleted) {
      throw new ResourceNotFoundException("Tag", id);
    }
  }
}
