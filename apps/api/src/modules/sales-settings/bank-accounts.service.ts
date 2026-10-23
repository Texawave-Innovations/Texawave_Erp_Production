import { Injectable } from "@nestjs/common";
import { PaginatedResponseDto } from "../../common/dto/paginated-response.dto.js";
import { ResourceNotFoundException } from "../../common/exceptions/business.exception.js";
import { TenantContextService } from "../../platform/tenancy/tenant-context.service.js";
import { BankAccountsRepository } from "./bank-accounts.repository.js";
import type { CreateBankAccountDto } from "./dto/create-bank-account.dto.js";
import type { QueryBankAccountDto } from "./dto/query-bank-account.dto.js";
import type { UpdateBankAccountDto } from "./dto/update-bank-account.dto.js";

@Injectable()
export class BankAccountsService {
  constructor(
    private readonly repository: BankAccountsRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  async findAll(query: QueryBankAccountDto) {
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
    const account = await this.repository.findOne(scope, id);
    if (!account) {
      throw new ResourceNotFoundException("Bank account", id);
    }
    return account;
  }

  create(dto: CreateBankAccountDto) {
    const scope = this.tenantContext.getOrgScope();
    return this.repository.create(scope, dto, this.tenantContext.getUserId());
  }

  async update(id: number, dto: UpdateBankAccountDto) {
    const scope = this.tenantContext.getOrgScope();
    const updated = await this.repository.update(
      scope,
      id,
      dto,
      this.tenantContext.getUserId(),
    );
    if (!updated) {
      throw new ResourceNotFoundException("Bank account", id);
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
      throw new ResourceNotFoundException("Bank account", id);
    }
  }
}
