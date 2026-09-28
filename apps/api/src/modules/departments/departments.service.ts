import { Injectable } from "@nestjs/common";
import { PaginatedResponseDto } from "../../common/dto/paginated-response.dto.js";
import type { PaginationDto } from "../../common/dto/pagination.dto.js";
import {
  ResourceConflictException,
  ResourceNotFoundException,
} from "../../common/exceptions/business.exception.js";
import { TenantContextService } from "../../platform/tenancy/tenant-context.service.js";
import type { CreateDepartmentDto } from "./dto/create-department.dto.js";
import type { QueryDepartmentDto } from "./dto/query-department.dto.js";
import type { UpdateDepartmentDto } from "./dto/update-department.dto.js";
import { DepartmentsRepository } from "./departments.repository.js";

@Injectable()
export class DepartmentsService {
  constructor(
    private readonly repository: DepartmentsRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  async findAll(query: QueryDepartmentDto) {
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

  async findOne(id: number) {
    const scope = this.tenantContext.getOrgScope();
    const department = await this.repository.findOne(scope, id);
    if (!department) {
      throw new ResourceNotFoundException("Department", id);
    }
    return department;
  }

  async create(dto: CreateDepartmentDto) {
    const scope = this.tenantContext.getOrgScope();
    const existing = await this.repository.findByName(scope, dto.name);
    if (existing) {
      throw new ResourceConflictException(
        `A department named "${dto.name}" already exists`,
      );
    }
    return this.repository.create(scope, dto, this.tenantContext.getUserId());
  }

  async update(id: number, dto: UpdateDepartmentDto) {
    const scope = this.tenantContext.getOrgScope();
    if (dto.name) {
      const existing = await this.repository.findByName(scope, dto.name);
      if (existing && existing.id !== id) {
        throw new ResourceConflictException(
          `A department named "${dto.name}" already exists`,
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
      throw new ResourceNotFoundException("Department", id);
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
      throw new ResourceNotFoundException("Department", id);
    }
  }
}
