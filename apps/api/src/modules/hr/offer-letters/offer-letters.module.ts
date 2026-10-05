import { Module } from "@nestjs/common";
import { OfferLettersController } from "./offer-letters.controller.js";
import { OfferLettersRepository } from "./offer-letters.repository.js";
import { OfferLettersService } from "./offer-letters.service.js";

@Module({
  controllers: [OfferLettersController],
  providers: [OfferLettersRepository, OfferLettersService],
})
export class OfferLettersModule {}
