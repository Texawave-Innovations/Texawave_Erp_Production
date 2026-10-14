import { Module } from "@nestjs/common";
import { EmployeesModule } from "../employees/employees.module.js";
import { ExitRequestsController } from "./exit-requests.controller.js";
import { ExitRequestsRepository } from "./exit-requests.repository.js";
import { ExitRequestsService } from "./exit-requests.service.js";

@Module({
  imports: [EmployeesModule],
  controllers: [ExitRequestsController],
  providers: [ExitRequestsRepository, ExitRequestsService],
  // Self-service calls the service (never the repository).
  exports: [ExitRequestsService],
})
export class ExitRequestsModule {}
