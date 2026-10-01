import { Module } from "@nestjs/common";
import { EmploymentTypesController } from "./employment-types.controller.js";
import { EmploymentTypesRepository } from "./employment-types.repository.js";
import { EmploymentTypesService } from "./employment-types.service.js";

@Module({
  controllers: [EmploymentTypesController],
  providers: [EmploymentTypesRepository, EmploymentTypesService],
})
export class EmploymentTypesModule {}
