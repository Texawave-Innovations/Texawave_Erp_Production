import { Injectable } from "@nestjs/common";
import { PaginatedResponseDto } from "../../../common/dto/paginated-response.dto.js";
import { ResourceNotFoundException } from "../../../common/exceptions/business.exception.js";
import { TenantContextService } from "../../../platform/tenancy/tenant-context.service.js";
import { AccountsRepository } from "./accounts.repository.js";
import type {
  CreateAccountDto,
  QueryAccountDto,
  UpdateAccountDto,
} from "./dto/account.dto.js";

@Injectable()
export class AccountsService {
  constructor(
    private readonly repository: AccountsRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  async findAll(query: QueryAccountDto) {
    const { items, total } = await this.repository.findMany(
      this.tenantContext.getOrgScope(),
      { search: query.search },
      query,
    );
    return new PaginatedResponseDto(items, total, query.page, query.limit);
  }

  async findOne(id: number) {
    const row = await this.repository.findOne(
      this.tenantContext.getOrgScope(),
      id,
    );
    if (!row) throw new ResourceNotFoundException("Account", id);
    return row;
  }

  create(dto: CreateAccountDto) {
    return this.repository.create(
      this.tenantContext.getOrgScope(),
      dto,
      this.tenantContext.getUserId(),
    );
  }

  async update(id: number, dto: UpdateAccountDto) {
    const row = await this.repository.update(
      this.tenantContext.getOrgScope(),
      id,
      dto,
      this.tenantContext.getUserId(),
    );
    if (!row) throw new ResourceNotFoundException("Account", id);
    return row;
  }
}
