import { Module } from "@nestjs/common";
import { EmployeesModule } from "../employees/employees.module.js";
import { TasksController } from "./tasks.controller.js";
import { TasksRepository } from "./tasks.repository.js";
import { TasksService } from "./tasks.service.js";

@Module({
  imports: [EmployeesModule],
  controllers: [TasksController],
  providers: [TasksRepository, TasksService],
  // Self-service calls the service (never the repository).
  exports: [TasksService],
})
export class TasksModule {}
