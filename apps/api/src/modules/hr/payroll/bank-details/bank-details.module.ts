import { Module } from "@nestjs/common";
import { BankDetailsController } from "./bank-details.controller.js";
import { BankDetailsRepository } from "./bank-details.repository.js";
import { BankDetailsService } from "./bank-details.service.js";

@Module({
  controllers: [BankDetailsController],
  providers: [BankDetailsRepository, BankDetailsService],
  exports: [BankDetailsRepository, BankDetailsService],
})
export class BankDetailsModule {}
