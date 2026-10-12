import { Module } from "@nestjs/common";
import { SalariesController } from "./salaries.controller.js";
import { SalariesRepository } from "./salaries.repository.js";
import { SalariesService } from "./salaries.service.js";

@Module({
  controllers: [SalariesController],
  providers: [SalariesRepository, SalariesService],
  exports: [SalariesRepository, SalariesService],
})
export class SalariesModule {}
