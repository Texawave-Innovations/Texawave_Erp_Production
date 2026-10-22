import { Module } from "@nestjs/common";
import { LeadsModule } from "../leads/leads.module.js";
import { CrmMiningRowsController } from "./mining-rows.controller.js";
import { CrmMiningRowsRepository } from "./mining-rows.repository.js";
import { CrmMiningRowsService } from "./mining-rows.service.js";

@Module({
  imports: [LeadsModule],
  controllers: [CrmMiningRowsController],
  providers: [CrmMiningRowsRepository, CrmMiningRowsService],
  exports: [CrmMiningRowsRepository, CrmMiningRowsService],
})
export class CrmMiningRowsModule {}
