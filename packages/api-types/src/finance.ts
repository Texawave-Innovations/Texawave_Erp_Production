// HANDWRITTEN — mirrors apps/api/src/modules/finance/. See
// packages/api-types/README.md. Nothing generates these yet
// (Docs/ARCHITECTURE.md §2) — update by hand if the backend DTOs change.

export const FINANCE_ACCOUNT_TYPES = [
  "ASSET",
  "LIABILITY",
  "EQUITY",
  "REVENUE",
  "EXPENSE",
] as const;
export type FinanceAccountType = (typeof FINANCE_ACCOUNT_TYPES)[number];

export const FINANCE_JOURNAL_ENTRY_TYPES = [
  "MANUAL",
  "EXPENSE",
  "PAYMENT_RECEIVED",
  "PAYMENT_MADE",
  "BANK_TRANSFER",
  "OPENING_BALANCE",
  "REVERSAL",
] as const;
export type FinanceJournalEntryType =
  (typeof FINANCE_JOURNAL_ENTRY_TYPES)[number];

export const FINANCE_JOURNAL_ENTRY_STATUSES = [
  "DRAFT",
  "POSTED",
  "REVERSED",
  "VOID",
] as const;
export type FinanceJournalEntryStatus =
  (typeof FINANCE_JOURNAL_ENTRY_STATUSES)[number];

export interface FinanceAccount {
  id: number;
  organizationId: number;
  accountCode: string;
  accountName: string;
  accountType: FinanceAccountType;
  parentAccountId: number | null;
  currency: string;
  currentBalance: string | number;
  isActive: boolean;
  isReconciled: boolean;
  description: string | null;
  createdBy: number | null;
  updatedBy: number | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  parentAccount?: FinanceAccount | null;
  subAccounts?: FinanceAccount[];
}

export interface FinanceAccountTreeNode extends FinanceAccount {
  children: FinanceAccountTreeNode[];
}

export interface CreateFinanceAccountInput {
  accountCode: string;
  accountName: string;
  accountType: FinanceAccountType;
  parentAccountId?: number | null | undefined;
  currency?: string | undefined;
  description?: string | null | undefined;
}

export interface UpdateFinanceAccountInput {
  accountCode?: string | undefined;
  accountName?: string | undefined;
  parentAccountId?: number | null | undefined;
  currency?: string | undefined;
  description?: string | null | undefined;
  isActive?: boolean | undefined;
}

export interface QueryFinanceAccountsInput {
  page?: number | undefined;
  limit?: number | undefined;
  accountType?: FinanceAccountType | undefined;
  isActive?: boolean | undefined;
  search?: string | undefined;
}

export interface FinanceJournalLine {
  id: number;
  organizationId: number;
  journalEntryId: number;
  accountId: number;
  lineOrder: number;
  description: string | null;
  debit: string | number;
  credit: string | number;
  createdAt: string;
  updatedAt: string;
  account?: {
    id: number;
    accountCode: string;
    accountName: string;
    accountType: FinanceAccountType;
  };
}

export interface FinanceJournalEntry {
  id: number;
  organizationId: number;
  entryNumber: string;
  entryDate: string;
  entryType: FinanceJournalEntryType;
  narration: string;
  referenceNumber: string | null;
  totalDebit: string | number;
  totalCredit: string | number;
  status: FinanceJournalEntryStatus;
  postedAt: string | null;
  postedBy: number | null;
  reversedEntryId: number | null;
  createdBy: number | null;
  updatedBy: number | null;
  createdAt: string;
  updatedAt: string;
  lines?: FinanceJournalLine[];
  reversedEntry?: FinanceJournalEntry | null;
  reversalOf?: FinanceJournalEntry | null;
}

export interface CreateFinanceJournalLineInput {
  accountId: number;
  debit?: number | undefined;
  credit?: number | undefined;
  description?: string | null | undefined;
}

export interface CreateFinanceJournalEntryInput {
  entryNumber?: string | undefined;
  entryDate: string;
  entryType?: FinanceJournalEntryType | undefined;
  narration: string;
  referenceNumber?: string | null | undefined;
  lines: CreateFinanceJournalLineInput[];
}

