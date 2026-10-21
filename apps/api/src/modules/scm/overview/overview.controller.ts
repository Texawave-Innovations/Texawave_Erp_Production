import { Body, Controller, Get, Post, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { RequirePermission } from "../../../common/decorators/require-permission.decorator.js";
import { AskDto, ResolveCodeDto, SearchDto } from "./dto/overview.dto.js";
import { OverviewService } from "./overview.service.js";

/** Legacy `ScmOverview` / `ScmMasterData` / `ScmBarcodeDashboard` /
 * `ScmControlTower` / `ScmReplenishment` / the SCM AI copilot. All six are
 * thin, read-only cross-cutting views over data every other SCM module
 * already owns. */
@ApiTags("scm-overview")
@Controller("scm/overview")
export class OverviewController {
  constructor(private readonly svc: OverviewService) {}

  @Get()
  @RequirePermission("scm.overview.read")
  overview() {
    return this.svc.overview();
  }
}

@ApiTags("scm-overview")
@Controller("scm/master-data")
export class MasterDataController {
  constructor(private readonly svc: OverviewService) {}

  @Get("search")
  @RequirePermission("scm.overview.read")
  search(@Query() query: SearchDto) {
    return this.svc.search(query.q);
  }
}

@ApiTags("scm-overview")
@Controller("scm/barcode")
export class BarcodeController {
  constructor(private readonly svc: OverviewService) {}

  @Post("resolve")
  @RequirePermission("scm.overview.read")
  resolve(@Body() dto: ResolveCodeDto) {
    return this.svc.resolveCode(dto.code);
  }

  /** Resolves a scanned/typed code (or one of this app's QR payloads) into a
   * full result card: key facts, a view link, follow-up actions, and every
   * alternative when the same code matches more than one record. */
  @Post("scan")
  @RequirePermission("scm.overview.read")
  scan(@Body() dto: ResolveCodeDto) {
    return this.svc.scan(dto.code);
  }

  @Get("products")
  @RequirePermission("scm.overview.read")
  products(@Query("q") q?: string) {
    return this.svc.barcodeProducts(q?.trim() || undefined);
  }
}

@ApiTags("scm-overview")
@Controller("scm/advanced")
export class AdvancedController {
  constructor(private readonly svc: OverviewService) {}

  @Get("control-tower")
  @RequirePermission("scm.overview.read")
  controlTower() {
    return this.svc.controlTower();
  }

  @Get("replenishment")
  @RequirePermission("scm.overview.read")
  replenishment() {
    return this.svc.replenishment();
  }
}

@ApiTags("scm-overview")
@Controller("scm/assistant")
export class AssistantController {
  constructor(private readonly svc: OverviewService) {}

  @Post("ask")
  @RequirePermission("scm.overview.read")
  ask(@Body() dto: AskDto) {
    return this.svc.ask(dto.question);
  }
}
