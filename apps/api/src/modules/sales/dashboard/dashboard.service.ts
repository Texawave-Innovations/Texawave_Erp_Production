import { Injectable } from "@nestjs/common";
import { parseDateOnly } from "../../../common/dates/date-only.js";
import { ActionItemsService } from "../action-items/action-items.service.js";
import { CustomersService } from "../customers/customers.service.js";
import {
  buildSalesDashboard,
  type DashboardSource,
  NO_DOCUMENT_FIGURES,
} from "./dashboard.rules.js";

/** Sources feeding real data today. Each document module adds itself here
 * (and its figures below) when it is built. */
const LIVE_SOURCES: readonly DashboardSource[] = ["customers", "action_items"];

/**
 * `GET /sales/dashboard`. Reads each source through that module's exported
 * service (Docs/CODING_STANDARDS.md §11) — never another module's repository —
 * and hands the figures to the pure builder.
 */
@Injectable()
export class SalesDashboardService {
  constructor(
    private readonly customers: CustomersService,
    private readonly actionItems: ActionItemsService,
  ) {}

  async get() {
    const today = parseDateOnly(new Date().toISOString().slice(0, 10));
    const [customers, checklist] = await Promise.all([
      this.customers.countByStatus(),
      this.actionItems.countOpen(today),
    ]);
    return buildSalesDashboard({
      year: today.getUTCFullYear(),
      customers: { active: customers.ACTIVE, inactive: customers.INACTIVE },
      checklist,
      documents: NO_DOCUMENT_FIGURES,
      live: LIVE_SOURCES,
    });
  }
}
