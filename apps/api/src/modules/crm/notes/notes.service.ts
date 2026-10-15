import { Injectable } from "@nestjs/common";
import { PaginatedResponseDto } from "../../../common/dto/paginated-response.dto.js";
import { ResourceNotFoundException } from "../../../common/exceptions/business.exception.js";
import { TenantContextService } from "../../../platform/tenancy/tenant-context.service.js";
import { CrmNotesRepository } from "./notes.repository.js";
import type { CreateCrmNoteDto, QueryCrmNoteDto } from "./dto/note.dto.js";

@Injectable()
export class CrmNotesService {
  constructor(
    private readonly repository: CrmNotesRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  async findByAccount(accountId: number, query: QueryCrmNoteDto) {
    const { items, total } = await this.repository.findByAccount(
      this.tenantContext.getOrgScope(),
      accountId,
      query,
    );
    return new PaginatedResponseDto(items, total, query.page, query.limit);
  }

  create(dto: CreateCrmNoteDto) {
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
    if (!row) throw new ResourceNotFoundException("CrmNote", id);
    return row;
  }
}
