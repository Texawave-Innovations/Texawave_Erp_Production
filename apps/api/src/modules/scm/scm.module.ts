import { Module } from "@nestjs/common";
import { ScmCommonModule } from "./common/scm-common.module.js";
import { InventoryModule } from "./inventory/inventory.module.js";
import { FulfillmentModule } from "./fulfillment/fulfillment.module.js";
import { LogisticsModule } from "./logistics/logistics.module.js";
import { QualityModule } from "./quality/quality.module.js";
import { WarehouseOpsModule } from "./warehouse-ops/warehouse-ops.module.js";
import { ReportsModule } from "./reports/reports.module.js";
import { OverviewModule } from "./overview/overview.module.js";
import { ReturnsModule } from "./returns/returns.module.js";
import { ProcurementModule } from "./procurement/procurement.module.js";
import { SalesModule } from "./sales/sales.module.js";
import { ScmProductsModule } from "./products/products.module.js";
import { FinanceModule } from "./finance/finance.module.js";
import { SuppliersModule } from "./suppliers/suppliers.module.js";
import { WarehousesModule } from "./warehouses/warehouses.module.js";

/** Aggregates the SCM sub-modules; grows one migrated slice at a time
 * (Docs/SCM_LEGACY_PARITY.md section 11). */
@Module({
  imports: [
    ScmCommonModule,
    SuppliersModule,
    FinanceModule,
    ScmProductsModule,
    WarehousesModule,
    InventoryModule,
    ProcurementModule,
    SalesModule,
    FulfillmentModule,
    LogisticsModule,
    QualityModule,
    WarehouseOpsModule,
    ReportsModule,
    OverviewModule,
    ReturnsModule,
  ],
})
export class ScmModule {}
