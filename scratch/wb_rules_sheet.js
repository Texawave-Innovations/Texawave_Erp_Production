const fs = require("fs");

function addRulesSheet(
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
  console.log("Building Sheet 6: Accounting & GST Rules...");
  const ws = wb.addWorksheet("Accounting & GST Rules", {
    views: [{ state: "frozen", ySplit: 4, showGridLines: true }],
  });

  const cols = [
    { header: "Rule ID", key: "id", width: 14 },
    { header: "Category", key: "category", width: 24 },
    { header: "Accounting / GST Principle", key: "principle", width: 34 },
    { header: "Implemented Business Logic", key: "logic", width: 48 },
    {
      header: "Validation & Enforcement Mechanism",
      key: "validation",
      width: 44,
    },
    { header: "Source File", key: "sourceFile", width: 48 },
    { header: "Test Reference", key: "testRef", width: 36 },
    { header: "Status", key: "status", width: 22 },
  ];
  ws.columns = cols;

  ws.mergeCells("A1:H1");
  const a1 = ws.getCell("A1");
  a1.value =
    "TexaWave ERP — Core Accounting Invariants & GST Statutory Business Rules";
  a1.font = titleFont;
  a1.fill = titleFill;
  a1.alignment = { vertical: "middle", indent: 1 };
  ws.getRow(1).height = 36;

  ws.mergeCells("A2:H2");
  const a2 = ws.getCell("A2");
  a2.value =
    "Authoritative Double-Entry Accounting Principles, GST Statutory Logic (CGST/SGST/IGST), ITC Asset Recognition, and System Invariants";
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

  const rulesData = [
    [
      "RULE-EXP-01",
      "Ordinary Expenses",
      "Matching Principle & Immediate Expense Recognition",
      "Operating expenses without GST or with non-recoverable tax are recorded in full against nominal expense accounts (5xxx). Decoupled from Asset Account 1300; does not require Account 1300 to be mapped in Chart of Accounts. Non-recoverable GST is capitalized/absorbed directly into the expense debit leg.",
      "CreateExpenseDto defaults isItcEligible: false and taxAmount: 0. ExpensesService.create() skips tax account lookup when isItcEligible === false.",
      "apps/api/src/modules/finance/expenses/expenses.service.ts",
      "expenses.service.spec.ts (cases: creates expense without requiring 1300), manual EXP-001",
      "Production Ready",
    ],
    [
      "RULE-EXP-02",
      "GST-Eligible Expenses & ITC",
      "Input Tax Credit Asset Recognition (CGST Act Sec 16)",
      "For B2B business expenses where vendor provides a tax invoice with valid GSTIN, GST is recognized as an Asset (Input Tax Credit Account 1300) rather than an expense. Net expense is debited for taxable base value; Account 1300 is debited for GST amount.",
      "Enforces isItcEligible: true, requires valid 15-character vendor GSTIN matching statutory regex ^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$, and requires Asset Account 1300 configured.",
      "apps/api/src/modules/finance/expenses/expenses.service.ts",
      "expenses.service.spec.ts (cases: debits Account 1300 when isItcEligible is true), manual EXP-002",
      "Production Ready",
    ],
    [
      "RULE-GST-01",
      "GST-Eligible Expenses & ITC",
      "Destination-Based Consumption Tax (Intra vs Inter-State)",
      "If supplier state code (first 2 digits of vendorGstin) matches organization state code, GST is split equally into 50% CGST and 50% SGST. If state codes differ, entire GST amount is recognized as 100% IGST.",
      "TaxJurisdictionRule in ExpensesService and GstService extracts first 2 digits of supplier GSTIN and buyer GSTIN; asserts cgstAmount + sgstAmount == taxAmount or igstAmount == taxAmount.",
      "apps/api/src/modules/finance/gst/gst.service.ts",
      "gst.service.spec.ts (cases: splits CGST/SGST for intra-state, IGST for inter-state), manual GST-001",
      "Production Ready",
    ],
    [
      "RULE-GST-02",
      "GST Registry & Returns",
      "Blocked Credits & Non-Eligibility (CGST Act Sec 17(5))",
      "Expenses categorized under food & beverages, personal consumption, club memberships, or motor vehicles cannot claim ITC. System tags isItcEligible: false and requires an ineligibilityReason code (e.g. SEC_17_5_BLOCKED, EXEMPT_SUPPLY, NON_BUSINESS_USE). Tax is added to the expense debit line.",
      "FinanceExpense schema validation; GSTR-2B generator places these transactions into Table 4(B) (Ineligible ITC) rather than Table 4(A).",
      "apps/api/src/modules/finance/expenses/dto/create-expense.dto.ts",
      "expenses.service.spec.ts (cases: handles Sec 17(5) blocked credit), manual EXP-006",
      "Production Ready",
    ],
    [
      "RULE-GST-03",
      "GST Registry & Returns",
      "Audit Trail & Invoice Duplicate Prevention",
      "Each vendor invoice or credit note in GSTR-2B registry must be globally unique per vendor per financial year. System prevents duplicate recording of the same vendor invoice number and date combination.",
      "Composite database index [organizationId, vendorGstin, vendorInvoiceNumber] on FinanceGstEntry and FinanceExpense; application check throws 409 Conflict on duplicate invoice submission.",
      "packages/database/prisma/schema.prisma (FinanceGstEntry)",
      "gst.service.spec.ts (cases: rejects duplicate vendor invoice entry with 409 Conflict), manual GST-004",
      "Production Ready",
    ],
    [
      "RULE-SAL-01",
      "Sales Invoices & Output Tax",
      "Revenue Recognition & Output Tax Liability (CGST Sec 9)",
      "Posting a sales invoice recognizes sales revenue net of tax in Account 4000 (Sales Revenue), recognizes accounts receivable from customer in Account 1200 (Accounts Receivable), and creates output tax liability in Account 2200 (GST Output Tax Payable: 2210 CGST / 2220 SGST / 2230 IGST).",
      "FinanceIntegrationService.postSalesInvoice() enforces double-entry balance totalInvoiceAmount == taxableAmount + totalGstAmount; creates linked FinanceGstEntry with entryType: OUTWARD_SUPPLY for GSTR-1 Table 4A/B2B.",
      "apps/api/src/modules/finance/integration/finance-integration.service.ts",
      "finance-integration.service.spec.ts (cases: posts sales invoice to AR, Revenue, Output GST), manual INT-001",
      "Production Ready",
    ],
    [
      "RULE-PUR-01",
      "Purchase Bills & Input Tax",
      "Three-Way Match & Accrual Accounting (IndAS 37)",
      "Posting a vendor purchase bill debits Inventory Asset (1400) or Purchase Expense (5000), debits Input Tax Credit (1300) for eligible tax, and credits Accounts Payable (2000) for total payable to vendor.",
      "Prevents double posting via idempotency check on purchase bill ID; verifies active AP account; generates inward GST entry for GSTR-2B.",
      "apps/api/src/modules/finance/integration/finance-integration.service.ts",
      "finance-integration.service.spec.ts (cases: posts purchase bill to AP and inventory with ITC), manual INT-002",
      "Production Ready",
    ],
    [
      "RULE-PAY-01",
      "Payments Received & Applied",
      "Sub-Ledger to General Ledger Synchronization",
      "Customer payments debit Cash/Bank (1010) and credit Accounts Receivable (1200) for allocated amounts. Any unallocated payment is credited to Customer Advance (2110). If advance is subject to GST, generates Advance Receipt voucher.",
      "PaymentsReceivedService.create() validates sum(allocations) <= totalPaymentAmount; atomic transaction updates bank balance, posts journal entry, and marks allocations.",
      "apps/api/src/modules/finance/payments-received/payments-received.service.ts",
      "payments-received.service.spec.ts (cases: creates payment received with multi-invoice allocation), manual PR-001",
      "Production Ready",
    ],
    [
      "RULE-GL-01",
      "General Ledger Invariants",
      "Fundamental Double-Entry Accounting Invariant (Pacioli)",
      "Every Journal Entry must strictly balance: sum of debit lines must equal sum of credit lines down to 2 decimal places (Math.abs(sumDebit - sumCredit) < 0.001). No transaction may commit if debits do not equal credits.",
      "JournalEntriesService.create() and ExpensesService.pay() calculate debit and credit sums before calling prisma.financeJournalEntry.create(); throws 422 Unprocessable Entity if difference is non-zero.",
      "apps/api/src/modules/finance/journal-entries/journal-entries.service.ts",
      "journal-entries.service.spec.ts (cases: rejects unbalanced journal entry with 422), manual CHK-001",
      "Production Ready",
    ],
    [
      "RULE-GL-02",
      "General Ledger Invariants",
      "Immutability of Posted Financial Records (Audit Compliance)",
      "Once a Journal Entry is marked POSTED, neither the entry header nor any of its journal lines may be modified or deleted directly in the database. Correction must be executed exclusively via a Reversal Journal Entry or Rectification Entry.",
      'JournalEntriesService.update() and delete() check status !== "POSTED"; throws 403 Forbidden / 400 Bad Request on attempt to alter posted journal entries.',
      "apps/api/src/modules/finance/journal-entries/journal-entries.service.ts",
      "journal-entries.service.spec.ts (cases: prevents modification of posted journal entry), manual CHK-002",
      "Production Ready",
    ],
    [
      "RULE-GL-03",
      "General Ledger Invariants",
      "Sequential Chronological Audit Trail & Reference Numbering",
      "All journal entries, expenses, bank transactions, and payments generate guaranteed chronological sequential identifiers (JE-YYYYMMDD-XXXX, EXP-YYYYMMDD-XXXX, PR-YYYYMMDD-XXXX, BT-YYYYMMDD-XXXX) scoped per organization.",
      "Organization sequence generator uses database transactions with row-level locks or sequence tables to prevent number gaps and collisions under concurrent requests.",
      "apps/api/src/modules/finance/journal-entries/journal-entries.service.ts",
      "journal-entries.service.spec.ts (cases: generates sequential JE numbers per organization), manual CHK-003",
      "Production Ready",
    ],
    [
      "RULE-REP-01",
      "General Ledger Invariants",
      "Balance Sheet Identity: Assets = Liabilities + Equity",
      "Financial Reports generator computes Balance Sheet statement and asserts Total Assets === Total Liabilities + Total Equity. Includes Net Income from P&L dynamically transferred into Retained Earnings. Flags out-of-balance condition if discrepancy detected.",
      "FinancialReportsService.getBalanceSheet() verifies equation balance; returns isBalanced: true/false and explicit variance figure in response metadata.",
      "apps/api/src/modules/finance/reports/financial-reports.service.ts",
      "financial-reports.service.spec.ts (17/17 tests passed, asserting balance sheet reconciliation), manual REP-001",
      "Production Ready",
    ],
  ];

  let rIdx = 5;
  rulesData.forEach((row, i) => {
    const r = ws.getRow(rIdx);
    r.height = 36;
    row.forEach((v, c) => {
      const cell = r.getCell(c + 1);
      cell.value = v;
      cell.font = cellFont;
      cell.border = thinBorder;
      cell.alignment = {
        vertical: "middle",
        horizontal: c === 0 || c === 7 ? "center" : "left",
        wrapText: true,
      };
      if (i % 2 === 1) cell.fill = altRowFill;
      if (c === 0) cell.font = boldCellFont;
      if (c === 7 && statusStyles[v]) {
        cell.fill = statusStyles[v].fill;
        cell.font = statusStyles[v].font;
      }
    });
    rIdx++;
  });

  ws.autoFilter = { from: "A4", to: `H${rIdx - 1}` };
  console.log(
    `Sheet 6 built with ${rulesData.length} core accounting & GST rules.`,
  );
}

module.exports = { addRulesSheet };
