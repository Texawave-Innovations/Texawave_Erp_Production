import { Module } from "@nestjs/common";
import { PayrollSettingsModule } from "../settings/payroll-settings.module.js";
import { BonusesController } from "./bonuses.controller.js";
import { BonusesRepository } from "./bonuses.repository.js";
import { BonusesService } from "./bonuses.service.js";

@Module({
  imports: [PayrollSettingsModule],
  controllers: [BonusesController],
  providers: [BonusesRepository, BonusesService],
  exports: [BonusesRepository, BonusesService],
})
export class BonusesModule {}
