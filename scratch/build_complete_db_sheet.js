const fs = require("fs");

const data = JSON.parse(
  fs.readFileSync("scratch/all_model_fields.json", "utf8"),
);

// Curated metadata dictionary for common fields and model-specific fields
const modelConfig = {
  FinanceExpense: {
    table: "expenses",
    ui: "/finance/expenses (CreateExpenseDialog, ExpenseDetail)",
    api: "POST/GET/PATCH/DELETE /finance/expenses",
    accounting:
      "Debit to Nominal Expense Account (5xxx); Credit to Cash/Bank or Payables",
    gst: "Input Tax Credit ledger posting & GSTR-2B compliance",
  },
  FinanceAccount: {
    table: "accounts",
    ui: "/finance/accounts (Chart of Accounts Tree View)",
    api: "POST/GET/PATCH/DELETE /finance/accounts",
    accounting:
      "Core Chart of Accounts hierarchy; determines Balance Sheet vs P&L classification",
    gst: "Stores specific tax accounts: 1300 (Input Tax Credit) and 2200 (Output Tax Payable)",
  },
  FinanceJournalEntry: {
    table: "journal_entries",
    ui: "/finance/journal-entries (Journal Entry Voucher List & Creator)",
    api: "POST/GET/PATCH/DELETE /finance/journal-entries",
    accounting:
      "Authoritative transaction header; enforces balanced debit/credit sums",
    gst: "Audit trail for tax liabilities and credit transfers",
  },
  FinanceJournalLine: {
    table: "journal_lines",
    ui: "/finance/journal-entries (Voucher Line Grid)",
    api: "Nested in /finance/journal-entries",
    accounting:
      "Atomic debit or credit entry on a specific GL account; running balance updates",
    gst: "Contains tax reference ID and GSTIN for tax journal entries",
  },
  FinanceBankAccount: {
    table: "bank_accounts",
    ui: "/finance/banking (Bank Accounts Overview & Card Grid)",
    api: "POST/GET/PATCH/DELETE /finance/bank-accounts",
    accounting: "Current asset cash & bank balances (Asset Account 1010/1020)",
    gst: "Non-GST asset account tracking",
  },
  FinanceBankTransaction: {
    table: "bank_transactions",
    ui: "/finance/banking (Bank Statements & Reconciliation Grid)",
    api: "POST/GET/PATCH/DELETE /finance/bank-transactions",
    accounting:
      "Individual bank ledger movement (Deposit, Withdrawal, Bank Charges)",
    gst: "Bank charges may carry GST credit (GSTR-2B)",
  },
  FinancePaymentReceived: {
    table: "payments_received",
    ui: "/finance/payments-received (Customer Payment Receipts)",
    api: "POST/GET/PATCH/DELETE /finance/payments-received",
    accounting:
      "Debit Bank/Cash; Credit Accounts Receivable (1200) or Customer Advance (2110)",
    gst: "Advances on services/interstate supplies trigger GST Advance Receipt vouchers",
  },
  FinancePaymentReceivedAllocation: {
    table: "payment_received_allocations",
    ui: "/finance/payments-received (Invoice Allocation Sub-table)",
    api: "Nested in /finance/payments-received",
    accounting:
      "Sub-ledger settlement clearing specific customer sales invoice balances",
    gst: "Links customer payment settlement to original sales invoice GSTR-1 reference",
  },
  FinancePaymentMade: {
    table: "payments_made",
    ui: "/finance/payments-made (Vendor Disbursements Grid)",
    api: "POST/GET/PATCH/DELETE /finance/payments-made",
    accounting: "Debit Accounts Payable (2000); Credit Bank/Cash (1010)",
    gst: "Clears vendor liability; links to GSTR-2B inward supply settlement",
  },
  FinanceGstEntry: {
    table: "gst_entries",
    ui: "/finance/gst (GST Ledger, GSTR-1, GSTR-2B, GSTR-3B Tabs)",
    api: "POST/GET /finance/gst/entries, /finance/gst/reports/*",
    accounting:
      "Sub-ledger tracking of tax liabilities (2200) and input tax assets (1300)",
    gst: "Official tax register for CBIC statutory returns (GSTR-1 outward, GSTR-2B inward, GSTR-3B monthly)",
  },
  FinanceMasterListItem: {
    table: "FinanceMasterListItem",
    ui: "/finance/settings (Finance Settings & Category Pickers)",
    api: "GET/POST /finance/settings/master-list-items",
    accounting:
      "Classification dimensions for expense types, payment modes, and cost centers",
    gst: "Tags tax rates and default HSN/SAC codes for categories",
  },
};

const gstMigrationFields = [
  "vendorGstin",
  "vendorInvoiceNumber",
  "vendorInvoiceDate",
  "hsnSacCode",
  "taxRate",
  "cgstAmount",
  "sgstAmount",
  "igstAmount",
  "isItcEligible",
  "ineligibilityReason",
  "gstJurisdiction",
];

