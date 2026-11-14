import { Module } from "@nestjs/common";
import { NotificationsModule } from "../../../platform/notifications/notifications.module.js";
import { EmployeesModule } from "../../hr/employees/employees.module.js";
import { MyWorkPermissionsController } from "./my-work-permissions.controller.js";
import { MyWorkPermissionsRepository } from "./my-work-permissions.repository.js";
import { MyWorkPermissionsService } from "./my-work-permissions.service.js";

@Module({
  imports: [EmployeesModule, NotificationsModule],
  controllers: [MyWorkPermissionsController],
  providers: [MyWorkPermissionsRepository, MyWorkPermissionsService],
})
export class MyWorkPermissionsModule {}
