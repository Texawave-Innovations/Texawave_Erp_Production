import { Module } from "@nestjs/common";
import { NotificationsModule } from "../../platform/notifications/notifications.module.js";
import { AttendanceModule } from "../hr/attendance/attendance.module.js";
import { EmployeesModule } from "../hr/employees/employees.module.js";
import { ProjectsModule } from "../projects/projects.module.js";
import { TimesheetsCoreModule } from "./core/timesheets-core.module.js";
import { CustomActivitiesController } from "./custom-activities.controller.js";
import { CustomActivitiesRepository } from "./custom-activities.repository.js";
import { CustomActivitiesService } from "./custom-activities.service.js";
import { TimesheetNotificationsService } from "./timesheet-notifications.service.js";
import { TimesheetWorkflowController } from "./timesheet-workflow.controller.js";
import { TimesheetWorkflowRepository } from "./timesheet-workflow.repository.js";
import { TimesheetWorkflowService } from "./timesheet-workflow.service.js";
import { TimesheetsController } from "./timesheets.controller.js";
import { TimesheetsRepository } from "./timesheets.repository.js";
import { TimesheetsService } from "./timesheets.service.js";

/** The employee's timesheet: the read side (my day, a task's day history),
 * custom activities (meetings, discussions...) and submit / review (reporting
 * manager, then HR). Imports `ProjectsModule` (task
 * list, status history, linkable projects); `ProjectsModule` imports only
 * `TimesheetsCoreModule`, so there is no import cycle. */
@Module({
  imports: [
    ProjectsModule,
    AttendanceModule,
    EmployeesModule,
    TimesheetsCoreModule,
    NotificationsModule,
  ],
  controllers: [
    TimesheetsController,
    CustomActivitiesController,
    TimesheetWorkflowController,
  ],
  providers: [
    TimesheetsRepository,
    TimesheetsService,
    CustomActivitiesRepository,
    CustomActivitiesService,
    TimesheetWorkflowRepository,
    TimesheetWorkflowService,
    TimesheetNotificationsService,
  ],
})
export class TimesheetsModule {}