export interface UpdateFinanceJournalEntryInput {
  entryDate?: string | undefined;
  narration?: string | undefined;
  referenceNumber?: string | null | undefined;
  lines?: CreateFinanceJournalLineInput[] | undefined;
}

export interface QueryFinanceJournalEntriesInput {
  page?: number | undefined;
  limit?: number | undefined;
  entryType?: FinanceJournalEntryType | undefined;
  status?: FinanceJournalEntryStatus | undefined;
  startDate?: string | undefined;
  endDate?: string | undefined;
  search?: string | undefined;
}

export interface ReverseJournalEntryInput {
  reversalDate?: string | undefined;
  reason?: string | undefined;
}

export const FINANCE_EXPENSE_STATUSES = [
  "DRAFT",
  "PENDING_APPROVAL",
  "APPROVED",
  "PAID",
  "CANCELLED",
] as const;
export type FinanceExpenseStatus = (typeof FINANCE_EXPENSE_STATUSES)[number];

export interface FinanceExpense {
  id: number;
  organizationId: number;
  expenseNumber: string;
  expenseTypeId: number;
  expenseDate: string;
  amount: string | number;
  taxAmount: string | number;
  netAmount: string | number;
  paymentModeId: number | null;
  bankAccountId: number | null;
  vendorName: string | null;
  notes: string | null;
  receiptUrl: string | null;
  status: FinanceExpenseStatus;
  glAccountId: number | null;
  journalEntryId: number | null;
  hrExpenseClaimId: number | null;
  vendorGstin?: string | null;
  vendorInvoiceNumber?: string | null;
  vendorInvoiceDate?: string | null;
  hsnSacCode?: string | null;
  taxRate?: string | number | null;
  cgstAmount?: string | number;
  sgstAmount?: string | number;
  igstAmount?: string | number;
  isItcEligible?: boolean;
  ineligibilityReason?: string | null;
  gstJurisdiction?: string | null;
  createdBy: number | null;
  updatedBy: number | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  expenseType?: {
    id: number;
    value: string;
  };
  paymentMode?: {
    id: number;
    value: string;
  } | null;
  bankAccount?: {
    id: number;
    accountName: string;
    accountNumber: string;
    bankName: string;
  } | null;
  glAccount?: {
    id: number;
    accountCode: string;
    accountName: string;
    accountType: FinanceAccountType;
  } | null;
  journalEntry?: {
    id: number;
    entryNumber: string;
    entryDate: string;
    status: FinanceJournalEntryStatus;
  } | null;
}

export interface CreateFinanceExpenseInput {
  expenseNumber?: string;
  expenseTypeId: number;
  expenseDate: string;
  amount: number;
  taxAmount?: number;
  paymentModeId?: number | null;
  bankAccountId?: number | null;
  glAccountId?: number | null;
  vendorName?: string | null;
  vendorGstin?: string | null;
  vendorInvoiceNumber?: string | null;
  vendorInvoiceDate?: string | null;
  hsnSacCode?: string | null;
  taxRate?: number | null;
  cgstAmount?: number;
  sgstAmount?: number;
  igstAmount?: number;
  isItcEligible?: boolean;
  ineligibilityReason?: string | null;
  gstJurisdiction?: string | null;
  notes?: string | null;
  receiptUrl?: string | null;
  status?: FinanceExpenseStatus;
}

export interface UpdateFinanceExpenseInput {
  expenseTypeId?: number;
  expenseDate?: string;
  amount?: number;
  taxAmount?: number;
  paymentModeId?: number | null;
  bankAccountId?: number | null;
  glAccountId?: number | null;
  vendorName?: string | null;
  vendorGstin?: string | null;
  vendorInvoiceNumber?: string | null;
  vendorInvoiceDate?: string | null;
  hsnSacCode?: string | null;
  taxRate?: number | null;
  cgstAmount?: number;
  sgstAmount?: number;
  igstAmount?: number;
  isItcEligible?: boolean;
  ineligibilityReason?: string | null;
  gstJurisdiction?: string | null;
  notes?: string | null;
  receiptUrl?: string | null;
}

