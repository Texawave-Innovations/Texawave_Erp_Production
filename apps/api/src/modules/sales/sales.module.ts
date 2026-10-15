import { Module } from "@nestjs/common";
import { ActionItemsModule } from "./action-items/action-items.module.js";
import { CustomersModule } from "./customers/customers.module.js";
import { SalesDashboardModule } from "./dashboard/dashboard.module.js";
import { SalesDocumentsModule } from "./documents/documents.module.js";
import { SalesMasterListModule } from "./master-list/master-list.module.js";

/** Sales (order-to-cash). Organization-scoped: access is decided by the
 * `sales.*` permissions, not by team (Docs/CODING_STANDARDS.md §10). */
@Module({
  imports: [
    SalesMasterListModule,
    CustomersModule,
    ActionItemsModule,
    SalesDocumentsModule,
    SalesDashboardModule,
  ],
})
export class SalesModule {}
