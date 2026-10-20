import { Module } from "@nestjs/common";
import {
  MovementsController,
  PutawayController,
  WarehouseOpsController,
} from "./warehouse-ops.controller.js";
import { WarehouseOpsRepository } from "./warehouse-ops.repository.js";
import { WarehouseOpsService } from "./warehouse-ops.service.js";
import { LocationStockService } from "./location-stock.service.js";

@Module({
  controllers: [WarehouseOpsController, PutawayController, MovementsController],
  providers: [
    WarehouseOpsRepository,
    WarehouseOpsService,
    LocationStockService,
  ],
})
export class WarehouseOpsModule {}
