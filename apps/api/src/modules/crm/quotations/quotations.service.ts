import { Injectable } from "@nestjs/common";
import { PaginatedResponseDto } from "../../../common/dto/paginated-response.dto.js";
import { ResourceNotFoundException } from "../../../common/exceptions/business.exception.js";
import { TenantContextService } from "../../../platform/tenancy/tenant-context.service.js";
import {
  QuotationsRepository,
  type QuotationFilter,
} from "./quotations.repository.js";
import type {
  QueryQuotationDto,
  QuotationPayloadDto,
} from "./dto/quotation.dto.js";

@Injectable()
export class QuotationsService {
  constructor(
    private readonly repository: QuotationsRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  async findAll(query: QueryQuotationDto) {
    const { items, total } = await this.repository.findMany(
      this.tenantContext.getOrgScope(),
      this.filterOf(query),
      query,
    );
    return new PaginatedResponseDto(items, total, query.page, query.limit);
  }

  async findOne(id: number) {
    const row = await this.repository.findOne(
      this.tenantContext.getOrgScope(),
      id,
    );
    if (!row) throw new ResourceNotFoundException("Quotation", id);
    return row;
  }

  create(dto: QuotationPayloadDto) {
    return this.repository.create(
      this.tenantContext.getOrgScope(),
      dto,
      this.tenantContext.getUserId(),
    );
  }

  async replace(id: number, dto: QuotationPayloadDto) {
    const row = await this.repository.replace(
      this.tenantContext.getOrgScope(),
      id,
      dto,
      this.tenantContext.getUserId(),
    );
    if (!row) throw new ResourceNotFoundException("Quotation", id);
    return row;
  }

  async remove(id: number) {
    const row = await this.repository.softDelete(
      this.tenantContext.getOrgScope(),
      id,
      this.tenantContext.getUserId(),
    );
    if (!row) throw new ResourceNotFoundException("Quotation", id);
    return row;
  }

  private filterOf(query: QueryQuotationDto): QuotationFilter {
    return {
      q: query.q,
      status: query.status,
      accountId: query.accountId,
      opportunityId: query.opportunityId,
    };
  }
}
