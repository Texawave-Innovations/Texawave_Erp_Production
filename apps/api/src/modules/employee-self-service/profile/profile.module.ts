import { Module } from "@nestjs/common";
import { UsersModule } from "../../../platform/users/users.module.js";
import { EmployeesModule } from "../../hr/employees/employees.module.js";
import { HrOnboardingController } from "./hr-onboarding.controller.js";
import { OnboardingProgressService } from "./onboarding-progress.service.js";
import { ProfileController } from "./profile.controller.js";
import { ProfileRepository } from "./profile.repository.js";
import { ProfileService } from "./profile.service.js";

@Module({
  imports: [EmployeesModule, UsersModule],
  controllers: [ProfileController, HrOnboardingController],
  providers: [ProfileService, ProfileRepository, OnboardingProgressService],
})
export class ProfileModule {}
