import { Module } from "@nestjs/common";
import { BankAccountsController } from "./banking/bank-accounts.controller.js";
import { BankAccountsRepository } from "./banking/bank-accounts.repository.js";
import { BankTransactionsController } from "./banking/bank-transactions.controller.js";
import { BankTransactionsRepository } from "./banking/bank-transactions.repository.js";
import { BankingService } from "./banking/banking.service.js";
import { AccountsController } from "./coa/accounts.controller.js";
import { AccountsRepository } from "./coa/accounts.repository.js";
import { AccountsService } from "./coa/accounts.service.js";
import { ExpensesController } from "./expenses/expenses.controller.js";
import { ExpensesRepository } from "./expenses/expenses.repository.js";
import { ExpensesService } from "./expenses/expenses.service.js";
import { JournalEntriesController } from "./journal/journal-entries.controller.js";
import { JournalEntriesRepository } from "./journal/journal-entries.repository.js";
import { JournalEntriesService } from "./journal/journal-entries.service.js";
import { PaymentsMadeController } from "./payments-made/payments-made.controller.js";
import { PaymentsMadeRepository } from "./payments-made/payments-made.repository.js";
import { PaymentsMadeService } from "./payments-made/payments-made.service.js";
import { PaymentsReceivedController } from "./payments-received/payments-received.controller.js";
import { PaymentsReceivedRepository } from "./payments-received/payments-received.repository.js";
import { PaymentsReceivedService } from "./payments-received/payments-received.service.js";
import { ReportsController } from "./reports/reports.controller.js";
import { ReportsRepository } from "./reports/reports.repository.js";
import { ReportsService } from "./reports/reports.service.js";
import { GstController } from "./gst/gst.controller.js";
import { GstRepository } from "./gst/gst.repository.js";
import { GstService } from "./gst/gst.service.js";
import { SalesPurchasesIntegrationController } from "./integration/sales-purchases-integration.controller.js";
import { SalesPurchasesIntegrationService } from "./integration/sales-purchases-integration.service.js";

/**
 * Finance Core Module.
 * Houses Chart of Accounts, Journal Entries, Expenses, Payments Received,
 * Bank Accounts, Bank Transactions, Payments Made, Financial Reports,
 * GST Reporting & Reconciliation, and Sales/Purchases Accounting Integration.
 */
@Module({
  controllers: [
    AccountsController,
    JournalEntriesController,
    ExpensesController,
    PaymentsReceivedController,
    BankAccountsController,
    BankTransactionsController,
    PaymentsMadeController,
    ReportsController,
    GstController,
    SalesPurchasesIntegrationController,
  ],
  providers: [
    AccountsRepository,
    AccountsService,
    JournalEntriesRepository,
    JournalEntriesService,
    ExpensesRepository,
    ExpensesService,
    PaymentsReceivedRepository,
    PaymentsReceivedService,
    BankAccountsRepository,
    BankTransactionsRepository,
    BankingService,
    PaymentsMadeRepository,
    PaymentsMadeService,
    ReportsRepository,
    ReportsService,
    GstRepository,
    GstService,
    SalesPurchasesIntegrationService,
  ],
  exports: [
    AccountsRepository,
    AccountsService,
    JournalEntriesRepository,
    JournalEntriesService,
    ExpensesRepository,
    ExpensesService,
    PaymentsReceivedRepository,
    PaymentsReceivedService,
    BankAccountsRepository,
    BankTransactionsRepository,
    BankingService,
    PaymentsMadeRepository,
    PaymentsMadeService,
    ReportsRepository,
    ReportsService,
    GstRepository,
    GstService,
    SalesPurchasesIntegrationService,
  ],
})
export class FinanceModule {}
