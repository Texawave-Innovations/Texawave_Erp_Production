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

export const FINANCE_EXPENSE_STATUSES = [
  "DRAFT",
  "PENDING_APPROVAL",
  "APPROVED",
  "PAID",
  "CANCELLED",
] as const;

export type FinanceExpenseStatus = (typeof FINANCE_EXPENSE_STATUSES)[number];

export const FINANCE_PAYMENT_RECEIVED_STATUSES = [
  "DRAFT",
  "CONFIRMED",
  "RECONCILED",
  "VOID",
] as const;

export type FinancePaymentReceivedStatus =
  (typeof FINANCE_PAYMENT_RECEIVED_STATUSES)[number];

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

/**
 * Classifies a Finance Master List payment-mode value as cash vs. bank-type,
 * using the same "contains cash" convention already used to pick the GL
 * disbursement account (see PaymentsMadeService.resolveGlDisbursementAccount).
 * Bank-type modes (Bank Transfer, Cheque, UPI, Credit Card, ...) settle
 * through a real bank account and must have one selected; cash does not.
 */
export function isCashPaymentMode(
  paymentModeValue: string | undefined | null,
): boolean {
  return Boolean(paymentModeValue?.toLowerCase().includes("cash"));
}

/**
 * Calculates the balance impact on an account given its classification.
 * - ASSET & EXPENSE: Debit increases balance, Credit decreases balance.
 * - LIABILITY, EQUITY & REVENUE: Credit increases balance, Debit decreases balance.
 */
export function calculateAccountBalanceDelta(
  accountType: FinanceAccountType | string,
  debit: number,
  credit: number,
): number {
  switch (accountType) {
    case "ASSET":
    case "EXPENSE":
      return debit - credit;
    case "LIABILITY":
    case "EQUITY":
    case "REVENUE":
      return credit - debit;
    default:
      return debit - credit;
  }
}
