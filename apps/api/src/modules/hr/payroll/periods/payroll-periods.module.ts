import { Module } from "@nestjs/common";
import { PayrollPeriodsController } from "./payroll-periods.controller.js";
import { PayrollPeriodsRepository } from "./payroll-periods.repository.js";
import { PayrollPeriodsService } from "./payroll-periods.service.js";

@Module({
  controllers: [PayrollPeriodsController],
  providers: [PayrollPeriodsRepository, PayrollPeriodsService],
  exports: [PayrollPeriodsRepository, PayrollPeriodsService],
})
export class PayrollPeriodsModule {}
