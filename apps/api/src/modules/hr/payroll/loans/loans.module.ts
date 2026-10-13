import { Module } from "@nestjs/common";
import { NotificationsModule } from "../../../../platform/notifications/notifications.module.js";
import { EmployeesModule } from "../../employees/employees.module.js";
import { PayrollSettingsModule } from "../settings/payroll-settings.module.js";
import { LoanNotificationsService } from "./loan-notifications.service.js";
import { LoansController, MyLoansController } from "./loans.controller.js";
import { LoansRepository } from "./loans.repository.js";
import { LoansService } from "./loans.service.js";

@Module({
  imports: [EmployeesModule, NotificationsModule, PayrollSettingsModule],
  controllers: [LoansController, MyLoansController],
  providers: [LoansRepository, LoansService, LoanNotificationsService],
  exports: [LoansRepository, LoansService],
})
export class LoansModule {}
