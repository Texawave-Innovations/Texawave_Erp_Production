import { Module } from "@nestjs/common";
import { EmployeesModule } from "../employees/employees.module.js";
import { AttendanceController } from "./attendance.controller.js";
import { AttendanceDayContextRepository } from "./attendance-day-context.repository.js";
import { AttendanceRepository } from "./attendance.repository.js";
import { AttendanceService } from "./attendance.service.js";
import { AttendanceCorrectionsController } from "./corrections/attendance-corrections.controller.js";
import { AttendanceCorrectionsRepository } from "./corrections/attendance-corrections.repository.js";
import { AttendanceCorrectionsService } from "./corrections/attendance-corrections.service.js";
import { AttendanceReportsController } from "./reports/attendance-reports.controller.js";
import { AttendanceReportsRepository } from "./reports/attendance-reports.repository.js";
import { AttendanceReportsService } from "./reports/attendance-reports.service.js";
import { AttendanceAutoCheckoutService } from "./services/attendance-auto-checkout.service.js";
import { AttendanceAutoCheckoutScheduler } from "./services/attendance-auto-checkout.scheduler.js";
import { AttendanceCalculationService } from "./services/attendance-calculation.service.js";
import { AttendanceDayViewService } from "./services/attendance-day-view.service.js";

/** An HR submodule (Docs/ATTENDANCE_ARCHITECTURE.md §1). Its tables are in the
 * `hr` schema. Employee data is read through EmployeeQueryService only. The
 * order of `controllers` matters: the corrections and reports routes are
 * registered before `hr/attendance/:id`, so a literal path such as
 * `/corrections` is never read as an id. */
@Module({
  imports: [EmployeesModule],
  controllers: [
    AttendanceCorrectionsController,
    AttendanceReportsController,
    AttendanceController,
  ],
  providers: [
    AttendanceCalculationService,
    AttendanceDayViewService,
    AttendanceDayContextRepository,
    AttendanceRepository,
    AttendanceService,
    AttendanceCorrectionsRepository,
    AttendanceCorrectionsService,
    AttendanceReportsRepository,
    AttendanceReportsService,
    AttendanceAutoCheckoutService,
    // The single in-process scheduler that runs auto-checkout (see its header).
    AttendanceAutoCheckoutScheduler,
  ],
  exports: [AttendanceService, AttendanceAutoCheckoutService],
})
export class AttendanceModule {}
