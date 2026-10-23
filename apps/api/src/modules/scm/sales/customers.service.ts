import { Injectable } from "@nestjs/common";
import { classifyDbError } from "../../../common/database/db-errors.js";
import { PaginatedResponseDto } from "../../../common/dto/paginated-response.dto.js";
import {
  ResourceConflictException,
  ResourceNotFoundException,
} from "../../../common/exceptions/business.exception.js";
import { TenantContextService } from "../../../platform/tenancy/tenant-context.service.js";
import { CustomersRepository } from "./customers.repository.js";
import type {
  CreateCustomerDto,
  QueryCustomerDto,
  UpdateCustomerDto,
} from "./dto/sales.dto.js";

@Injectable()
export class CustomersService {
  constructor(
    private readonly repository: CustomersRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  private get scope() {
    return this.tenantContext.getOrgScope();
  }

  async findAll(query: QueryCustomerDto) {
    const { items, total } = await this.repository.findMany(
      this.scope,
      query,
      query,
    );
    return new PaginatedResponseDto(items, total, query.page, query.limit);
  }

  findOptions() {
    return this.repository.findOptions(this.scope);
  }

  async findOne(id: number) {
    const row = await this.repository.findOne(this.scope, id);
    if (!row) throw new ResourceNotFoundException("Customer", id);
    return row;
  }

  async create(dto: CreateCustomerDto) {
    const actor = this.tenantContext.getUserId();
    if (dto.customerCode) {
      const clash = await this.repository.findByCode(
        this.scope,
        dto.customerCode,
      );
      if (clash) {
        throw new ResourceConflictException(
          `Customer code "${dto.customerCode}" is already used by ${clash.name}`,
        );
      }
      return this.repository.create(this.scope, dto.customerCode, dto, actor);
    }
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const code = await this.repository.nextCode(this.scope);
      try {
        return await this.repository.create(this.scope, code, dto, actor);
      } catch (error) {
        if (classifyDbError(error)?.kind !== "unique") throw error;
      }
    }
    throw new ResourceConflictException(
      "Could not allocate a unique customer code.",
    );
  }

  async update(id: number, dto: UpdateCustomerDto) {
    const current = await this.findOne(id);
    if (
      dto.customerCode &&
      dto.customerCode.toLowerCase() !== current.customerCode.toLowerCase()
    ) {
      const clash = await this.repository.findByCode(
        this.scope,
        dto.customerCode,
      );
      if (clash && clash.id !== id) {
        throw new ResourceConflictException(
          `Customer code "${dto.customerCode}" is already used by ${clash.name}`,
        );
      }
    }
    const row = await this.repository.update(
      this.scope,
      id,
      dto,
      this.tenantContext.getUserId(),
    );
    if (!row) throw new ResourceNotFoundException("Customer", id);
    return row;
  }
}
