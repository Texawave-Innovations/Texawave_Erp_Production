import { Module } from "@nestjs/common";
import { SalaryComponentsController } from "./salary-components.controller.js";
import { SalaryComponentsRepository } from "./salary-components.repository.js";
import { SalaryComponentsService } from "./salary-components.service.js";

@Module({
  controllers: [SalaryComponentsController],
  providers: [SalaryComponentsRepository, SalaryComponentsService],
  exports: [SalaryComponentsService],
})
export class SalaryComponentsModule {}