export interface QueryFinanceExpensesInput {
  page?: number;
  limit?: number;
  expenseTypeId?: number;
  paymentModeId?: number;
  status?: FinanceExpenseStatus;
  startDate?: string;
  endDate?: string;
  search?: string;
}

export interface RecordExpensePaymentInput {
  paymentModeId?: number | null;
  bankAccountId?: number | null;
  paymentDate?: string;
  notes?: string;
}

export interface CreateExpenseFromClaimInput {
  glAccountId?: number | null;
  paymentModeId?: number | null;
  bankAccountId?: number | null;
  notes?: string | null;
}

export const FINANCE_PAYMENT_RECEIVED_STATUSES = [
  "DRAFT",
  "CONFIRMED",
  "RECONCILED",
  "VOID",
] as const;
export type FinancePaymentReceivedStatus =
  (typeof FINANCE_PAYMENT_RECEIVED_STATUSES)[number];

export interface FinancePaymentReceivedAllocation {
  id: number;
  organizationId: number;
  paymentReceivedId: number;
  invoiceReference: string;
  allocatedAmount: string | number;
  allocationDate: string;
  notes: string | null;
  createdBy: number | null;
  createdAt: string;
}

export interface FinancePaymentReceived {
  id: number;
  organizationId: number;
  paymentNumber: string;
  paymentDate: string;
  customerId: number | null;
  customerName: string;
  amount: string | number;
  allocatedAmount: string | number;
  unallocatedAmount: string | number;
  paymentModeId: number;
  bankAccountId: number | null;
  referenceNumber: string | null;
  invoiceReference: string | null;
  notes: string | null;
  status: FinancePaymentReceivedStatus;
  journalEntryId: number | null;
  createdBy: number | null;
  updatedBy: number | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  customer?: {
    id: number;
    name: string;
  } | null;
  paymentMode?: {
    id: number;
    value: string;
  };
  bankAccount?: {
    id: number;
    accountName: string;
    accountNumber: string;
    bankName: string;
  } | null;
  journalEntry?: {
    id: number;
    entryNumber: string;
    entryDate: string;
    status: FinanceJournalEntryStatus;
  } | null;
  allocations?: FinancePaymentReceivedAllocation[];
}

export interface CreatePaymentAllocationInput {
  invoiceReference: string;
  allocatedAmount: number;
  notes?: string | null;
}

export interface CreateFinancePaymentReceivedInput {
  paymentNumber?: string;
  paymentDate: string;
  customerId?: number | null;
  customerName: string;
  amount: number;
  paymentModeId: number;
  bankAccountId?: number | null;
  referenceNumber?: string | null;
  invoiceReference?: string | null;
  notes?: string | null;
  status?: FinancePaymentReceivedStatus;
  allocations?: CreatePaymentAllocationInput[];
}

export interface UpdateFinancePaymentReceivedInput {
  paymentDate?: string;
  customerId?: number | null;
  customerName?: string;
  referenceNumber?: string | null;
  invoiceReference?: string | null;
  notes?: string | null;
}

export interface QueryFinancePaymentsReceivedInput {
  page?: number;
  limit?: number;
  customerId?: number;
  paymentModeId?: number;
  bankAccountId?: number;
  status?: FinancePaymentReceivedStatus;
  startDate?: string;
  endDate?: string;
  search?: string;
}

// ---- Milestone 5: Banking & Payments Made Types --------------------------

export const FINANCE_BANK_ACCOUNT_TYPES = [
  "CURRENT",
  "SAVINGS",
  "OVERDRAFT",
] as const;
export type FinanceBankAccountType =
  (typeof FINANCE_BANK_ACCOUNT_TYPES)[number];

export const FINANCE_BANK_TRANSACTION_TYPES = ["CREDIT", "DEBIT"] as const;
export type FinanceBankTransactionType =
  (typeof FINANCE_BANK_TRANSACTION_TYPES)[number];

