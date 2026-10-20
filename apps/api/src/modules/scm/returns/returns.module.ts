import { Module } from "@nestjs/common";
import { InventoryModule } from "../inventory/inventory.module.js";
import { QualityModule } from "../quality/quality.module.js";
import { ReturnsController } from "./returns.controller.js";
import { ReturnsRepository } from "./returns.repository.js";
import { ReturnsService } from "./returns.service.js";

@Module({
  imports: [InventoryModule, QualityModule],
  controllers: [ReturnsController],
  providers: [ReturnsRepository, ReturnsService],
})
export class ReturnsModule {}
