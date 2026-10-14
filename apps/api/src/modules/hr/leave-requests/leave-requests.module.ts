import { Module } from "@nestjs/common";
import { NotificationsModule } from "../../../platform/notifications/notifications.module.js";
import { AttendanceModule } from "../attendance/attendance.module.js";
import { EmployeesModule } from "../employees/employees.module.js";
import {
  LeaveDelegationsController,
  LeaveEntitlementsController,
  LeaveRequestsController,
} from "./leave-requests.controller.js";
import { LeaveDelegationsRepository } from "./leave-delegations.repository.js";
import { LeaveDelegationsService } from "./leave-delegations.service.js";
import { LeaveNotificationsService } from "./leave-notifications.service.js";
import { LeaveRequestsRepository } from "./leave-requests.repository.js";
import { LeaveRequestsService } from "./leave-requests.service.js";
import { LeaveTransferService } from "./leave-transfer.service.js";

@Module({
  // Attendance's day-context loader provides the shared holiday/weekly-off
  // calendar that working-day counts are taken from.
  imports: [EmployeesModule, AttendanceModule, NotificationsModule],
  controllers: [
    LeaveRequestsController,
    LeaveEntitlementsController,
    LeaveDelegationsController,
  ],
  providers: [
    LeaveRequestsRepository,
    LeaveRequestsService,
    LeaveDelegationsRepository,
    LeaveDelegationsService,
    LeaveNotificationsService,
    LeaveTransferService,
  ],
  // Self-service calls the service (never the repository).
  exports: [LeaveRequestsService],
})
export class LeaveRequestsModule {}