export const FINANCE_PAYMENT_MADE_STATUSES = [
  "DRAFT",
  "CONFIRMED",
  "RECONCILED",
  "VOID",
] as const;
export type FinancePaymentMadeStatus =
  (typeof FINANCE_PAYMENT_MADE_STATUSES)[number];

export interface FinanceBankAccount {
  id: number;
  organizationId: number;
  accountName: string;
  accountNumber: string;
  bankName: string;
  ifscCode: string;
  branchName: string | null;
  accountType: FinanceBankAccountType;
  currency: string;
  openingBalance: string | number;
  currentBalance: string | number;
  glAccountId: number | null;
  isActive: boolean;
  createdBy: number | null;
  updatedBy: number | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  glAccount?: {
    id: number;
    accountCode: string;
    accountName: string;
    accountType: FinanceAccountType;
  } | null;
}

export interface CreateFinanceBankAccountInput {
  accountName: string;
  accountNumber: string;
  bankName: string;
  ifscCode: string;
  branchName?: string | null;
  accountType?: FinanceBankAccountType;
  currency?: string;
  openingBalance?: number;
  glAccountId?: number | null;
  isActive?: boolean;
}

export interface UpdateFinanceBankAccountInput {
  accountName?: string;
  bankName?: string;
  ifscCode?: string;
  branchName?: string | null;
  accountType?: FinanceBankAccountType;
  glAccountId?: number | null;
  isActive?: boolean;
}

export interface QueryFinanceBankAccountsInput {
  page?: number;
  limit?: number;
  accountType?: FinanceBankAccountType;
  isActive?: boolean;
  search?: string;
}

export interface FinanceBankTransaction {
  id: number;
  organizationId: number;
  bankAccountId: number;
  transactionDate: string;
  referenceNumber: string | null;
  description: string;
  transactionType: FinanceBankTransactionType;
  amount: string | number;
  balanceAfter: string | number | null;
  isReconciled: boolean;
  reconciledAt: string | null;
  matchedJournalEntryId: number | null;
  createdBy: number | null;
  createdAt: string;
  updatedAt: string;
  bankAccount?: {
    id: number;
    accountName: string;
    accountNumber: string;
  };
  matchedEntry?: {
    id: number;
    entryNumber: string;
    status: FinanceJournalEntryStatus;
  } | null;
}

export interface CreateFinanceBankTransactionInput {
  bankAccountId: number;
  transactionDate: string;
  transactionType: FinanceBankTransactionType;
  amount: number;
  description: string;
  referenceNumber?: string | null;
  counterGlAccountId?: number | null;
}

export interface QueryFinanceBankTransactionsInput {
  page?: number;
  limit?: number;
  bankAccountId?: number;
  transactionType?: FinanceBankTransactionType;
  isReconciled?: boolean;
  startDate?: string;
  endDate?: string;
  search?: string;
}

export interface ReconcileBankTransactionInput {
  matchedJournalEntryId?: number | null;
}

export interface FinancePaymentMade {
  id: number;
  organizationId: number;
  paymentNumber: string;
  paymentDate: string;
  vendorName: string;
  supplierId: number | null;
  billId: number | null;
  amount: string | number;
  paymentModeId: number;
  bankAccountId: number | null;
  referenceNumber: string | null;
  billReference: string | null;
  scmSupplierPaymentId: number | null;
  notes: string | null;
  status: FinancePaymentMadeStatus;
  journalEntryId: number | null;
  createdBy: number | null;
  updatedBy: number | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  paymentMode?: {
    id: number;
    value: string;
  };
  bankAccount?: {
    id: number;
    accountName: string;
    accountNumber: string;
  } | null;
  journalEntry?: {
    id: number;
    entryNumber: string;
    entryDate: string;
    status: FinanceJournalEntryStatus;
  } | null;
}

