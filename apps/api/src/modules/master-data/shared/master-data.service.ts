import {
  ResourceConflictException,
  ResourceNotFoundException,
} from "../../../common/exceptions/business.exception.js";
import { PaginatedResponseDto } from "../../../common/dto/paginated-response.dto.js";
import type { PaginationDto } from "../../../common/dto/pagination.dto.js";
import type { TenantContextService } from "../../../platform/tenancy/tenant-context.service.js";
import type {
  MasterDataFilter,
  MasterDataRepository,
  MasterDataRow,
} from "./master-data.repository.js";

type MasterDataQuery = PaginationDto & MasterDataFilter;

/** Code-and-name reference data that is deactivated, never deleted. A concrete
 * service only names its entity; the rules below are identical for every
 * master-data module. */
export abstract class MasterDataService<
  Row extends MasterDataRow,
  CreateDto extends { code: string; name: string },
  UpdateDto extends { name?: string | undefined },
  Query extends MasterDataQuery,
> {
  /** @param noun Lower-case singular used in messages, e.g. "work location". */
  constructor(
    protected readonly repository: MasterDataRepository<
      Row,
      CreateDto,
      UpdateDto
    >,
    protected readonly tenantContext: TenantContextService,
    private readonly noun: string,
  ) {}

  async findAll(query: Query) {
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
      throw this.notFound(id);
    }
    return row;
  }

  async create(dto: CreateDto) {
    const scope = this.tenantContext.getOrgScope();
    if (await this.repository.findByCode(scope, dto.code)) {
      throw new ResourceConflictException(
        `A ${this.noun} with code "${dto.code}" already exists`,
      );
    }
    if (await this.repository.findByName(scope, dto.name)) {
      throw new ResourceConflictException(
        `A ${this.noun} named "${dto.name}" already exists`,
      );
    }
    return this.repository.create(scope, dto, this.tenantContext.getUserId());
  }

  async update(id: number, dto: UpdateDto) {
    const scope = this.tenantContext.getOrgScope();
    if (dto.name !== undefined) {
      const clash = await this.repository.findByName(scope, dto.name);
      if (clash && clash.id !== id) {
        throw new ResourceConflictException(
          `A ${this.noun} named "${dto.name}" already exists`,
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
      throw this.notFound(id);
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
      throw this.notFound(id);
    }
    return updated;
  }

  private notFound(id: number) {
    return new ResourceNotFoundException(
      this.noun.charAt(0).toUpperCase() + this.noun.slice(1),
      id,
    );
  }
}
