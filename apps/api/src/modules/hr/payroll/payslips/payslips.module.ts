import { Module } from "@nestjs/common";
import { EmployeesModule } from "../../employees/employees.module.js";
import { MyPayslipsController } from "./my-payslips.controller.js";
import { PayslipsController } from "./payslips.controller.js";
import { PayslipsRepository } from "./payslips.repository.js";
import { PayslipsService } from "./payslips.service.js";

@Module({
  imports: [EmployeesModule],
  controllers: [PayslipsController, MyPayslipsController],
  providers: [PayslipsRepository, PayslipsService],
  exports: [PayslipsService],
})
export class PayslipsModule {}
