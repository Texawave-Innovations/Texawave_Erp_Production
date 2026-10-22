import { Module } from "@nestjs/common";
import { CrmTasksController } from "./tasks.controller.js";
import { CrmTasksRepository } from "./tasks.repository.js";
import { CrmTasksService } from "./tasks.service.js";

@Module({
  controllers: [CrmTasksController],
  providers: [CrmTasksRepository, CrmTasksService],
  exports: [CrmTasksRepository, CrmTasksService],
})
export class CrmTasksModule {}
