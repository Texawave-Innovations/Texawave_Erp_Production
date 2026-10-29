import type { OrgScope } from "../../../../common/tenancy/org-scope.js";

/**
 * Filter criteria for querying tax transactions from Sales or Purchases modules.
 */
export interface TaxTransactionQuery {
  period?: string; // YYYY-MM
  startDate?: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD
  status?: string;
  customerGstin?: string;
  supplierGstin?: string;
  search?: string;
  limit?: number;
  skip?: number;
}

/**
 * Normalized line item tax breakdown for sales documents.
 */
export interface SalesTaxLine {
  lineOrder: number;
  productId?: number | null;
  productName?: string | null;
  description: string;
  hsnSacCode?: string | null;
  quantity?: number | null;
  uom?: string | null;
  unitPrice: number;
  taxableAmount: number;
  taxRate: number; // Combined rate e.g. 18.0
  cgstRate?: number;
  cgstAmount: number;
  sgstRate?: number;
  sgstAmount: number;
  igstRate?: number;
  igstAmount: number;
  totalTaxAmount: number;
}

/**
 * Contract representation of an authoritative posted Sales Invoice / Transaction.
 */
export interface SalesTaxTransaction {
  id: number | string;
  documentNumber: string; // e.g. "INV-2026-001" or "SO-001"
  documentDate: string; // YYYY-MM-DD
  period: string; // YYYY-MM
  status: "POSTED" | "PAID" | "ACTIVE" | "CANCELLED";
  customerId?: number | null;
  customerName: string;
  customerGstin?: string | null;
  isB2B: boolean;
  placeOfSupply?: string | null; // 2-digit state code e.g. "29"
  isInterState: boolean;
  currency: string;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  isProformaExcluded: boolean;
  lines: SalesTaxLine[];
}

/**
 * Contract interface for pulling posted sales transactions into Finance & GST.
 * Future Sales branches can implement this interface without modifying Finance reporting logic.
 */
export interface ISalesTransactionSource {
  getPostedSalesTransactions(
    scope: OrgScope,
    query: TaxTransactionQuery,
  ): Promise<SalesTaxTransaction[]>;

  getSalesTransactionByReference(
    scope: OrgScope,
    reference: string,
  ): Promise<SalesTaxTransaction | null>;
}

export const SALES_TRANSACTION_SOURCE = Symbol("SALES_TRANSACTION_SOURCE");
