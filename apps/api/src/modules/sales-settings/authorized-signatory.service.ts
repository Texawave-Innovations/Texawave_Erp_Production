import { Injectable } from "@nestjs/common";
import { TenantContextService } from "../../platform/tenancy/tenant-context.service.js";
import { AuthorizedSignatoryRepository } from "./authorized-signatory.repository.js";
import type { UpsertAuthorizedSignatoryDto } from "./dto/upsert-authorized-signatory.dto.js";

@Injectable()
export class AuthorizedSignatoryService {
  constructor(
    private readonly repository: AuthorizedSignatoryRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  findOne() {
    return this.repository.findOne(this.tenantContext.getOrgScope());
  }

  upsert(dto: UpsertAuthorizedSignatoryDto) {
    const scope = this.tenantContext.getOrgScope();
    return this.repository.upsert(scope, dto, this.tenantContext.getUserId());
  }
}
