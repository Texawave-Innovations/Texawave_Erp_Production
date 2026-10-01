import { Module } from "@nestjs/common";
import { LeaveRequestsModule } from "../../hr/leave-requests/leave-requests.module.js";
import { MyLeaveRequestsController } from "./my-leave-requests.controller.js";

@Module({
  imports: [LeaveRequestsModule],
  controllers: [MyLeaveRequestsController],
})
export class MyLeaveRequestsModule {}
