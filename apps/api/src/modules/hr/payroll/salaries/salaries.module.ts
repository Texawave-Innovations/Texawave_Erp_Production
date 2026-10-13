import { Module } from "@nestjs/common";
import { SalaryComponentsModule } from "../salary-components/salary-components.module.js";
import { PayrollSettingsModule } from "../settings/payroll-settings.module.js";
import { SalariesController } from "./salaries.controller.js";
import { SalariesRepository } from "./salaries.repository.js";
import { SalariesService } from "./salaries.service.js";

@Module({
  imports: [PayrollSettingsModule, SalaryComponentsModule],
  controllers: [SalariesController],
  providers: [SalariesRepository, SalariesService],
  exports: [SalariesRepository, SalariesService],
})
export class SalariesModule {}
