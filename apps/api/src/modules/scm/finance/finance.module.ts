import { Module } from "@nestjs/common";
import { FinanceModule as FinanceCoreModule } from "../../finance/finance.module.js";
import { SuppliersModule } from "../suppliers/suppliers.module.js";
import {
  SupplierBillsController,
  SupplierDocumentsController,
  SupplierFinanceSummaryController,
  SupplierPaymentsController,
} from "./finance.controller.js";
import { FinanceRepository } from "./finance.repository.js";
import { FinanceService } from "./finance.service.js";

/** Supplier finance slice: bills, payments and documents. */
@Module({
  imports: [SuppliersModule, FinanceCoreModule],
  controllers: [
    SupplierBillsController,
    SupplierPaymentsController,
    SupplierFinanceSummaryController,
    SupplierDocumentsController,
  ],
  providers: [FinanceRepository, FinanceService],
  exports: [FinanceService],
})
export class FinanceModule {}
