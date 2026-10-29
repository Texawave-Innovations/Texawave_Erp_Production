import type { FinanceAccountType } from "../finance.constants.js";

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
