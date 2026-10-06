import { Module } from "@nestjs/common";
import { BankDetailsModule } from "./bank-details/bank-details.module.js";
import { BonusesModule } from "./bonuses/bonuses.module.js";
import { ComplianceModule } from "./compliance/compliance.module.js";
import { LoansModule } from "./loans/loans.module.js";
import { PaymentsModule } from "./payments/payments.module.js";
import { PayslipsModule } from "./payslips/payslips.module.js";
import { PayrollPeriodsModule } from "./periods/payroll-periods.module.js";
import { PayrollRunsModule } from "./runs/payroll-runs.module.js";
import { SalariesModule } from "./salaries/salaries.module.js";

@Module({
  imports: [
    PayrollPeriodsModule,
    SalariesModule,
    ComplianceModule,
    LoansModule,
    BonusesModule,
    PayrollRunsModule,
    PayslipsModule,
    PaymentsModule,
    BankDetailsModule,
  ],
  exports: [
    PayrollPeriodsModule,
    SalariesModule,
    ComplianceModule,
    LoansModule,
    BonusesModule,
    PayrollRunsModule,
    PayslipsModule,
    PaymentsModule,
    BankDetailsModule,
  ],
})
export class PayrollModule {}
