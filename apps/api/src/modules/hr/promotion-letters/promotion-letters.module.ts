import { Module } from "@nestjs/common";
import { PromotionLettersController } from "./promotion-letters.controller.js";
import { PromotionLettersRepository } from "./promotion-letters.repository.js";
import { PromotionLettersService } from "./promotion-letters.service.js";

@Module({
  controllers: [PromotionLettersController],
  providers: [PromotionLettersRepository, PromotionLettersService],
})
export class PromotionLettersModule {}