function inferFieldInfo(model, field, fInfo, modelMeta) {
  const name = field.name;
  const type = field.type;
  const rest = field.rest || "";

  // Determine DB Type
  let dbType = "VARCHAR(255)";
  if (type === "Int") dbType = "INTEGER";
  else if (type === "Decimal") dbType = "NUMERIC(15,2)";
  else if (type === "DateTime") dbType = "TIMESTAMP WITH TIME ZONE";
  else if (type === "Boolean") dbType = "BOOLEAN";
  else if (type === "Json") dbType = "JSONB";
  else if (
    type === "String" &&
    (name.includes("description") ||
      name.includes("notes") ||
      name.includes("reason"))
  )
    dbType = "TEXT";

  // Required/Optional
  const reqOpt = field.isOptional ? "Optional" : "Required";

  // Default Value
  const defMatch = rest.match(/@default\(([^)]+)\)/);
  const defaultVal = defMatch ? defMatch[1] : "None";

  // Primary Key
  const pk = rest.includes("@id") ? "PK" : "None";

  // Foreign Key
  let fk = "None";
  if (name === "organizationId") fk = "platform.Organization(id)";
  else if (name === "expenseTypeId") fk = "finance.FinanceMasterListItem(id)";
  else if (name === "accountId") fk = "finance.FinanceAccount(id)";
  else if (name === "bankAccountId") fk = "finance.FinanceBankAccount(id)";
  else if (name === "journalEntryId") fk = "finance.FinanceJournalEntry(id)";
  else if (name === "claimId") fk = "hr.ExpenseClaim(id)";
  else if (name === "paymentReceivedId")
    fk = "finance.FinancePaymentReceived(id)";
  else if (name === "paymentMadeId") fk = "finance.FinancePaymentMade(id)";
  else if (name === "sourceId") fk = "Dynamic Entity based on sourceType";
  else if (name === "parentAccountId") fk = "finance.FinanceAccount(id)";

  // Unique
  let unique = "None";
  if (rest.includes("@unique")) unique = "Unique Constraint";
  else {
    const uAttr = modelMeta.modelAttrs.find(
      (a) => a.startsWith("@@unique(") && a.includes(name),
    );
    if (uAttr) unique = uAttr.replace("@@unique(", "").replace(")", "");
  }

  // Indexes
  let indexes = "None";
  const idxAttrs = modelMeta.modelAttrs.filter(
    (a) => a.startsWith("@@index(") && a.includes(name),
  );
  if (idxAttrs.length > 0) {
    indexes = idxAttrs
      .map((a) => a.replace("@@index(", "").replace(")", ""))
      .join("; ");
  }

  // Scope
  const scope = modelMeta.fields.some((f) => f.name === "organizationId")
    ? "Yes"
    : "No";

  // Migration
  let migration = "20261022174500_add_finance_core_module";
  if (model === "FinanceExpense" && gstMigrationFields.includes(name)) {
    migration = "20261026160000_add_expense_gst_and_itc_fields";
  }

  // Purpose
  let purpose = `Stores ${name} for ${model}`;
  if (name === "id") purpose = `Primary internal surrogate ID for ${model}`;
  else if (name === "organizationId")
    purpose = "Multi-tenant organization isolation scope";
  else if (name === "createdAt") purpose = "Timestamp when record was created";
  else if (name === "updatedAt")
    purpose = "Timestamp when record was last updated";
  else if (name === "deletedAt")
    purpose = "Soft-delete timestamp; null indicates active record";
  else if (name === "status") purpose = "Lifecycle transition state indicator";
  else if (name.endsWith("Number"))
    purpose = `Official human-readable sequential identifier for ${model}`;
  else if (name.endsWith("Amount"))
    purpose = `Monetary value in organization currency (scale 2)`;
  else if (name.endsWith("Date"))
    purpose = `Transaction or accounting posting date`;
  else if (name.includes("Gstin"))
    purpose = "15-character statutory GST identification number";
  else if (name.includes("Itc"))
    purpose = "Input Tax Credit eligibility indicator under GST rules";
  else if (name.includes("Rate"))
    purpose = "Statutory GST tax rate percentage (0, 5, 12, 18, 28%)";

  const cfg = modelConfig[model] || {};

  return {
    model,
    schema: "finance",
    table: cfg.table || model,
    field: name,
    prismaType: type,
    dbType,
    reqOpt,
    defaultVal,
    pk,
    fk,
    unique,
    indexes,
    scope,
    purpose,
    api: cfg.api || "N/A",
    ui: cfg.ui || "N/A",
    accounting: cfg.accounting || "General ledger movement",
    gst: cfg.gst || "Non-GST dimension",
    migration,
    sourceFile: "packages/database/prisma/schema.prisma",
  };
}

const allFieldRecords = [];
for (const [m, info] of Object.entries(data)) {
  const scalars = info.fields.filter((f) => !f.isRelation);
  scalars.forEach((f) => {
    allFieldRecords.push(inferFieldInfo(m, f, f, info));
  });
}

console.log("Generated records:", allFieldRecords.length);
fs.writeFileSync(
  "scratch/generated_all_db_records.json",
  JSON.stringify(allFieldRecords, null, 2),
);