export interface CreateFinancePaymentMadeInput {
  paymentNumber?: string;
  paymentDate: string;
  vendorName: string;
  supplierId?: number;
  billId?: number;
  amount: number;
  paymentModeId: number;
  bankAccountId?: number | null;
  referenceNumber?: string | null;
  billReference?: string | null;
  scmSupplierPaymentId?: number | null;
  notes?: string | null;
  status?: FinancePaymentMadeStatus;
}

export interface UpdateFinancePaymentMadeInput {
  paymentDate?: string;
  vendorName?: string;
  referenceNumber?: string | null;
  billReference?: string | null;
  notes?: string | null;
}

export interface QueryFinancePaymentsMadeInput {
  page?: number;
  limit?: number;
  paymentModeId?: number;
  bankAccountId?: number;
  status?: FinancePaymentMadeStatus;
  startDate?: string;
  endDate?: string;
  search?: string;
}

// ---------------------------------------------------------------------------
// Reports & Period Closing
// ---------------------------------------------------------------------------

export interface FinancialReportAccountItem {
  accountId: number;
  accountCode: string;
  accountName: string;
  amount: number;
}

export interface FinanceProfitAndLossReport {
  period: {
    startDate: string;
    endDate: string;
  };
  revenue: {
    accounts: FinancialReportAccountItem[];
    total: number;
  };
  expenses: {
    accounts: FinancialReportAccountItem[];
    total: number;
  };
  netIncome: number;
  isProfitable: boolean;
  currency: string;
  generatedAt: string;
}

export interface FinanceBalanceSheetReport {
  asOfDate: string;
  assets: {
    accounts: FinancialReportAccountItem[];
    total: number;
  };
  liabilities: {
    accounts: FinancialReportAccountItem[];
    total: number;
  };
  equity: {
    accounts: FinancialReportAccountItem[];
    retainedEarnings: number;
    total: number;
  };
  isBalanced: boolean;
  difference: number;
  currency: string;
  generatedAt: string;
}

export interface TrialBalanceItem {
  accountId: number;
  accountCode: string;
  accountName: string;
  accountType: FinanceAccountType;
  normalBalance: "DEBIT" | "CREDIT";
  openingDebit: number;
  openingCredit: number;
  periodDebit: number;
  periodCredit: number;
  closingDebit: number;
  closingCredit: number;
}

export interface FinanceTrialBalanceReport {
  asOfDate: string;
  period?: {
    startDate?: string;
    endDate?: string;
  };
  accounts: TrialBalanceItem[];
  totalDebit: number;
  totalCredit: number;
  isBalanced: boolean;
  difference: number;
  currency: string;
  generatedAt: string;
}

export interface GeneralLedgerTransactionItem {
  id: number;
  journalEntryId: number;
  entryNumber: string;
  entryDate: string;
  entryType: string;
  referenceNumber: string | null;
  narration: string;
  description: string | null;
  debit: number;
  credit: number;
  runningBalance: number;
}

export interface GeneralLedgerAccountReport {
  account: {
    id: number;
    accountCode: string;
    accountName: string;
    accountType: FinanceAccountType;
    normalBalance: "DEBIT" | "CREDIT";
  };
  period: {
    startDate: string;
    endDate: string;
  };
  openingBalance: number;
  transactions: GeneralLedgerTransactionItem[];
  totalDebit: number;
  totalCredit: number;
  closingBalance: number;
  totalTransactions: number;
  page?: number | undefined;
  limit?: number | undefined;
}

export interface QueryBalanceSheetInput {
  asOfDate?: string | undefined;
}

export interface QueryProfitAndLossInput {
  startDate?: string | undefined;
  endDate?: string | undefined;
}

export interface QueryTrialBalanceInput {
  asOfDate?: string | undefined;
  startDate?: string | undefined;
  endDate?: string | undefined;
}

export interface QueryGeneralLedgerInput {
  page?: number | undefined;
  limit?: number | undefined;
  accountId?: number | undefined;
  accountCode?: string | undefined;
  startDate?: string | undefined;
  endDate?: string | undefined;
}

export interface CashBankAccountSummaryItem {
  id: number;
  name: string;
  type: "CASH" | "BANK";
  accountNumber?: string;
  bankName?: string;
  openingBalance: number;
  totalInflows: number;
  totalOutflows: number;
  closingBalance: number;
}

