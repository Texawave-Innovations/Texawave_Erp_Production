import { Module } from "@nestjs/common";
import { PayrollReportsController } from "./payroll-reports.controller.js";
import { PayrollReportsService } from "./payroll-reports.service.js";

@Module({
  controllers: [PayrollReportsController],
  providers: [PayrollReportsService],
})
export class PayrollReportsModule {}
