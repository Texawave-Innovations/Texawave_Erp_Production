import { Module } from "@nestjs/common";
import { BonusesModule } from "./bonuses/bonuses.module.js";
import { ComplianceModule } from "./compliance/compliance.module.js";
import { LoansModule } from "./loans/loans.module.js";
import { PaymentsModule } from "./payments/payments.module.js";
import { PayslipsModule } from "./payslips/payslips.module.js";
import { PayrollPeriodsModule } from "./periods/payroll-periods.module.js";
import { PayrollReportsModule } from "./reports/payroll-reports.module.js";
import { PayrollRunsModule } from "./runs/payroll-runs.module.js";
import { SalaryComponentsModule } from "./salary-components/salary-components.module.js";
import { SalariesModule } from "./salaries/salaries.module.js";
import { PayrollSettingsModule } from "./settings/payroll-settings.module.js";
import { TaxModule } from "./tax/tax.module.js";

@Module({
  imports: [
    PayrollSettingsModule,
    PayrollPeriodsModule,
    SalariesModule,
    ComplianceModule,
    LoansModule,
    BonusesModule,
    PayrollRunsModule,
    PayslipsModule,
    PaymentsModule,
    SalaryComponentsModule,
    TaxModule,
    PayrollReportsModule,
  ],
  exports: [
    PayrollSettingsModule,
    PayrollPeriodsModule,
    SalariesModule,
    ComplianceModule,
    LoansModule,
    BonusesModule,
    PayrollRunsModule,
    PayslipsModule,
    PaymentsModule,
  ],
})
export class PayrollModule {}
