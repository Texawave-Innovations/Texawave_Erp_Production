import { Injectable } from "@nestjs/common";
import { PaginatedResponseDto } from "../../common/dto/paginated-response.dto.js";
import { ResourceNotFoundException } from "../../common/exceptions/business.exception.js";
import { TenantContextService } from "../../platform/tenancy/tenant-context.service.js";
import type { CreateSalespersonDto } from "./dto/create-salesperson.dto.js";
import type { QuerySalespersonDto } from "./dto/query-salesperson.dto.js";
import type { UpdateSalespersonDto } from "./dto/update-salesperson.dto.js";
import { SalespersonsRepository } from "./salespersons.repository.js";

@Injectable()
export class SalespersonsService {
  constructor(
    private readonly repository: SalespersonsRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  async findAll(query: QuerySalespersonDto) {
    const scope = this.tenantContext.getOrgScope();
    const { items, total } = await this.repository.findMany(
      scope,
      { search: query.search },
      query,
    );
    return new PaginatedResponseDto(items, total, query.page, query.limit);
  }

  async findOne(id: number) {
    const scope = this.tenantContext.getOrgScope();
    const salesperson = await this.repository.findOne(scope, id);
    if (!salesperson) {
      throw new ResourceNotFoundException("Salesperson", id);
    }
    return salesperson;
  }

  create(dto: CreateSalespersonDto) {
    const scope = this.tenantContext.getOrgScope();
    return this.repository.create(scope, dto);
  }

  async update(id: number, dto: UpdateSalespersonDto) {
    const scope = this.tenantContext.getOrgScope();
    const updated = await this.repository.update(scope, id, dto);
    if (!updated) {
      throw new ResourceNotFoundException("Salesperson", id);
    }
    return updated;
  }

  async remove(id: number): Promise<void> {
    const scope = this.tenantContext.getOrgScope();
    const deleted = await this.repository.softDelete(scope, id);
    if (!deleted) {
      throw new ResourceNotFoundException("Salesperson", id);
    }
  }
}
