import { Module } from "@nestjs/common";
import { ComplianceController } from "./compliance.controller.js";
import { ComplianceRepository } from "./compliance.repository.js";
import { ComplianceService } from "./compliance.service.js";

@Module({
  controllers: [ComplianceController],
  providers: [ComplianceRepository, ComplianceService],
  exports: [ComplianceRepository, ComplianceService],
})
export class ComplianceModule {}
