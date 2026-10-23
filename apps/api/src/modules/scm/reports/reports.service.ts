import { Injectable } from "@nestjs/common";
import { TenantContextService } from "../../../platform/tenancy/tenant-context.service.js";
import type { ReportQueryDto } from "./dto/reports.dto.js";
import { ReportsRepository } from "./reports.repository.js";

@Injectable()
export class ReportsService {
  constructor(
    private readonly repo: ReportsRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  private get scope() {
    return this.tenantContext.getOrgScope();
  }

  overview() {
    return this.repo.overview(this.scope);
  }
  procurement(query: ReportQueryDto) {
    return this.repo.procurement(this.scope, query);
  }
  inventory(query: ReportQueryDto) {
    return this.repo.inventory(this.scope, query);
  }
  warehouse() {
    return this.repo.warehouse(this.scope);
  }
  fulfillment(query: ReportQueryDto) {
    return this.repo.fulfillment(this.scope, query);
  }
  logistics(query: ReportQueryDto) {
    return this.repo.logistics(this.scope, query);
  }
  returns(query: ReportQueryDto) {
    return this.repo.returns(this.scope, query);
  }
  quality(query: ReportQueryDto) {
    return this.repo.quality(this.scope, query);
  }
  suppliers() {
    return this.repo.suppliers(this.scope);
  }
}
