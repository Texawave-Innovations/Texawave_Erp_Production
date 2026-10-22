import { Controller, Get } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { RequirePermission } from "../../../common/decorators/require-permission.decorator.js";
import { ProcurementDashboardService } from "./procurement-dashboard.service.js";

/** Legacy `ScmProcurementDashboard`: pipeline KPIs. */
@ApiTags("scm-procurement-dashboard")
@Controller("scm/procurement/dashboard")
export class ProcurementDashboardController {
  constructor(private readonly dashboard: ProcurementDashboardService) {}

  @Get()
  @RequirePermission("scm.procurement.read")
  summary() {
    return this.dashboard.summary();
  }
}
