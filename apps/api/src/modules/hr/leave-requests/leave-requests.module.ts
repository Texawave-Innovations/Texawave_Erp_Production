import { Module } from "@nestjs/common";
import { AttendanceModule } from "../attendance/attendance.module.js";
import { EmployeesModule } from "../employees/employees.module.js";
import {
  LeaveEntitlementsController,
  LeaveRequestsController,
} from "./leave-requests.controller.js";
import { LeaveRequestsRepository } from "./leave-requests.repository.js";
import { LeaveRequestsService } from "./leave-requests.service.js";

@Module({
  // Attendance's day-context loader provides the shared holiday/weekly-off
  // calendar that working-day counts are taken from.
  imports: [EmployeesModule, AttendanceModule],
  controllers: [LeaveRequestsController, LeaveEntitlementsController],
  providers: [LeaveRequestsRepository, LeaveRequestsService],
  // Self-service calls the service (never the repository).
  exports: [LeaveRequestsService],
})
export class LeaveRequestsModule {}
