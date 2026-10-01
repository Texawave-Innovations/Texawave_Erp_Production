import { Module } from "@nestjs/common";
import { DepartmentsController } from "./departments.controller.js";
import { DepartmentsRepository } from "./departments.repository.js";
import { DepartmentsService } from "./departments.service.js";

@Module({
  controllers: [DepartmentsController],
  providers: [DepartmentsRepository, DepartmentsService],
})
export class DepartmentsModule {}
