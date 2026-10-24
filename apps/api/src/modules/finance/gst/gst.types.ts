import type { FinanceGstEntryType } from "../finance.constants.js";

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
