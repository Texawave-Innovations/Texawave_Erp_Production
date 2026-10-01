import { Module } from "@nestjs/common";
import { EmployeesModule } from "../../hr/employees/employees.module.js";
import { ProfileController } from "./profile.controller.js";
import { ProfileService } from "./profile.service.js";

@Module({
  imports: [EmployeesModule],
  controllers: [ProfileController],
  providers: [ProfileService],
})
export class ProfileModule {}
