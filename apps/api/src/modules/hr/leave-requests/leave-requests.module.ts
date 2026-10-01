import { Module } from "@nestjs/common";
import { EmployeesModule } from "../employees/employees.module.js";
import { LeaveRequestsController } from "./leave-requests.controller.js";
import { LeaveRequestsRepository } from "./leave-requests.repository.js";
import { LeaveRequestsService } from "./leave-requests.service.js";

@Module({
  imports: [EmployeesModule],
  controllers: [LeaveRequestsController],
  providers: [LeaveRequestsRepository, LeaveRequestsService],
  // Self-service calls the service (never the repository).
  exports: [LeaveRequestsService],
})
export class LeaveRequestsModule {}
