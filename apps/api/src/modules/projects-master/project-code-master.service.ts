import { Injectable } from "@nestjs/common";
import { TenantContextService } from "../../platform/tenancy/tenant-context.service.js";
import type { UpdateProjectCodeMasterDto } from "./dto/update-project-code-master.dto.js";
import { ProjectCodeMasterRepository } from "./project-code-master.repository.js";

const DEFAULTS = {
  companyPrefix: "TXW",
  moduleIdentifier: "PRJ",
  defaultProjectCode: "",
  financialYear: "",
  sequenceDigits: 3,
};

@Injectable()
export class ProjectCodeMasterService {
  constructor(
    private readonly repository: ProjectCodeMasterRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  /** Synthesizes an unsaved default row — the tab always shows all fields,
   * even before the first save. */
  async findOne() {
    const scope = this.tenantContext.getOrgScope();
    const existing = await this.repository.findOne(scope);
    return existing ?? DEFAULTS;
  }

  upsert(dto: UpdateProjectCodeMasterDto) {
    const scope = this.tenantContext.getOrgScope();
    return this.repository.upsert(scope, dto, this.tenantContext.getUserId());
  }
}
