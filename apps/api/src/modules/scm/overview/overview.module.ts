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
import { ScanRepository } from "./scan.repository.js";
import { OverviewService } from "./overview.service.js";

@Module({
  controllers: [
    OverviewController,
    MasterDataController,
    BarcodeController,
    AdvancedController,
    AssistantController,
  ],
  providers: [
    OverviewRepository,
    AssistantRepository,
    ScanRepository,
    OverviewService,
  ],
})
export class OverviewModule {}
