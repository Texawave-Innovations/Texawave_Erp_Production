import { Module } from "@nestjs/common";
import { PayrollSettingsController } from "./payroll-settings.controller.js";
import { PayrollSettingsRepository } from "./payroll-settings.repository.js";
import { PayrollSettingsService } from "./payroll-settings.service.js";

@Module({
  controllers: [PayrollSettingsController],
  providers: [PayrollSettingsRepository, PayrollSettingsService],
  exports: [PayrollSettingsService],
})
export class PayrollSettingsModule {}
