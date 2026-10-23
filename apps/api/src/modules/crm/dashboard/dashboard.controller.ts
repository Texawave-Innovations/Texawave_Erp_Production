import { Controller, Get } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { RequirePermission } from "../../../common/decorators/require-permission.decorator.js";
import { CrmDashboardService } from "./dashboard.service.js";

/** Read-only executive dashboard. The route permission only lets the caller
 * in; every section is then built only from the entities whose own read
 * permission (and own/team/all scope) the caller holds. Legacy had no
 * dashboard filters, so there are no query parameters. */
@ApiTags("crm-dashboard")
@Controller("crm/dashboard")
export class CrmDashboardController {
  constructor(private readonly dashboard: CrmDashboardService) {}

  @Get()
  @RequirePermission("crm.dashboard.read")
  get() {
    return this.dashboard.getDashboard();
  }
}
