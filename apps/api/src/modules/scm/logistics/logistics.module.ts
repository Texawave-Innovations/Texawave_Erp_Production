import { Module } from "@nestjs/common";
import { CarriersRepository } from "./carriers.repository.js";
import {
  CarriersController,
  ShipmentsController,
} from "./logistics.controller.js";
import { LogisticsService } from "./logistics.service.js";
import { ShipmentsRepository } from "./shipments.repository.js";

@Module({
  controllers: [CarriersController, ShipmentsController],
  providers: [CarriersRepository, ShipmentsRepository, LogisticsService],
  exports: [LogisticsService],
})
export class LogisticsModule {}
