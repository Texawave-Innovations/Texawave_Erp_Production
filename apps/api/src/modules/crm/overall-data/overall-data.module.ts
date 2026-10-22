import { Module } from "@nestjs/common";
import { CrmOverallDataController } from "./overall-data.controller.js";
import { CrmOverallDataRepository } from "./overall-data.repository.js";
import { CrmOverallDataService } from "./overall-data.service.js";

@Module({
  controllers: [CrmOverallDataController],
  providers: [CrmOverallDataRepository, CrmOverallDataService],
})
export class CrmOverallDataModule {}
