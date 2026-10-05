import { Module } from "@nestjs/common";
import { WorkLogsModule } from "../../hr/work-logs/work-logs.module.js";
import { MyWorkLogsController } from "./my-work-logs.controller.js";

@Module({
  imports: [WorkLogsModule],
  controllers: [MyWorkLogsController],
})
export class MyWorkLogsModule {}
