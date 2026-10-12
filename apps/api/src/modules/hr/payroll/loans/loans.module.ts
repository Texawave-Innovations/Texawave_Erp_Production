import { Module } from "@nestjs/common";
import { EmployeesModule } from "../../employees/employees.module.js";
import { LoansController, MyLoansController } from "./loans.controller.js";
import { LoansRepository } from "./loans.repository.js";
import { LoansService } from "./loans.service.js";

@Module({
  imports: [EmployeesModule],
  controllers: [LoansController, MyLoansController],
  providers: [LoansRepository, LoansService],
  exports: [LoansRepository, LoansService],
})
export class LoansModule {}
