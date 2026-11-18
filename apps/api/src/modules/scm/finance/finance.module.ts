import { forwardRef, Module } from "@nestjs/common";
import { ScmMasterListItemsModule } from "../master-list-items/master-list-items.module.js";
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

/**
 * Supplier finance slice: bills, payments and documents.
 * `forwardRef` on FinanceCoreModule: Finance Payments Made (inside the core
 * Finance module) injects this module's FinanceService to post a supplier
 * payment atomically alongside its own GL/bank entry
 * (Docs/CODING_STANDARDS.md §11) — the two modules import each other.
 */
@Module({
  imports: [
    SuppliersModule,
    ScmMasterListItemsModule,
    forwardRef(() => FinanceCoreModule),
  ],
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
