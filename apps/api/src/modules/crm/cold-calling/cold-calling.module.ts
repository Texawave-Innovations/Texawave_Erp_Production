import { Module } from "@nestjs/common";
import { CrmColdCallingController } from "./cold-calling.controller.js";
import { CrmColdCallingRepository } from "./cold-calling.repository.js";
import { CrmColdCallingService } from "./cold-calling.service.js";

@Module({
  controllers: [CrmColdCallingController],
  providers: [CrmColdCallingRepository, CrmColdCallingService],
})
export class CrmColdCallingModule {}
