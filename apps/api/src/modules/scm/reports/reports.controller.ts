import { Controller, Get, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { RequirePermission } from "../../../common/decorators/require-permission.decorator.js";
import { ReportQueryDto } from "./dto/reports.dto.js";
import { ReportsService } from "./reports.service.js";

/** Legacy `ScmReportsDashboard` + the nine per-domain report pages. Every
 * endpoint is a read-only, capped row list — reports never write anything
 * and never invent a data path that another domain already owns. */
@ApiTags("scm-reports")
@Controller("scm/reports")
export class ReportsController {
  constructor(private readonly svc: ReportsService) {}

  @Get()
  @RequirePermission("scm.reports.read")
  overview() {
    return this.svc.overview();
  }

  @Get("procurement")
  @RequirePermission("scm.reports.read")
  procurement(@Query() query: ReportQueryDto) {
    return this.svc.procurement(query);
  }

  @Get("inventory")
  @RequirePermission("scm.reports.read")
  inventory(@Query() query: ReportQueryDto) {
    return this.svc.inventory(query);
  }

  @Get("warehouse")
  @RequirePermission("scm.reports.read")
  warehouse() {
    return this.svc.warehouse();
  }

  @Get("fulfillment")
  @RequirePermission("scm.reports.read")
  fulfillment(@Query() query: ReportQueryDto) {
    return this.svc.fulfillment(query);
  }

  @Get("logistics")
  @RequirePermission("scm.reports.read")
  logistics(@Query() query: ReportQueryDto) {
    return this.svc.logistics(query);
  }

  @Get("returns")
  @RequirePermission("scm.reports.read")
  returns(@Query() query: ReportQueryDto) {
    return this.svc.returns(query);
  }

  @Get("quality")
  @RequirePermission("scm.reports.read")
  quality(@Query() query: ReportQueryDto) {
    return this.svc.quality(query);
  }

  @Get("suppliers")
  @RequirePermission("scm.reports.read")
  suppliers() {
    return this.svc.suppliers();
  }
}
