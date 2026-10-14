import { Module } from "@nestjs/common";
import { EmployeesModule } from "../../employees/employees.module.js";
import { Form16PdfRenderer, Form16Service } from "./form16.service.js";
import { TaxDeclarationsRepository } from "./tax-declarations.repository.js";
import { TaxDeclarationsService } from "./tax-declarations.service.js";
import { TaxSetupRepository } from "./tax-setup.repository.js";
import { TaxSetupService } from "./tax-setup.service.js";
import {
  MyTaxController,
  TaxDeclarationsController,
  TaxSetupController,
} from "./tax.controller.js";

@Module({
  imports: [EmployeesModule],
  controllers: [TaxSetupController, TaxDeclarationsController, MyTaxController],
  providers: [
    TaxSetupRepository,
    TaxSetupService,
    TaxDeclarationsRepository,
    TaxDeclarationsService,
    Form16PdfRenderer,
    Form16Service,
  ],
})
export class TaxModule {}
