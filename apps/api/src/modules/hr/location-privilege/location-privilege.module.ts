import { Module } from "@nestjs/common";
import { EmployeesModule } from "../employees/employees.module.js";
import {
  LocationPrivilegeController,
  OfficeNetworkController,
} from "./location-privilege.controller.js";
import { LocationPrivilegeRepository } from "./location-privilege.repository.js";
import { LocationPrivilegeService } from "./location-privilege.service.js";

/** Location Privilege (HR). Attendance imports the service to gate punches. */
@Module({
  imports: [EmployeesModule],
  controllers: [LocationPrivilegeController, OfficeNetworkController],
  providers: [LocationPrivilegeRepository, LocationPrivilegeService],
  exports: [LocationPrivilegeService],
})
export class LocationPrivilegeModule {}
