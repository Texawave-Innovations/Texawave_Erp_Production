import type { OrgScope } from "../../../../common/tenancy/org-scope.js";
import type { TaxTransactionQuery } from "./sales-transaction.contract.js";

/**
 * Normalized line item tax breakdown for inward purchase transactions.
 */
export interface PurchaseTaxLine {
  lineOrder: number;
  productId?: number | null;
  productName?: string | null;
  description: string;
  hsnSacCode?: string | null;
  quantity?: number | null;
  uom?: string | null;
  unitPrice?: number;
  taxableAmount: number;
  taxRate: number; // Combined rate e.g. 18.0
  cgstRate?: number;
  cgstAmount: number;
  sgstRate?: number;
  sgstAmount: number;
  igstRate?: number;
  igstAmount: number;
  totalTaxAmount: number;
  isItcEligible: boolean;
}

/**
 * Contract representation of an inward purchase transaction (Supplier Bill or Operational Expense).
 *
 * Statutory Rule: A Purchase Order (PO) alone is an unfulfilled commitment and is NOT
 * proof of completed purchase or eligible ITC. Only completed/posted supplier bills
 * and paid qualifying expenses constitute valid inward tax transactions.
 */
export interface PurchaseTaxTransaction {
  id: number | string;
  documentNumber: string; // Internal bill or expense reference e.g. "TW/BILL/0001" or "EXP-001"
  supplierBillNumber?: string | null; // Vendor's tax invoice number e.g. "INV-9901"
  documentDate: string; // YYYY-MM-DD
  period: string; // YYYY-MM
  status: "POSTED" | "PAID" | "ACTIVE" | "CANCELLED";
  supplierId?: number | null;
  supplierName: string;
  supplierGstin?: string | null;
  isRegisteredVendor: boolean;
  placeOfSupply?: string | null;
  isInterState: boolean;
  currency: string;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  /**
   * CRITICAL: Distinguishes recorded input tax from eligible ITC.
   * Only true when goods/services have been received, tax invoice is held,
   * supplier is GST-registered, and section 17(5) blocked credit rules do not apply.
   */
  isItcEligible: boolean;
  inwardSourceType: "SUPPLIER_BILL" | "EXPENSE";
  lines: PurchaseTaxLine[];
}

/**
 * Contract interface for pulling inward purchase transactions into Finance & GST.
 * Future Purchases / AP branches can implement this interface to connect seamlessly.
 */
export interface IPurchasesTransactionSource {
  getInwardTaxTransactions(
    scope: OrgScope,
    query: TaxTransactionQuery,
  ): Promise<PurchaseTaxTransaction[]>;

  getPurchaseTransactionByReference(
    scope: OrgScope,
    reference: string,
  ): Promise<PurchaseTaxTransaction | null>;
}

export const PURCHASES_TRANSACTION_SOURCE = Symbol(
  "PURCHASES_TRANSACTION_SOURCE",
);
