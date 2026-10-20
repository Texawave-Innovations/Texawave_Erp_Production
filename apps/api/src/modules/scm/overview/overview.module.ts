import { Module } from "@nestjs/common";
import {
  AdvancedController,
  AssistantController,
  BarcodeController,
  MasterDataController,
  OverviewController,
} from "./overview.controller.js";
import { AssistantRepository } from "./assistant.repository.js";
import { OverviewRepository } from "./overview.repository.js";
import { OverviewService } from "./overview.service.js";

@Module({
  controllers: [
    OverviewController,
    MasterDataController,
    BarcodeController,
    AdvancedController,
    AssistantController,
  ],
  providers: [OverviewRepository, AssistantRepository, OverviewService],
})
export class OverviewModule {}
