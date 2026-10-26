import { Injectable } from "@nestjs/common";
import { PaginatedResponseDto } from "../../common/dto/paginated-response.dto.js";
import type { PaginationDto } from "../../common/dto/pagination.dto.js";
import {
  ResourceConflictException,
  ResourceNotFoundException,
} from "../../common/exceptions/business.exception.js";
import { TenantContextService } from "../../platform/tenancy/tenant-context.service.js";
import type { CreateProjectsMasterDto } from "./dto/create-projects-master.dto.js";
import type { QueryProjectsMasterDto } from "./dto/query-projects-master.dto.js";
import type { UpdateProjectsMasterDto } from "./dto/update-projects-master.dto.js";
import { ProjectsMasterRepository } from "./projects-master.repository.js";

@Injectable()
export class ProjectsMasterService {
  constructor(
    private readonly repository: ProjectsMasterRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  async findAll(query: QueryProjectsMasterDto) {
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
    const project = await this.repository.findOne(scope, id);
    if (!project) {
      throw new ResourceNotFoundException("Project", id);
    }
    return project;
  }

  /** The project code (e.g. "ME", "SW", "EC") is user-supplied here — it's
   * the category code the Project Code Master format slots in, not an
   * auto-sequenced identifier. */
  async create(dto: CreateProjectsMasterDto) {
    const scope = this.tenantContext.getOrgScope();
    const createdBy = this.tenantContext.getUserId();

    const existing = await this.repository.findByCode(scope, dto.code);
    if (existing) {
      throw new ResourceConflictException(
        `Project code "${dto.code}" already exists`,
      );
    }

    return this.repository.create(scope, dto, createdBy);
  }

  async update(id: number, dto: UpdateProjectsMasterDto) {
    const scope = this.tenantContext.getOrgScope();

    if (dto.code) {
      const existing = await this.repository.findByCode(scope, dto.code);
      if (existing && existing.id !== id) {
        throw new ResourceConflictException(
          `Project code "${dto.code}" already exists`,
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
      throw new ResourceNotFoundException("Project", id);
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
      throw new ResourceNotFoundException("Project", id);
    }
  }
}
