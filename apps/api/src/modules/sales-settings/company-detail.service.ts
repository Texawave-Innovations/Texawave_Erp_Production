import { Injectable } from "@nestjs/common";
import { TenantContextService } from "../../platform/tenancy/tenant-context.service.js";
import { CompanyDetailRepository } from "./company-detail.repository.js";
import type { UpsertCompanyDetailDto } from "./dto/upsert-company-detail.dto.js";

@Injectable()
export class CompanyDetailService {
  constructor(
    private readonly repository: CompanyDetailRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  /** Returns `null` (not 404) when the org hasn't saved Company Details yet —
   * this is a settings form, not a listable resource. */
  findOne() {
    return this.repository.findOne(this.tenantContext.getOrgScope());
  }

  upsert(dto: UpsertCompanyDetailDto) {
    const scope = this.tenantContext.getOrgScope();
    return this.repository.upsert(scope, dto);
  }
}