export interface FinanceCashBankSummaryReport {
  period: {
    startDate: string;
    endDate: string;
  };
  accounts: CashBankAccountSummaryItem[];
  totalOpeningBalance: number;
  totalInflows: number;
  totalOutflows: number;
  totalClosingBalance: number;
  currency: string;
  generatedAt: string;
}

export interface FinancePeriodClosingStatus {
  period: string;
  startDate: string;
  endDate: string;
  draftEntriesCount: number;
  postedEntriesCount: number;
  totalDebit: number;
  totalCredit: number;
  isBalanced: boolean;
  unreconciledBankTransactionsCount: number;
  revenueTotal: number;
  expenseTotal: number;
  netIncome: number;
  canClose: boolean;
  validationMessages: string[];
}

// ---------------------------------------------------------------------------
// GST Reporting & Reconciliation
// ---------------------------------------------------------------------------

export const FINANCE_GST_ENTRY_TYPES = [
  "OUTPUT_GST",
  "INPUT_TAX_CREDIT",
] as const;
export type FinanceGstEntryType = (typeof FINANCE_GST_ENTRY_TYPES)[number];

export const FINANCE_GST_SOURCE_TYPES = [
  "SALES_INVOICE",
  "PURCHASE_BILL",
  "EXPENSE",
  "MANUAL",
] as const;
export type FinanceGstSourceType = (typeof FINANCE_GST_SOURCE_TYPES)[number];

export const FINANCE_GST_STATUSES = [
  "ACTIVE",
  "FILED",
  "RECONCILED",
  "CANCELLED",
] as const;
export type FinanceGstStatus = (typeof FINANCE_GST_STATUSES)[number];

