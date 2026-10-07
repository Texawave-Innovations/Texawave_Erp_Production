import { Module } from "@nestjs/common";
import { EmployeesModule } from "../employees/employees.module.js";
import { ExpenseClaimsController } from "./expense-claims.controller.js";
import { ExpenseClaimsRepository } from "./expense-claims.repository.js";
import { ExpenseClaimsService } from "./expense-claims.service.js";

@Module({
  imports: [EmployeesModule],
  controllers: [ExpenseClaimsController],
  providers: [ExpenseClaimsRepository, ExpenseClaimsService],
  // Self-service calls the service (never the repository).
  exports: [ExpenseClaimsService],
})
export class ExpenseClaimsModule {}
