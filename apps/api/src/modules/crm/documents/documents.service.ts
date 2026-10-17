import { Injectable } from "@nestjs/common";
import { PaginatedResponseDto } from "../../../common/dto/paginated-response.dto.js";
import { ResourceNotFoundException } from "../../../common/exceptions/business.exception.js";
import { TenantContextService } from "../../../platform/tenancy/tenant-context.service.js";
import { CrmDocumentsRepository } from "./documents.repository.js";
import type {
  CreateCrmDocumentDto,
  QueryCrmDocumentDto,
} from "./dto/document.dto.js";

@Injectable()
export class CrmDocumentsService {
  constructor(
    private readonly repository: CrmDocumentsRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  async findAll(query: QueryCrmDocumentDto) {
    const { items, total } = await this.repository.findMany(
      this.tenantContext.getOrgScope(),
      {
        relatedType: query.relatedType,
        relatedId: query.relatedId,
        rollupAccountId: query.rollupAccountId,
      },
      query,
    );
    return new PaginatedResponseDto(items, total, query.page, query.limit);
  }

  create(dto: CreateCrmDocumentDto) {
    return this.repository.create(
      this.tenantContext.getOrgScope(),
      dto,
      this.tenantContext.getUserId(),
    );
  }

  async remove(id: number) {
    const row = await this.repository.softDelete(
      this.tenantContext.getOrgScope(),
      id,
    );
    if (!row) throw new ResourceNotFoundException("CrmDocument", id);
    return row;
  }
}
