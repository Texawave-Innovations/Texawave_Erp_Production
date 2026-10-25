import { Injectable } from "@nestjs/common";
import { TenantContextService } from "../../../platform/tenancy/tenant-context.service.js";
import type { UpdateProposalSettingsDto } from "./dto/settings.dto.js";
import { ProposalsRepository } from "./proposals.repository.js";

@Injectable()
export class ProposalSettingsService {
  constructor(
    private readonly repository: ProposalsRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  get() {
    const scope = this.tenantContext.getOrgScope();
    return this.repository.getSettings(scope);
  }

  update(dto: UpdateProposalSettingsDto) {
    const scope = this.tenantContext.getOrgScope();
    return this.repository.updateSettings(scope, dto);
  }
}
