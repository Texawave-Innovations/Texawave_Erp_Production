import { Module } from "@nestjs/common";
import { EmployeesModule } from "../hr/employees/employees.module.js";
import { ProjectsMasterModule } from "../projects-master/projects-master.module.js";
import { SuppliersModule } from "../scm/suppliers/suppliers.module.js";
import { TimesheetsCoreModule } from "../timesheets/core/timesheets-core.module.js";
import { AttendanceModule } from "../hr/attendance/attendance.module.js";
import { ProjectsAnalyticsController } from "./analytics.controller.js";
import { ProjectsAnalyticsService } from "./analytics.service.js";
import { ExpensesController } from "./expenses.controller.js";
import { ExpensesService } from "./expenses.service.js";
import { MilestonesController } from "./milestones.controller.js";
import { MilestonesService } from "./milestones.service.js";
import { OpenSessionSweepScheduler } from "./open-session-sweep.scheduler.js";
import { OpenSessionSweepService } from "./open-session-sweep.service.js";
import { ProjectsController } from "./projects.controller.js";
import { ProjectsRepository } from "./projects.repository.js";
import { ProjectsService } from "./projects.service.js";
import { TasksController } from "./tasks.controller.js";
import { TaskLifecycleRepository } from "./task-lifecycle.repository.js";
import { TaskLifecycleService } from "./task-lifecycle.service.js";
import { TasksService } from "./tasks.service.js";
import { TimeEntriesController } from "./time-entries.controller.js";
import { TimeEntriesService } from "./time-entries.service.js";

@Module({
  imports: [
    EmployeesModule,
    ProjectsMasterModule,
    SuppliersModule,
    AttendanceModule,
    TimesheetsCoreModule,
  ],
  // ProjectsController registers LAST: its `GET /projects/:id` (ParseIntPipe)
  // would otherwise shadow single-segment literal routes on the same prefix
  // such as `GET /projects/expenses`, answering them with a 400.
  controllers: [
    ExpensesController,
    ProjectsAnalyticsController,
    MilestonesController,
    TasksController,
    TimeEntriesController,
    ProjectsController,
  ],
  providers: [
    ProjectsRepository,
    TaskLifecycleRepository,
    TaskLifecycleService,
    // Closes forgotten timers (see open-session-sweep.service.ts); the scheduler
    // is the one in-process interval that runs it.
    OpenSessionSweepService,
    OpenSessionSweepScheduler,
    ProjectsService,
    MilestonesService,
    TasksService,
    TimeEntriesService,
    ExpensesService,
    ProjectsAnalyticsService,
  ],
  exports: [ProjectsService, TasksService, TaskLifecycleService],
})
export class ProjectsModule {}
