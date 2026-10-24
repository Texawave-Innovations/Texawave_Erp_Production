import { Module } from "@nestjs/common";
import { InventoryModule } from "../inventory/inventory.module.js";
import { ScmMasterListItemsModule } from "../master-list-items/master-list-items.module.js";
import {
  FulfillmentsController,
  PackingsController,
  PickingsController,
} from "./fulfillment.controller.js";
import { FulfillmentService } from "./fulfillment.service.js";
import { FulfillmentsRepository } from "./fulfillments.repository.js";
import { PackingsRepository } from "./packings.repository.js";
import { PickingsRepository } from "./pickings.repository.js";

@Module({
  imports: [InventoryModule, ScmMasterListItemsModule],
  controllers: [FulfillmentsController, PickingsController, PackingsController],
  providers: [
    FulfillmentsRepository,
    PickingsRepository,
    PackingsRepository,
    FulfillmentService,
  ],
  exports: [FulfillmentService, FulfillmentsRepository],
})
export class FulfillmentModule {}
