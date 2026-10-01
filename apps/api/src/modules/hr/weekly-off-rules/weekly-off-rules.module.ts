import { Module } from "@nestjs/common";
import { WeeklyOffRulesController } from "./weekly-off-rules.controller.js";
import { WeeklyOffRulesRepository } from "./weekly-off-rules.repository.js";
import { WeeklyOffRulesService } from "./weekly-off-rules.service.js";

@Module({
  controllers: [WeeklyOffRulesController],
  providers: [WeeklyOffRulesRepository, WeeklyOffRulesService],
})
export class WeeklyOffRulesModule {}
