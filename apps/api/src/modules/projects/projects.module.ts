import { Module } from "@nestjs/common";
import { EmployeesModule } from "../hr/employees/employees.module.js";
import { ProjectsMasterModule } from "../projects-master/projects-master.module.js";
import { SuppliersModule } from "../scm/suppliers/suppliers.module.js";
import { AttendanceModule } from "../hr/attendance/attendance.module.js";
import { ProjectsAnalyticsController } from "./analytics.controller.js";
import { ProjectsAnalyticsService } from "./analytics.service.js";
import { ExpensesController } from "./expenses.controller.js";
import { ExpensesService } from "./expenses.service.js";
import { MilestonesController } from "./milestones.controller.js";
import { MilestonesService } from "./milestones.service.js";
import { ProjectsController } from "./projects.controller.js";
import { ProjectsRepository } from "./projects.repository.js";
import { ProjectsService } from "./projects.service.js";
import { TasksController } from "./tasks.controller.js";
import { TasksService } from "./tasks.service.js";
import { TimeEntriesController } from "./time-entries.controller.js";
import { TimeEntriesService } from "./time-entries.service.js";

@Module({
  imports: [
    EmployeesModule,
    ProjectsMasterModule,
    SuppliersModule,
    AttendanceModule,
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
    ProjectsService,
    MilestonesService,
    TasksService,
    TimeEntriesService,
    ExpensesService,
    ProjectsAnalyticsService,
  ],
  exports: [ProjectsService, TasksService],
})
export class ProjectsModule {}
