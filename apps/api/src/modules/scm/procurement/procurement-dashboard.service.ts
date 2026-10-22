import { Injectable } from "@nestjs/common";
import { TenantContextService } from "../../../platform/tenancy/tenant-context.service.js";
import { ProcurementDashboardRepository } from "./procurement-dashboard.repository.js";

@Injectable()
export class ProcurementDashboardService {
  constructor(
    private readonly repository: ProcurementDashboardRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  summary() {
    return this.repository.summary(this.tenantContext.getOrgScope());
  }
}
