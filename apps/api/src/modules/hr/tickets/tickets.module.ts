import { Module } from "@nestjs/common";
import { EmployeesModule } from "../employees/employees.module.js";
import { TicketsController } from "./tickets.controller.js";
import { TicketsRepository } from "./tickets.repository.js";
import { TicketsService } from "./tickets.service.js";

@Module({
  imports: [EmployeesModule],
  controllers: [TicketsController],
  providers: [TicketsRepository, TicketsService],
  // Self-service calls the service (never the repository).
  exports: [TicketsService],
})
export class TicketsModule {}
