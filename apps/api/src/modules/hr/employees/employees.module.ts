import { Module } from "@nestjs/common";
import { AuthModule } from "../../../platform/auth/auth.module.js";
import { EmployeeLifecycleController } from "./employee-lifecycle.controller.js";
import { EmployeeLifecycleRepository } from "./employee-lifecycle.repository.js";
import { EmployeeLifecycleService } from "./employee-lifecycle.service.js";
import { EmployeeQueryService } from "./employee-query.service.js";
import { EmployeesController } from "./employees.controller.js";
import { EmployeesRepository } from "./employees.repository.js";
import { EmployeesService } from "./employees.service.js";

@Module({
  imports: [AuthModule],
  controllers: [EmployeesController, EmployeeLifecycleController],
  providers: [
    EmployeesRepository,
    EmployeeLifecycleRepository,
    EmployeesService,
    EmployeeLifecycleService,
    EmployeeQueryService,
  ],
  // Only the public read service leaves this module — never a repository.
  exports: [EmployeeQueryService],
})
export class EmployeesModule {}
