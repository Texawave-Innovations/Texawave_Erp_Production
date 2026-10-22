import { Module } from "@nestjs/common";
import {
  WarehouseLocationsController,
  WarehousesController,
} from "./warehouses.controller.js";
import { WarehousesRepository } from "./warehouses.repository.js";
import { WarehousesService } from "./warehouses.service.js";

@Module({
  controllers: [WarehousesController, WarehouseLocationsController],
  providers: [WarehousesRepository, WarehousesService],
  exports: [WarehousesService],
})
export class WarehousesModule {}
