import { Injectable } from "@nestjs/common";
import { PaginatedResponseDto } from "../../../common/dto/paginated-response.dto.js";
import {
  BusinessRuleViolationException,
  ResourceNotFoundException,
} from "../../../common/exceptions/business.exception.js";
import { TenantContextService } from "../../../platform/tenancy/tenant-context.service.js";
import { CrmColdCallingRepository } from "./cold-calling.repository.js";
import type {
  CreateCrmColdCallingEntryDto,
  LinkCrmColdCallingEntryDto,
  QueryCrmColdCallingEntryDto,
  RecordCrmColdCallingDispositionDto,
  UpdateCrmColdCallingEntryDto,
} from "./dto/cold-calling.dto.js";

@Injectable()
export class CrmColdCallingService {
  constructor(
    private readonly repository: CrmColdCallingRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  async findAll(query: QueryCrmColdCallingEntryDto) {
    const { items, total } = await this.repository.findMany(
      this.tenantContext.getOrgScope(),
      {
        search: query.search,
        linkedAccountId: query.linkedAccountId,
        status: query.status,
        dateFrom: query.dateFrom,
        dateTo: query.dateTo,
      },
      query,
    );
    return new PaginatedResponseDto(items, total, query.page, query.limit);
  }

  distinctStatuses() {
    return this.repository.distinctStatuses(this.tenantContext.getOrgScope());
  }

  async findOne(id: number) {
    const row = await this.repository.findOne(
      this.tenantContext.getOrgScope(),
      id,
    );
    if (!row) throw new ResourceNotFoundException("CrmColdCallingEntry", id);
    return row;
  }

  create(dto: CreateCrmColdCallingEntryDto) {
    return this.repository.create(
      this.tenantContext.getOrgScope(),
      dto,
      this.tenantContext.getUserId(),
    );
  }

  async update(id: number, dto: UpdateCrmColdCallingEntryDto) {
    const row = await this.repository.update(
      this.tenantContext.getOrgScope(),
      id,
      dto,
      this.tenantContext.getUserId(),
    );
    if (!row) throw new ResourceNotFoundException("CrmColdCallingEntry", id);
    return row;
  }

  async linkAccount(id: number, dto: LinkCrmColdCallingEntryDto) {
    const row = await this.repository.linkAccount(
      this.tenantContext.getOrgScope(),
      id,
      dto.accountId,
      this.tenantContext.getUserId(),
    );
    if (row === null)
      throw new ResourceNotFoundException("CrmColdCallingEntry", id);
    if (row === undefined) {
      throw new BusinessRuleViolationException(
        `Account ${dto.accountId} does not exist in this organization`,
        "INVALID_ACCOUNT",
      );
    }
    return row;
  }

  async recordDisposition(id: number, dto: RecordCrmColdCallingDispositionDto) {
    const row = await this.repository.recordDisposition(
      this.tenantContext.getOrgScope(),
      id,
      dto.dispositionTag,
      this.tenantContext.getUserId(),
    );
    if (!row) throw new ResourceNotFoundException("CrmColdCallingEntry", id);
    return row;
  }

  async remove(id: number) {
    const row = await this.repository.softDelete(
      this.tenantContext.getOrgScope(),
      id,
      this.tenantContext.getUserId(),
    );
    if (!row) throw new ResourceNotFoundException("CrmColdCallingEntry", id);
    return row;
  }
}
