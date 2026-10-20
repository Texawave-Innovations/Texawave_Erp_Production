import { Module } from "@nestjs/common";
import { InventoryModule } from "../inventory/inventory.module.js";
import { ScmProductsModule } from "../products/products.module.js";
import { SuppliersModule } from "../suppliers/suppliers.module.js";
import { WarehousesModule } from "../warehouses/warehouses.module.js";
import { GoodsReceiptsController } from "./goods-receipts.controller.js";
import { GoodsReceiptsRepository } from "./goods-receipts.repository.js";
import { GoodsReceiptsService } from "./goods-receipts.service.js";
import { ProcurementDashboardController } from "./procurement-dashboard.controller.js";
import { ProcurementDashboardRepository } from "./procurement-dashboard.repository.js";
import { ProcurementDashboardService } from "./procurement-dashboard.service.js";
import { PurchaseOrdersController } from "./purchase-orders.controller.js";
import { PurchaseOrdersRepository } from "./purchase-orders.repository.js";
import { PurchaseOrdersService } from "./purchase-orders.service.js";
import { PurchaseRequisitionsController } from "./purchase-requisitions.controller.js";
import { PurchaseRequisitionsRepository } from "./purchase-requisitions.repository.js";
import { PurchaseRequisitionsService } from "./purchase-requisitions.service.js";
import { RfqsController } from "./rfqs.controller.js";
import { RfqsRepository } from "./rfqs.repository.js";
import { RfqsService } from "./rfqs.service.js";
import {
  QuotationComparisonController,
  SupplierQuotationsController,
} from "./supplier-quotations.controller.js";
import { SupplierQuotationsRepository } from "./supplier-quotations.repository.js";
import { SupplierQuotationsService } from "./supplier-quotations.service.js";

@Module({
  imports: [
    InventoryModule,
    ScmProductsModule,
    SuppliersModule,
    WarehousesModule,
  ],
  controllers: [
    ProcurementDashboardController,
    PurchaseRequisitionsController,
    RfqsController,
    SupplierQuotationsController,
    QuotationComparisonController,
    PurchaseOrdersController,
    GoodsReceiptsController,
  ],
  providers: [
    ProcurementDashboardRepository,
    ProcurementDashboardService,
    PurchaseRequisitionsRepository,
    PurchaseRequisitionsService,
    RfqsRepository,
    RfqsService,
    SupplierQuotationsRepository,
    SupplierQuotationsService,
    PurchaseOrdersRepository,
    PurchaseOrdersService,
    GoodsReceiptsRepository,
    GoodsReceiptsService,
  ],
  exports: [PurchaseOrdersService, GoodsReceiptsService],
})
export class ProcurementModule {}
