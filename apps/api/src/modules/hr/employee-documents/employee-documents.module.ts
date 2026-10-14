import { Module } from "@nestjs/common";
import { EmployeesModule } from "../employees/employees.module.js";
import { EmployeeDocumentsController } from "./employee-documents.controller.js";
import { EmployeeDocumentsRepository } from "./employee-documents.repository.js";
import { EmployeeDocumentsService } from "./employee-documents.service.js";

@Module({
  imports: [EmployeesModule],
  controllers: [EmployeeDocumentsController],
  providers: [EmployeeDocumentsService, EmployeeDocumentsRepository],
})
export class EmployeeDocumentsModule {}
