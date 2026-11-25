import { Injectable } from "@nestjs/common";
import { ResourceNotFoundException } from "../../../common/exceptions/business.exception.js";
import { TenantContextService } from "../../../platform/tenancy/tenant-context.service.js";
import { AssistantRepository } from "./assistant.repository.js";
import { buildReply, detectIntent } from "./assistant.intents.js";
import { OverviewRepository } from "./overview.repository.js";
import { ScanRepository } from "./scan.repository.js";
import { businessToday } from "../../../common/dates/business-date.js";
import { bucketMovements, istDayStart, trendDates } from "./movement-trend.js";

@Injectable()
export class OverviewService {
  constructor(
    private readonly repo: OverviewRepository,
    private readonly assistant: AssistantRepository,
    private readonly scanner: ScanRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  private get scope() {
    return this.tenantContext.getOrgScope();
  }

  overview() {
    return this.repo.overview(this.scope);
  }
  /** Inbound vs outbound stock quantity per IST day, oldest first. */
  async movementTrend(days: number) {
    const dates = trendDates(businessToday(), days);
    const rows = await this.repo.movementsSince(
      this.scope,
      istDayStart(dates[0] as string),
    );
    return bucketMovements(rows, dates);
  }
  search(q: string) {
    return this.repo.search(this.scope, q);
  }
  async resolveCode(code: string) {
    const hit = await this.repo.resolveCode(this.scope, code);
    if (!hit) throw new ResourceNotFoundException("Code", code);
    return hit;
  }
  /** Full scan result (fields, view link, actions, alternatives). */
  scan(code: string) {
    return this.scanner.scan(this.scope, code);
  }
  /** Products with barcode, bin and expiry for the Barcode Utilities table. */
  barcodeProducts(q: string | undefined) {
    return this.scanner.productUtilities(this.scope, q);
  }
  controlTower() {
    return this.repo.controlTowerExceptions(this.scope);
  }
  replenishment() {
    return this.repo.replenishment(this.scope);
  }
  /** Deterministic Copilot: classify the question, read that area's live
   * figures, build the answer with deep links (assistant.intents.ts). */
  async ask(question: string) {
    const intent = detectIntent(question);
    const facts = await this.assistant.gather(this.scope, intent);
    return buildReply(intent, facts);
  }
}