export interface FinanceGstEntry {
  id: number;
  organizationId: number;
  gstin: string;
  period: string;
  entryType: FinanceGstEntryType;
  sourceType: FinanceGstSourceType;
  sourceId: number | null;
  sourceReference: string;
  hsnSacCode: string | null;
  taxableAmount: number;
  cgstRate: number;
  cgstAmount: number;
  sgstRate: number;
  sgstAmount: number;
  igstRate: number;
  igstAmount: number;
  totalTaxAmount: number;
  isProformaExcluded: boolean;
  status: FinanceGstStatus;
  createdBy: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateFinanceGstEntryInput {
  gstin: string;
  period: string;
  entryType: FinanceGstEntryType;
  sourceType: FinanceGstSourceType;
  sourceId?: number | null;
  sourceReference: string;
  hsnSacCode?: string | null;
  taxableAmount: number;
  cgstRate?: number;
  cgstAmount?: number;
  sgstRate?: number;
  sgstAmount?: number;
  igstRate?: number;
  igstAmount?: number;
  totalTaxAmount?: number;
  isProformaExcluded?: boolean;
}

export interface QueryFinanceGstEntriesInput {
  page?: number;
  limit?: number;
  period?: string;
  entryType?: FinanceGstEntryType;
  sourceType?: FinanceGstSourceType;
  status?: FinanceGstStatus;
  hsnSacCode?: string;
  gstin?: string;
  search?: string;
}

export interface HsnSummaryItem {
  hsnSacCode: string;
  description?: string;
  taxableAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  totalTaxAmount: number;
  transactionCount: number;
}

export interface FinanceHsnSummaryReport {
  period?: string;
  startDate?: string;
  endDate?: string;
  entryType?: FinanceGstEntryType;
  items: HsnSummaryItem[];
  totalTaxableAmount: number;
  totalCgstAmount: number;
  totalSgstAmount: number;
  totalIgstAmount: number;
  totalTaxAmount: number;
  totalRecords: number;
  generatedAt: string;
}

export interface Gstr1RateBucket {
  rate: number;
  taxableAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  totalTaxAmount: number;
}

export interface FinanceGstr1SummaryReport {
  period: string;
  b2b: {
    taxableAmount: number;
    cgstAmount: number;
    sgstAmount: number;
    igstAmount: number;
    totalTaxAmount: number;
    invoiceCount: number;
  };
  b2c: {
    taxableAmount: number;
    cgstAmount: number;
    sgstAmount: number;
    igstAmount: number;
    totalTaxAmount: number;
    invoiceCount: number;
  };
  rateBuckets: Gstr1RateBucket[];
  totalTaxableAmount: number;
  totalCgstAmount: number;
  totalSgstAmount: number;
  totalIgstAmount: number;
  totalTaxAmount: number;
  totalInvoices: number;
  proformaExcludedCount: number;
  generatedAt: string;
}

export interface FinanceGstr3bSummaryReport {
  period: string;
  outwardTaxableSupplies: {
    taxableAmount: number;
    cgstAmount: number;
    sgstAmount: number;
    igstAmount: number;
    totalTaxAmount: number;
  };
  eligibleItc: {
    taxableAmount: number;
    cgstAmount: number;
    sgstAmount: number;
    igstAmount: number;
    totalTaxAmount: number;
  };
  netTaxPayable: {
    cgstAmount: number;
    sgstAmount: number;
    igstAmount: number;
    totalTaxAmount: number;
  };
  generatedAt: string;
}

export interface CounterpartGstEntryInput {
  gstin: string;
  invoiceNumber: string;
  invoiceDate?: string;
  taxableAmount: number;
  cgstAmount?: number;
  sgstAmount?: number;
  igstAmount?: number;
  totalTaxAmount: number;
}

export type GstReconciliationMatchStatus =
  "MATCHED" | "TAX_MISMATCH" | "MISSING_IN_PORTAL" | "MISSING_IN_BOOKS";

export interface GstReconciliationDiscrepancyItem {
  status: GstReconciliationMatchStatus;
  invoiceReference: string;
  gstin: string;
  booksTaxableAmount: number | null;
  booksTaxAmount: number | null;
  portalTaxableAmount: number | null;
  portalTaxAmount: number | null;
  taxDifference: number;
  notes: string;
}

export interface FinanceGstReconciliationResult {
  period: string;
  totalBooksRecords: number;
  totalPortalRecords: number;
  matchedCount: number;
  taxMismatchCount: number;
  missingInPortalCount: number;
  missingInBooksCount: number;
  totalBooksItc: number;
  totalPortalItc: number;
  eligibleItc: number;
  discrepancies: GstReconciliationDiscrepancyItem[];
  reconciledEntriesUpdated: number;
  generatedAt: string;
}

// ---------------------------------------------------------------------------
// Sales & Purchases Accounting Integration
// ---------------------------------------------------------------------------

export interface PostSalesInvoiceInput {
  invoiceNumber: string;
  invoiceDate: string;
  customerId?: number | null;
  customerName: string;
  customerGstin?: string | null;
  subtotal: number;
  taxAmount: number;
  total: number;
  currency?: string;
  hsnSacCode?: string | null;
  cgstAmount?: number;
  sgstAmount?: number;
  igstAmount?: number;
  notes?: string | null;
  salesOrderId?: number | null;
}

export interface PostPurchaseBillInput {
  billNumber: string;
  supplierBillNumber?: string | null;
  billDate: string;
  supplierId?: number | null;
  supplierName: string;
  supplierGstin?: string | null;
  subtotal: number;
  taxAmount: number;
  total: number;
  currency?: string;
  hsnSacCode?: string | null;
  cgstAmount?: number;
  sgstAmount?: number;
  igstAmount?: number;
  notes?: string | null;
  purchaseOrderId?: number | null;
}

export interface CancelIntegrationDocumentInput {
  documentReference: string;
  reason: string;
  cancellationDate?: string;
}

export interface SalesPurchasesPostingResult {
  success: boolean;
  alreadyPosted?: boolean;
  alreadyCancelled?: boolean;
  documentReference: string;
  journalEntryId: number | null;
  journalEntryNumber: string | null;
  gstEntryId: number | null;
  reversalJournalEntryId?: number | null;
  message: string;
}
