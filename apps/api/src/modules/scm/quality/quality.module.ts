import { Module } from "@nestjs/common";
import { FulfillmentModule } from "../fulfillment/fulfillment.module.js";
import { InventoryModule } from "../inventory/inventory.module.js";
import { InspectionsRepository } from "./inspections.repository.js";
import {
  QualityController,
  QualityDefectsController,
  QualityInspectionsController,
  QualityQuarantineController,
  QualityTemplatesController,
} from "./quality.controller.js";
import { QualityService } from "./quality.service.js";
import { QualityMastersRepository } from "./quality-masters.repository.js";
import { QuarantineRepository } from "./quarantine.repository.js";

@Module({
  imports: [InventoryModule, FulfillmentModule],
  controllers: [
    QualityController,
    QualityDefectsController,
    QualityTemplatesController,
    QualityInspectionsController,
    QualityQuarantineController,
  ],
  providers: [
    QualityMastersRepository,
    InspectionsRepository,
    QuarantineRepository,
    QualityService,
  ],
  // Returns raise quarantine records through the same repository.
  exports: [QuarantineRepository],
})
export class QualityModule {}
