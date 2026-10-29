import { Module } from "@nestjs/common";
import { MasterListItemsController } from "./master-list-items.controller.js";
import { MasterListItemsRepository } from "./master-list-items.repository.js";
import { MasterListItemsService } from "./master-list-items.service.js";
import { MasterListValueGuard } from "./master-list-value.guard.js";

/** SCM Master foundation — one generic resource (master list items behind
 * the Supplier Types / Package Types / Warehouse Types / Stock Adjustment
 * Reasons cards). Mirrors apps/api/src/modules/finance-settings.
 * `MasterListValueGuard` is exported so the suppliers/warehouses/fulfillment/
 * inventory modules can validate their `type`/`reason`/`packageType` fields
 * against this masterlist instead of a static `@IsIn()` list. */
@Module({
  controllers: [MasterListItemsController],
  providers: [
    MasterListItemsRepository,
    MasterListItemsService,
    MasterListValueGuard,
  ],
  exports: [MasterListItemsRepository, MasterListValueGuard],
})
export class ScmMasterListItemsModule {}
