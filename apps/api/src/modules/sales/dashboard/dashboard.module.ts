import { Module } from "@nestjs/common";
import { ActionItemsModule } from "../action-items/action-items.module.js";
import { CustomersModule } from "../customers/customers.module.js";
import { SalesDocumentsModule } from "../documents/documents.module.js";
import { SalesDashboardController } from "./dashboard.controller.js";
import { SalesDashboardService } from "./dashboard.service.js";

@Module({
  imports: [CustomersModule, ActionItemsModule, SalesDocumentsModule],
  controllers: [SalesDashboardController],
  providers: [SalesDashboardService],
})
export class SalesDashboardModule {}
