import { Module } from "@nestjs/common";
import { PayrollCalculatorService } from "./payroll-calculator.service.js";
import { PayrollRunsController } from "./payroll-runs.controller.js";
import { PayrollRunsRepository } from "./payroll-runs.repository.js";
import { PayrollRunsService } from "./payroll-runs.service.js";

@Module({
  controllers: [PayrollRunsController],
  providers: [
    PayrollRunsRepository,
    PayrollRunsService,
    PayrollCalculatorService,
  ],
  exports: [
    PayrollRunsRepository,
    PayrollRunsService,
    PayrollCalculatorService,
  ],
})
export class PayrollRunsModule {}
