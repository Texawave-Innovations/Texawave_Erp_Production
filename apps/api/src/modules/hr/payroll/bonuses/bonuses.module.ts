import { Module } from "@nestjs/common";
import { BonusesController } from "./bonuses.controller.js";
import { BonusesRepository } from "./bonuses.repository.js";
import { BonusesService } from "./bonuses.service.js";

@Module({
  controllers: [BonusesController],
  providers: [BonusesRepository, BonusesService],
  exports: [BonusesRepository, BonusesService],
})
export class BonusesModule {}
