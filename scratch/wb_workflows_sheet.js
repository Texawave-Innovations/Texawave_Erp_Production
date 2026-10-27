const fs = require("fs");

function addWorkflowsSheet(
  wb,
  FONT_NAME,
  titleFont,
  subTitleFont,
  sectionFont,
  headerFont,
  cellFont,
  boldCellFont,
  titleFill,
  headerFill,
  altRowFill,
  sectionHeaderFill,
  thinBorder,
  statusStyles,
) {
  console.log("Building Sheet 5: Finance Feature & Workflow Matrix...");
  const ws = wb.addWorksheet("Finance Feature & Workflows", {
    views: [{ state: "frozen", ySplit: 4, showGridLines: true }],
  });

  const cols = [
    { header: "Workflow ID", key: "id", width: 14 },
    { header: "Module", key: "module", width: 22 },
    { header: "User Action / Workflow Name", key: "name", width: 34 },
    { header: "UI Page / Entry Point", key: "uiPage", width: 28 },
    { header: "API Endpoint", key: "endpoint", width: 38 },
    { header: "Backend Service Method", key: "serviceMethod", width: 34 },
    { header: "Database Models Affected", key: "models", width: 36 },
    { header: "Preconditions", key: "preconditions", width: 36 },
    { header: "Business Rules & Validations", key: "rules", width: 44 },
    { header: "Accounting / Journal Entries", key: "accounting", width: 44 },
    { header: "GST Behaviour", key: "gst", width: 38 },
    { header: "Required Permissions", key: "perms", width: 28 },
    { header: "Success Outcome & Transition", key: "outcome", width: 36 },
    { header: "Error Handling & Rollback", key: "errors", width: 36 },
    { header: "Test Coverage", key: "testCoverage", width: 32 },
    { header: "Current Status", key: "status", width: 22 },
  ];
  ws.columns = cols;

  ws.mergeCells("A1:P1");
  const a1 = ws.getCell("A1");
  a1.value =
    "TexaWave ERP — Complete Finance Feature & Business Workflow Matrix (16 Core Workflows)";
  a1.font = titleFont;
  a1.fill = titleFill;
  a1.alignment = { vertical: "middle", indent: 1 };
  ws.getRow(1).height = 36;

  ws.mergeCells("A2:P2");
  const a2 = ws.getCell("A2");
  a2.value =
    "Comprehensive Lifecycle Specifications | Preconditions, UI Routes, API Endpoints, Double-Entry Rules, GST Impact, and Test Coverage";
  a2.font = subTitleFont;
  a2.fill = titleFill;
  a2.alignment = { vertical: "middle", indent: 1 };
  ws.getRow(2).height = 20;

  ws.getRow(3).height = 8;

  const hRow = ws.getRow(4);
  cols.forEach((col, idx) => {
    const c = hRow.getCell(idx + 1);
    c.value = col.header;
    c.font = headerFont;
    c.fill = headerFill;
    c.border = thinBorder;
    c.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  });
  hRow.height = 30;

  const workflows = [
    [
      "WF-EXP-01",
      "Expenses",
      "Create Ordinary Expense (Non-GST / Non-ITC)",
      "/finance/expenses/new",
      "POST /finance/expenses",
      "ExpensesService.create()",
      "FinanceExpense, FinanceMasterListItem",
      "Active organization context; valid Expense Account (Type: EXPENSE); valid vendor/payee name",
      "Ordinary expenses default to taxAmount: 0, isItcEligible: false. Decoupled from Asset Account 1300—does NOT require 1300 mapping. If non-recoverable tax entered, absorbed directly into expense debit leg.",
      "None at DRAFT stage. On POST/PAY: DR: Expense Account (5xxx) for total net amount; CR: Cash/Bank Account (1xxx) or Accounts Payable (2000).",
      "Not reported in GSTR-2B; no ITC ledger credit generated. No GSTIN required.",
      "finance.expense.create",
      "FinanceExpense created with status DRAFT or SUBMITTED; expense number generated (EXP-YYYYMMDD-XXXX)",
      "400 Bad Request if negative amount or invalid account ID; atomic rollback via Prisma transaction",
      "expenses.service.spec.ts (cases 1-8), manual EXP-001, EXP-LIVE-01",
      "Production Ready",
    ],
    [
      "WF-EXP-02",
      "Expenses",
      "Create Expense with GST & Input Tax Credit (ITC)",
      "/finance/expenses/new",
      "POST /finance/expenses",
      "ExpensesService.create()",
      "FinanceExpense, FinanceGstEntry, FinanceMasterListItem",
      "Active organization context; valid Expense Account; Asset Account 1300 (Input Tax Credit) mapped; valid 15-char vendor GSTIN",
      "Requires valid vendorGstin regex; splits tax into CGST/SGST (intra-state) or IGST (inter-state) based on state code (first 2 digits); isItcEligible: true; taxRate must match 0/5/12/18/28%.",
      "On POST/PAY: DR: Expense Account (5xxx) (taxable base); DR: Input Tax Credit Account (1300) (cgst+sgst or igst); CR: Bank/Payable (1xxx/2xxx) (gross invoice amount).",
      "Creates FinanceGstEntry with entryType: INWARD_SUPPLY, itcEligibility: ELIGIBLE, returnType: GSTR_2B. Tagged with vendor GSTIN.",
      "finance.expense.create",
      "FinanceExpense created with GST fields populated; linked to GSTR-2B registry; state SUBMITTED or APPROVED",
      "400 Bad Request if invalid GSTIN format or mismatched tax breakdown; 422 if account 1300 missing; atomic rollback",
      "expenses.service.spec.ts (GST/ITC suite), manual EXP-002, EXP-LIVE-02",
      "Production Ready",
    ],
    [
      "WF-EXP-03",
      "Expenses",
      "Convert HR Approved Claim to Finance Expense",
      "/finance/expenses",
      "POST /finance/expenses/claims/:claimId/convert",
      "ExpensesService.createFromClaim()",
      "FinanceExpense, hr.ExpenseClaim, hr.Employee",
      "HR Expense Claim exists with status APPROVED in hr.expense_claims; claim not previously converted (financeExpenseId is null)",
      "Automated conversion with zero manual re-entry; queries Employee.fullName directly (fixed regression from firstName/lastName); preserves receipt attachments; default expense account mapped.",
      "Prepares DRAFT/APPROVED expense; on posting: DR: Travel/Employee Expense (5200); CR: Employee Reimbursement Payable (2150).",
      "Inherits GSTIN and tax details from claim receipt if present, else defaults to non-ITC expense.",
      "finance.expense.create, finance.claim.convert",
      "FinanceExpense record created with claimId reference; HR claim updated with financeExpenseId and status CONVERTED",
      "404 if claim not found; 409 if already converted; 400 if claim not in APPROVED status",
      "expenses.service.spec.ts (claim conversion suite), manual EXP-005, EXP-LIVE-03",
      "Production Ready",
    ],
    [
      "WF-EXP-04",
      "Expenses",
      "Post / Pay Expense (Disbursement & Ledger Posting)",
      "/finance/expenses",
      "POST /finance/expenses/:id/pay",
      "ExpensesService.pay()",
      "FinanceExpense, FinanceJournalEntry, FinanceJournalLine, FinanceBankAccount, FinanceBankTransaction",
      "Expense status is APPROVED or SUBMITTED; valid payment method (BANK_TRANSFER, CASH, UPI); active Bank Account with sufficient balance",
      "Idempotent posting; generates auto-numbered Journal Entry JE-YYYYMMDD-XXXX; validates double-entry balance sum(debit) == sum(credit); decrements bank account balance atomically.",
      "DR: Expense Account (5xxx) (net base); DR: Input Tax Credit (1300) (if ITC eligible); CR: Bank/Cash Account (1xxx) (total disbursement).",
      "Finalizes GST entry status to POSTED in GST registry; locks ITC claim date to payment/posting date.",
      "finance.expense.post, finance.expense.pay",
      "FinanceExpense.status updated to PAID / POSTED; journalEntryId linked; FinanceBankTransaction recorded",
      "400 if already paid; 422 if unbalanced journal lines; Prisma $transaction ensures all-or-nothing rollback",
      "expenses.service.spec.ts (pay suite), manual EXP-003, EXP-LIVE-04",
      "Production Ready",
    ],
    [
      "WF-EXP-05",
      "Expenses",
      "Cancel / Void Expense",
      "/finance/expenses",
      "POST /finance/expenses/:id/cancel",
      "ExpensesService.cancel()",
      "FinanceExpense, FinanceJournalEntry, FinanceJournalLine, FinanceGstEntry",
      "Expense status is DRAFT, SUBMITTED, or APPROVED; if PAID/POSTED, user must possess supervisor void permission",
      "If unposted: simply marks CANCELLED. If posted: generates Reversal Journal Entry with inverted debits and credits; marks original and reversal entries as linked.",
      "For posted reversal: DR: Bank/Cash Account (1xxx) (reimbursement refund); CR: Expense Account (5xxx); CR: Input Tax Credit (1300) (if previously claimed).",
      "Generates GSTR-2B reversal / credit note entry in GST registry to nullify previously recorded ITC.",
      "finance.expense.cancel",
      "FinanceExpense.status set to CANCELLED; cancellationReason logged; reversal journal entry created if previously posted",
      "400 if already cancelled; 403 if attempting to void posted expense without supervisor permission",
      "expenses.service.spec.ts (reversal suite), manual EXP-004, EXP-LIVE-05",
      "Production Ready",
    ],
    [
      "WF-BNK-01",
      "Banking & Treasury",
      "Record Bank Transaction (Deposit / Withdrawal / Transfer)",
      "/finance/banking",
      "POST /finance/banking/transactions",
      "BankingService.createTransaction()",
      "FinanceBankAccount, FinanceBankTransaction, FinanceJournalEntry, FinanceJournalLine",
      "Active FinanceBankAccount exists and is not closed/frozen; transaction date within active fiscal period",
      "Enforces positive transaction amount; validates transaction type (DEPOSIT, WITHDRAWAL, TRANSFER); validates contra-account for journal posting; calculates running bank balance.",
      "For Deposit: DR: Bank Account (1010) | CR: Source / Income Account. For Withdrawal: DR: Expense / Payables | CR: Bank Account (1010). For Transfer: DR: Destination Bank | CR: Source Bank.",
      "Non-GST financial transaction; no GSTR entry triggered unless marked as bank charges with GST.",
      "finance.banking.transaction.create",
      "FinanceBankTransaction created with status UNCLEARED or CLEARED; FinanceBankAccount.currentBalance updated atomically",
      "400 if invalid amount; 404 if bank account not found; Prisma transaction rollbacks balance on journal failure",
      "banking.service.spec.ts, manual BNK-002, BNK-LIVE-01",
      "Production Ready",
    ],
    [
      "WF-BNK-02",
      "Banking & Treasury",
      "Reconcile Bank Transaction with General Ledger",
      "/finance/banking",
      "POST /finance/banking/reconciliation/match",
      "BankingService.reconcile()",
      "FinanceBankAccount, FinanceBankTransaction, FinanceJournalLine",
      "Bank transaction with status UNCLEARED or CLEARED; un-reconciled journal line on the corresponding GL account with matching amount",
      "Amount and currency must match within tolerance; transaction date must align with statement period; links transaction ID to journal line ID; flags discrepancy if amounts mismatch.",
      "No new journal entry generated; updates reconciliation metadata (isReconciled: true, reconciledAt, reconciledBy) on both bank transaction and GL journal line.",
      "None (balance sheet treasury reconciliation).",
      "finance.banking.reconcile",
      "Both records marked RECONCILED; bank reconciliation report difference updated to zero",
      "400 if already reconciled or amount mismatch exceeds tolerance; 404 if target journal line not found",
      "banking.service.spec.ts (reconciliation matching tests), manual BNK-003",
      "Production Ready",
    ],
    [
      "WF-GST-01",
      "GST & Tax",
      "Generate GSTR-1 Outward Supplies Summary",
      "/finance/gst",
      "GET /finance/gst/reports/gstr1",
      "GstService.getGstr1Summary()",
      "FinanceGstEntry, FinanceJournalEntry, FinanceJournalLine",
      "Active organization; fiscal year and month / quarter query parameters (period: YYYY-MM); posted outward sales/invoices exist",
      "Aggregates FinanceGstEntry with entryType: OUTWARD_SUPPLY; groups by B2B (with customer GSTIN), B2CL (inter-state large > 2.5L), B2CS (intra-state/small), and Nil/Exempt; sums taxable values and tax breakdown.",
      "Read-only reporting aggregation; verifies output tax liabilities match GL Account 2200 (GST Output Tax Payable).",
      "Matches official Indian GST portal GSTR-1 tables (4A B2B, 5A B2CL, 7 B2CS, 9B CDNR); outputs CGST, SGST, IGST, and Cess.",
      "finance.gst.view",
      "Returns JSON report with section summaries, tax rate breakdowns (0%, 5%, 12%, 18%, 28%), and invoice level details",
      "400 if invalid period format; returns empty dataset if no outward entries for period",
      "gst.service.spec.ts (GSTR-1 aggregation suite), manual GST-002, GST-LIVE-01",
      "Production Ready",
    ],
    [
      "WF-GST-02",
      "GST & Tax",
      "Generate GSTR-2B Input Tax Credit (ITC) Report",
      "/finance/gst",
      "GET /finance/gst/reports/gstr2b",
      "GstService.getGstr2bSummary()",
      "FinanceGstEntry, FinanceExpense, FinanceJournalLine",
      "Active organization context; tax period selected (period: YYYY-MM); inward purchase invoices or expenses recorded",
      "Aggregates FinanceGstEntry with entryType: INWARD_SUPPLY; separates eligible ITC (isItcEligible: true) from ineligible ITC (Section 17(5) blocked credit, food/beverage, motor vehicles); calculates net ITC claimable.",
      "Verifies eligible ITC matches GL Account 1300 (Input Tax Credit Receivable) debit balances for the period.",
      "Generates Table 3 (ITC Available) and Table 4 (ITC Reversal / Ineligible) per CBIC GSTR-2B format.",
      "finance.gst.view",
      "Returns detailed breakdown of Part A (ITC Available: B2B, Debit Notes) and Part B (ITC Reversals / Ineligible)",
      "400 if invalid tax period query; returns empty report if no inward supplies found",
      "gst.service.spec.ts (GSTR-2B ITC suite), manual GST-003",
      "Production Ready",
    ],
    [
      "WF-INT-01",
      "Integration (Sales/CRM)",
      "Sales Invoice Posting to Finance & General Ledger",
      "/sales/invoices",
      "POST /finance/integration/sales-invoices/:id/post",
      "FinanceIntegrationService.postSalesInvoice()",
      "FinanceJournalEntry, FinanceJournalLine, FinanceGstEntry, FinancePaymentReceivedAllocation",
      "Sales Invoice finalized and approved in Sales module; customer account and items configured; tax rates assigned",
      "Prevents double posting via idempotency key (sales-invoice-{id}); verifies accounts receivable account (1200) and sales revenue account (4000) mapped; records invoice reference string.",
      "DR: Accounts Receivable (1200) (invoice total); CR: Sales Revenue (4000) (taxable value); CR: Output CGST Payable (2210) | CR: Output SGST Payable (2220) | CR: Output IGST Payable (2230).",
      "Creates outward FinanceGstEntry tagged with customer GSTIN, invoice number, date, and tax rate breakdown for GSTR-1.",
      "finance.integration.post, sales.invoice.post",
      "Journal Entry created and posted; GST Outward entry created; invoice status updated to POSTED_TO_FINANCE",
      "409 Conflict if already posted; 422 if GL accounts unmapped; atomic rollback on journal unbalance",
      "finance-integration.service.spec.ts, manual INT-001, INT-LIVE-01",
      "Production Ready",
    ],
    [
      "WF-INT-02",
      "Integration (SCM/Purchase)",
      "Purchase Bill Posting to Finance & General Ledger",
      "/procurement/bills",
      "POST /finance/integration/purchase-bills/:id/post",
      "FinanceIntegrationService.postPurchaseBill()",
      "FinanceJournalEntry, FinanceJournalLine, FinanceGstEntry",
      "Purchase Bill approved in SCM/Procurement module; vendor details and line items verified; 3-way match complete",
      "Idempotency enforced on bill ID; requires Accounts Payable (2000) and Inventory/Expense accounts; verifies vendor GSTIN for ITC eligibility.",
      "DR: Inventory Asset / Cost of Goods (1400/5000) (taxable amount); DR: Input Tax Credit (1300) (eligible GST); CR: Accounts Payable (2000) (bill total).",
      "Creates inward FinanceGstEntry tagged with vendor GSTIN, invoice number, and HSN code for GSTR-2B.",
      "finance.integration.post, scm.bill.post",
      "Journal entry posted; GST inward entry recorded; bill status updated to POSTED_TO_FINANCE",
      "409 Conflict if already posted; 422 if unmapped AP accounts; atomic rollback via Prisma transaction",
      "finance-integration.service.spec.ts, manual INT-002",
      "Production Ready",
    ],
    [
      "WF-REP-01",
      "Financial Reports",
      "Generate Balance Sheet Statement",
      "/finance/reports/balance-sheet",
      "GET /finance/reports/balance-sheet",
      "FinancialReportsService.getBalanceSheet()",
      "FinanceAccount, FinanceJournalLine, FinanceJournalEntry",
      "Organization active; valid asOfDate query parameter (default today); posted journal entries exist",
      "Calculates cumulative balances for Asset (1xxx), Liability (2xxx), and Equity (3xxx) accounts; includes current year Net Profit/Loss transferred to Retained Earnings; verifies Fundamental Equation Total Assets == Total Liabilities + Total Equity.",
      "Read-only calculation; aggregates debit - credit balances for Asset accounts, and credit - debit balances for Liability/Equity accounts.",
      "Reflects net Input Tax Credit balance in Current Assets and net GST Output Tax Liability in Current Liabilities.",
      "finance.reports.view",
      "Returns structured financial statement with Assets breakdown, Liabilities breakdown, Equity, and Net Balance verification flag (isBalanced: true)",
      "400 if invalid date format; returns zero-balance hierarchy if no posted transactions exist",
      "financial-reports.service.spec.ts (17/17 tests passed), manual REP-001, REP-LIVE-01",
      "Production Ready",
    ],
    [
      "WF-REP-02",
      "Financial Reports",
      "Generate Profit & Loss (Income) Statement",
      "/finance/reports/profit-loss",
      "GET /finance/reports/profit-loss",
      "FinancialReportsService.getProfitAndLoss()",
      "FinanceAccount, FinanceJournalLine, FinanceJournalEntry",
      "Organization active; valid date range startDate and endDate specified",
      "Aggregates posted lines for Revenue (4xxx) and Expense (5xxx) accounts within period; computes Gross Profit (Operating Revenue - Cost of Goods Sold), Operating Profit, and Net Profit (Operating Profit - Operating Expenses + Other Income - Other Expenses).",
      "Read-only calculation; ignores unposted/draft journal entries.",
      "Excludes GST amounts (GST is balance sheet pass-through, not income or expense).",
      "finance.reports.view",
      "Returns JSON response with categorized revenues, categorized expenses, sub-totals, and bottom-line Net Profit/Loss",
      "400 if startDate > endDate; 400 if date formats invalid",
      "financial-reports.service.spec.ts, manual REP-002",
      "Production Ready",
    ],
    [
      "WF-REP-03",
      "Financial Reports",
      "Generate Trial Balance",
      "/finance/reports/trial-balance",
      "GET /finance/reports/trial-balance",
      "FinancialReportsService.getTrialBalance()",
      "FinanceAccount, FinanceJournalLine, FinanceJournalEntry",
      "Organization active; valid asOfDate or period query parameters",
      "Lists all active Chart of Accounts with opening balance, period debit movement, period credit movement, and closing balance; strictly asserts Total Debits == Total Credits.",
      "Read-only verification; flags out-of-balance warnings if debit total does not equal credit total down to the cent/paise.",
      "Lists specific balances for Input Tax Credit (1300) and Output GST accounts (2210, 2220, 2230).",
      "finance.reports.view",
      "Returns array of accounts with net debit/credit columns and verification checksum (totalDebit === totalCredit)",
      "400 if invalid date parameters",
      "financial-reports.service.spec.ts, manual REP-003",
      "Production Ready",
    ],
    [
      "WF-REP-04",
      "Financial Reports",
      "Generate General Ledger Detailed Statement",
      "/finance/reports/general-ledger",
      "GET /finance/reports/general-ledger",
      "FinancialReportsService.getGeneralLedger()",
      "FinanceAccount, FinanceJournalLine, FinanceJournalEntry",
      "Organization active; account filter (accountId) or all accounts; startDate and endDate",
      "Calculates opening balance before startDate; streams posted journal lines chronologically; calculates running balance after each entry; groups by account code.",
      "Read-only drill-down; displays journal entry number, transaction date, reference description, debit amount, credit amount, and running balance.",
      "Displays tax reference IDs and GSTIN for tax-related journal lines.",
      "finance.reports.view",
      "Returns detailed transaction ledger with pagination, opening balance, transaction stream, and closing balance",
      "400 if invalid account ID or date range; 404 if account does not belong to organization",
      "financial-reports.service.spec.ts, manual REP-004",
      "Production Ready",
    ],
    [
      "WF-PAY-01",
      "Payments Received & Applied",
      "Record Customer Payment & Invoice Allocation",
      "/finance/payments-received",
      "POST /finance/payments-received",
      "PaymentsReceivedService.create()",
      "FinancePaymentReceived, FinancePaymentReceivedAllocation, FinanceBankAccount, FinanceJournalEntry, FinanceJournalLine",
      "Active organization; customer account exists; outstanding sales invoice references known; valid bank/cash receiving account",
      "Payment amount must equal sum of line allocations; allocations can be full or partial against invoiceReference; marks payment status as POSTED or UNALLOCATED (advance payment).",
      "DR: Bank Account (1010) (payment received amount); CR: Accounts Receivable (1200) (amount allocated against invoices); CR: Customer Advance / Unearned Revenue (for unallocated remainder).",
      "Advance payments may trigger GST Advance Receipt voucher if inter-state or services per GST rules.",
      "finance.payment.create, finance.payment.post",
      "FinancePaymentReceived and FinancePaymentReceivedAllocation rows created; Journal Entry posted; customer balance credited",
      "400 if allocation sum exceeds payment amount; 422 if receiving bank account is inactive",
      "payments-received.service.spec.ts, manual PR-001, PR-002, REG-LIVE-01",
      "Production Ready",
    ],
  ];

  let rIdx = 5;
  workflows.forEach((row, i) => {
    const r = ws.getRow(rIdx);
    r.height = 36;
    row.forEach((v, c) => {
      const cell = r.getCell(c + 1);
      cell.value = v;
      cell.font = cellFont;
      cell.border = thinBorder;
      cell.alignment = {
        vertical: "middle",
        horizontal:
          c === 0 || c === 3 || c === 11 || c === 15 ? "center" : "left",
        wrapText: true,
      };
      if (i % 2 === 1) cell.fill = altRowFill;
      if (c === 0) cell.font = boldCellFont;
      if (c === 15 && statusStyles[v]) {
        cell.fill = statusStyles[v].fill;
        cell.font = statusStyles[v].font;
      }
    });
    rIdx++;
  });

  ws.autoFilter = { from: "A4", to: `P${rIdx - 1}` };
  console.log(`Sheet 5 built with ${workflows.length} core workflows.`);
}

module.exports = { addWorkflowsSheet };
