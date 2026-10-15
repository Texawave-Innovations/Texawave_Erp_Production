import { Controller, Get } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { RequirePermission } from "../../../common/decorators/require-permission.decorator.js";
import { SalesDashboardService } from "./dashboard.service.js";

@ApiTags("sales-dashboard")
@Controller("sales/dashboard")
export class SalesDashboardController {
  constructor(private readonly dashboard: SalesDashboardService) {}

  @Get()
  @RequirePermission("sales.dashboard.read")
  @ApiOperation({
    summary:
      "Sales dashboard: KPIs, pipeline, trends, receivables, attention items",
  })
  get() {
    return this.dashboard.get();
  }
}
