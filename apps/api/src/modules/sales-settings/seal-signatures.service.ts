import { Injectable } from "@nestjs/common";
import { PaginatedResponseDto } from "../../common/dto/paginated-response.dto.js";
import { ResourceNotFoundException } from "../../common/exceptions/business.exception.js";
import { TenantContextService } from "../../platform/tenancy/tenant-context.service.js";
import type { CreateSealSignatureDto } from "./dto/create-seal-signature.dto.js";
import type { QueryPaginationDto } from "./dto/query-pagination.dto.js";
import type { UpdateSealSignatureDto } from "./dto/update-seal-signature.dto.js";
import type { SealSignatureKind } from "./sales-settings.constants.js";
import { SealSignaturesRepository } from "./seal-signatures.repository.js";

/** One service instance per `kind` (see `company-seals.module.ts` /
 * `authorized-signatures.module.ts`) — the controller never passes `kind` on
 * the wire, it is fixed per route. */
@Injectable()
export class SealSignaturesService {
  constructor(
    private readonly repository: SealSignaturesRepository,
    private readonly tenantContext: TenantContextService,
    private readonly kind: SealSignatureKind,
    private readonly noun: string,
  ) {}

  async findAll(query: QueryPaginationDto) {
    const scope = this.tenantContext.getOrgScope();
    const { items, total } = await this.repository.findMany(
      scope,
      this.kind,
      query,
    );
    return new PaginatedResponseDto(items, total, query.page, query.limit);
  }

  async findOne(id: number) {
    const scope = this.tenantContext.getOrgScope();
    const row = await this.repository.findOne(scope, this.kind, id);
    if (!row) {
      throw new ResourceNotFoundException(this.noun, id);
    }
    return row;
  }

  create(dto: CreateSealSignatureDto) {
    const scope = this.tenantContext.getOrgScope();
    return this.repository.create(
      scope,
      this.kind,
      dto,
      this.tenantContext.getUserId(),
    );
  }

  async update(id: number, dto: UpdateSealSignatureDto) {
    const scope = this.tenantContext.getOrgScope();
    const updated = await this.repository.update(
      scope,
      this.kind,
      id,
      dto,
      this.tenantContext.getUserId(),
    );
    if (!updated) {
      throw new ResourceNotFoundException(this.noun, id);
    }
    return updated;
  }

  async remove(id: number): Promise<void> {
    const scope = this.tenantContext.getOrgScope();
    const deleted = await this.repository.softDelete(
      scope,
      this.kind,
      id,
      this.tenantContext.getUserId(),
    );
    if (!deleted) {
      throw new ResourceNotFoundException(this.noun, id);
    }
  }
}
