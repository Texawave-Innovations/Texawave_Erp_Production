import { Module } from "@nestjs/common";
import { EmployeesModule } from "../employees/employees.module.js";
import { WorkLogsController } from "./work-logs.controller.js";
import { WorkLogsRepository } from "./work-logs.repository.js";
import { WorkLogsService } from "./work-logs.service.js";

@Module({
  imports: [EmployeesModule],
  controllers: [WorkLogsController],
  providers: [WorkLogsRepository, WorkLogsService],
  // Self-service calls the service (never the repository).
  exports: [WorkLogsService],
})
export class WorkLogsModule {}
