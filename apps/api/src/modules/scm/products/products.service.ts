import { Injectable } from "@nestjs/common";
import { classifyDbError } from "../../../common/database/db-errors.js";
import { PaginatedResponseDto } from "../../../common/dto/paginated-response.dto.js";
import {
  ResourceConflictException,
  ResourceNotFoundException,
} from "../../../common/exceptions/business.exception.js";
import { TenantContextService } from "../../../platform/tenancy/tenant-context.service.js";
import type {
  CreateScmProductDto,
  QueryScmProductDto,
  UpdateScmProductDto,
} from "./dto/product.dto.js";
import { ScmProductsRepository } from "./products.repository.js";

@Injectable()
export class ScmProductsService {
  constructor(
    private readonly repository: ScmProductsRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  async findAll(query: QueryScmProductDto) {
    const { items, total } = await this.repository.findMany(
      this.tenantContext.getOrgScope(),
      { q: query.q, isActive: query.isActive },
      query,
    );
    return new PaginatedResponseDto(items, total, query.page, query.limit);
  }

  findOptions() {
    return this.repository.findOptions(this.tenantContext.getOrgScope());
  }

  async findOne(id: number) {
    const row = await this.repository.findOne(
      this.tenantContext.getOrgScope(),
      id,
    );
    if (!row) throw new ResourceNotFoundException("Product", id);
    return row;
  }

  async create(dto: CreateScmProductDto) {
    const scope = this.tenantContext.getOrgScope();
    await this.assertCodeFree(dto.productCode);
    try {
      return await this.repository.create(
        scope,
        dto,
        this.tenantContext.getUserId(),
      );
    } catch (error) {
      throw this.mapUnique(error, dto.productCode);
    }
  }

  async update(id: number, dto: UpdateScmProductDto) {
    const scope = this.tenantContext.getOrgScope();
    const current = await this.findOne(id);
    if (
      dto.productCode &&
      dto.productCode.toLowerCase() !== current.productCode.toLowerCase()
    ) {
      await this.assertCodeFree(dto.productCode, id);
    }
    try {
      const row = await this.repository.update(
        scope,
        id,
        dto,
        this.tenantContext.getUserId(),
      );
      if (!row) throw new ResourceNotFoundException("Product", id);
      return row;
    } catch (error) {
      throw this.mapUnique(error, dto.productCode);
    }
  }

  async remove(id: number) {
    const row = await this.repository.softDelete(
      this.tenantContext.getOrgScope(),
      id,
      this.tenantContext.getUserId(),
    );
    if (!row) throw new ResourceNotFoundException("Product", id);
  }

  private async assertCodeFree(code: string, exceptId?: number) {
    const clash = await this.repository.findByCode(
      this.tenantContext.getOrgScope(),
      code,
    );
    if (clash && clash.id !== exceptId) {
      throw new ResourceConflictException(
        `Product code "${code}" is already used by ${clash.name}`,
      );
    }
  }

  private mapUnique(error: unknown, code: string | undefined) {
    return classifyDbError(error)?.kind === "unique"
      ? new ResourceConflictException(
          `Product code "${code ?? ""}" is already in use.`,
        )
      : error;
  }
}
