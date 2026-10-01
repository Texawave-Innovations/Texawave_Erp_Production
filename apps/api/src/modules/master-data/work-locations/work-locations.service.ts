import { Injectable } from "@nestjs/common";
import { PaginatedResponseDto } from "../../../common/dto/paginated-response.dto.js";
import {
  ResourceConflictException,
  ResourceNotFoundException,
} from "../../../common/exceptions/business.exception.js";
import { TenantContextService } from "../../../platform/tenancy/tenant-context.service.js";
import type { CreateWorkLocationDto } from "./dto/create-work-location.dto.js";
import type { QueryWorkLocationDto } from "./dto/query-work-location.dto.js";
import type { UpdateWorkLocationDto } from "./dto/update-work-location.dto.js";
import { WorkLocationsRepository } from "./work-locations.repository.js";

@Injectable()
export class WorkLocationsService {
  constructor(
    private readonly repository: WorkLocationsRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  async findAll(query: QueryWorkLocationDto) {
    const scope = this.tenantContext.getOrgScope();
    const { items, total } = await this.repository.findMany(
      scope,
      { search: query.search, isActive: query.isActive, sortBy: query.sortBy },
      query,
    );
    return new PaginatedResponseDto(items, total, query.page, query.limit);
  }

  async findOne(id: number) {
    const row = await this.repository.findOne(
      this.tenantContext.getOrgScope(),
      id,
    );
    if (!row) {
      throw new ResourceNotFoundException("Work location", id);
    }
    return row;
  }

  async create(dto: CreateWorkLocationDto) {
    const scope = this.tenantContext.getOrgScope();
    if (await this.repository.findByCode(scope, dto.code)) {
      throw new ResourceConflictException(
        `A work location with code "${dto.code}" already exists`,
      );
    }
    if (await this.repository.findByName(scope, dto.name)) {
      throw new ResourceConflictException(
        `A work location named "${dto.name}" already exists`,
      );
    }
    return this.repository.create(scope, dto, this.tenantContext.getUserId());
  }

  async update(id: number, dto: UpdateWorkLocationDto) {
    const scope = this.tenantContext.getOrgScope();
    if (dto.name !== undefined) {
      const clash = await this.repository.findByName(scope, dto.name);
      if (clash && clash.id !== id) {
        throw new ResourceConflictException(
          `A work location named "${dto.name}" already exists`,
        );
      }
    }
    const updated = await this.repository.update(
      scope,
      id,
      dto,
      this.tenantContext.getUserId(),
    );
    if (!updated) {
      throw new ResourceNotFoundException("Work location", id);
    }
    return updated;
  }

  /** Idempotent: setting the state it is already in changes nothing and
   * writes no audit row. */
  async setActive(id: number, isActive: boolean) {
    const updated = await this.repository.setActive(
      this.tenantContext.getOrgScope(),
      id,
      isActive,
      this.tenantContext.getUserId(),
    );
    if (!updated) {
      throw new ResourceNotFoundException("Work location", id);
    }
    return updated;
  }
}
