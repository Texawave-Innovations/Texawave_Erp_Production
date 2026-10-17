import { Module } from "@nestjs/common";
import { QuotationsController } from "./quotations.controller.js";
import { QuotationsRepository } from "./quotations.repository.js";
import { QuotationsService } from "./quotations.service.js";

@Module({
  controllers: [QuotationsController],
  providers: [QuotationsRepository, QuotationsService],
  exports: [QuotationsRepository, QuotationsService],
})
export class QuotationsModule {}
