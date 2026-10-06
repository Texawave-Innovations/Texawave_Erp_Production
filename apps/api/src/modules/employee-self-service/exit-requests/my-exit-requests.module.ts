import { Module } from "@nestjs/common";
import { ExitRequestsModule } from "../../hr/exit-requests/exit-requests.module.js";
import { MyExitRequestsController } from "./my-exit-requests.controller.js";

@Module({
  imports: [ExitRequestsModule],
  controllers: [MyExitRequestsController],
})
export class MyExitRequestsModule {}
