import { Module } from "@nestjs/common";
import { ScmMasterListItemsModule } from "../master-list-items/master-list-items.module.js";
import {
  WarehouseLocationsController,
  WarehousesController,
} from "./warehouses.controller.js";
import { WarehousesRepository } from "./warehouses.repository.js";
import { WarehousesService } from "./warehouses.service.js";

@Module({
  imports: [ScmMasterListItemsModule],
  controllers: [WarehousesController, WarehouseLocationsController],
  providers: [WarehousesRepository, WarehousesService],
  exports: [WarehousesService],
})
export class WarehousesModule {}
