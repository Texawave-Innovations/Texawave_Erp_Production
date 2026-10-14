import { Module } from "@nestjs/common";
import { TasksModule } from "../../hr/tasks/tasks.module.js";
import { MyTasksController } from "./my-tasks.controller.js";

@Module({
  imports: [TasksModule],
  controllers: [MyTasksController],
})
export class MyTasksModule {}
