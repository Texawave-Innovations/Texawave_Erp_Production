import { Module } from "@nestjs/common";
import { ProjectCodeMasterController } from "./project-code-master.controller.js";
import { ProjectCodeMasterRepository } from "./project-code-master.repository.js";
import { ProjectCodeMasterService } from "./project-code-master.service.js";
import { ProjectsMasterController } from "./projects-master.controller.js";
import { ProjectsMasterRepository } from "./projects-master.repository.js";
import { ProjectsMasterService } from "./projects-master.service.js";
import { TaskRunningNumberMasterController } from "./task-running-number-master.controller.js";
import { TaskRunningNumberMasterRepository } from "./task-running-number-master.repository.js";
import { TaskRunningNumberMasterService } from "./task-running-number-master.service.js";

@Module({
  controllers: [
    ProjectsMasterController,
    ProjectCodeMasterController,
    TaskRunningNumberMasterController,
  ],
  providers: [
    ProjectsMasterRepository,
    ProjectsMasterService,
    ProjectCodeMasterRepository,
    ProjectCodeMasterService,
    TaskRunningNumberMasterRepository,
    TaskRunningNumberMasterService,
  ],
})
export class ProjectsMasterModule {}
