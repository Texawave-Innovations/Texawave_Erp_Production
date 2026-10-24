import { Module } from "@nestjs/common";
import { ScmMasterListItemsModule } from "../master-list-items/master-list-items.module.js";
import { CarriersRepository } from "./carriers.repository.js";
import {
  CarriersController,
  ShipmentsController,
} from "./logistics.controller.js";
import { LogisticsService } from "./logistics.service.js";
import { ShipmentsRepository } from "./shipments.repository.js";

@Module({
  imports: [ScmMasterListItemsModule],
  controllers: [CarriersController, ShipmentsController],
  providers: [CarriersRepository, ShipmentsRepository, LogisticsService],
  exports: [LogisticsService],
})
export class LogisticsModule {}
