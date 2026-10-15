import { Injectable } from "@nestjs/common";
import { parseDateOnly } from "../../../common/dates/date-only.js";
import { ActionItemsService } from "../action-items/action-items.service.js";
import { CustomersService } from "../customers/customers.service.js";
import { DocumentFiguresService } from "../documents/document-figures.service.js";
import {
  buildSalesDashboard,
  type DashboardSource,
  NO_DOCUMENT_FIGURES,
} from "./dashboard.rules.js";

/** Sources feeding real data today. Credit notes and returnable DCs are not
 * built yet (their figures stay zero). */
const LIVE_SOURCES: readonly DashboardSource[] = [
  "customers",
  "action_items",
  "quotations",
  "invoices",
  "payments",
];

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
    private readonly documents: DocumentFiguresService,
  ) {}

  async get() {
    const today = parseDateOnly(new Date().toISOString().slice(0, 10));
    const [customers, checklist, figures] = await Promise.all([
      this.customers.countByStatus(),
      this.actionItems.countOpen(today),
      this.documents.figures(today),
    ]);
    return buildSalesDashboard({
      year: today.getUTCFullYear(),
      customers: { active: customers.ACTIVE, inactive: customers.INACTIVE },
      checklist,
      documents: {
        ...NO_DOCUMENT_FIGURES,
        ...figures,
      },
      live: LIVE_SOURCES,
    });
  }
}
