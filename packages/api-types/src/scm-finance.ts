// HANDWRITTEN — mirrors apps/api/src/modules/scm/finance. Supplier Accounts
// Payable bills, payments made, and supplier documents (legacy supplier detail
// tabs "Bills", "Payments", "Documents"). Money fields arrive as decimal
// strings from Prisma; `outstanding` / `overdue` are derived by the API.

export type SupplierBillStatus =
  "OPEN" | "PARTIALLY_PAID" | "PAID" | "CANCELLED";

export type SupplierPaymentMode =
  "BANK_TRANSFER" | "CASH" | "CHEQUE" | "UPI" | "CARD" | "OTHER";

export type SupplierPaymentStatus = "POSTED" | "VOIDED";

export type SupplierDocumentType =
  | "GST_CERTIFICATE"
  | "PAN"
  | "BANK_DETAILS"
  | "CONTRACT"
  | "COMPLIANCE"
  | "OTHER";

export interface SupplierBill {
  id: number;
  billNumber: string;
  supplierBillNumber: string | null;
  supplierId: number;
  purchaseOrderId: number | null;
  goodsReceiptId: number | null;
  billDate: string;
  dueDate: string | null;
  currency: string;
  subtotal: string;
  taxAmount: string;
  total: string;
  paidAmount: string;
  status: SupplierBillStatus;
  notes: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  createdAt: string;
  updatedAt: string;
  outstanding: number;
  overdue: boolean;
  supplier: { id: number; supplierCode: string; companyName: string };
  purchaseOrder: { id: number; poNumber: string } | null;
  goodsReceipt: { id: number; grnNumber: string } | null;
}

export interface SupplierPayment {
  id: number;
  paymentNumber: string;
  supplierId: number;
  billId: number | null;
  paymentDate: string;
  mode: SupplierPaymentMode;
  referenceNumber: string | null;
  amount: string;
  currency: string;
  notes: string | null;
  status: SupplierPaymentStatus;
  voidedAt: string | null;
  voidReason: string | null;
  createdAt: string;
  supplier: { id: number; supplierCode: string; companyName: string };
  bill: {
    id: number;
    billNumber: string;
    supplierBillNumber: string | null;
  } | null;
}

export interface SupplierFinanceSummary {
  billCount: number;
  openBillCount: number;
  totalBilled: number;
  totalPaid: number;
  outstanding: number;
  overdueCount: number;
  overdueAmount: number;
  unappliedPaid: number;
  paymentCount: number;
}

export interface SupplierDocument {
  id: number;
  supplierId: number;
  name: string;
  documentType: SupplierDocumentType | null;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedBy: number | null;
  createdAt: string;
}

export interface CreateSupplierBillInput {
  supplierId: number;
  supplierBillNumber?: string;
  purchaseOrderId?: number;
  goodsReceiptId?: number;
  billDate: string;
  dueDate?: string;
  subtotal: number;
  taxAmount?: number;
  notes?: string;
}

export type UpdateSupplierBillInput = Partial<
  Omit<
    CreateSupplierBillInput,
    "supplierId" | "purchaseOrderId" | "goodsReceiptId"
  >
>;

export interface CreateSupplierPaymentInput {
  supplierId: number;
  billId?: number;
  paymentDate: string;
  mode: SupplierPaymentMode;
  referenceNumber?: string;
  amount: number;
  notes?: string;
}

export interface QuerySupplierBillsInput {
  q?: string;
  status?: SupplierBillStatus;
  supplierId?: number;
  overdue?: "true" | "false";
  page?: number;
  limit?: number;
}

export interface QuerySupplierPaymentsInput {
  q?: string;
  supplierId?: number;
  billId?: number;
  status?: SupplierPaymentStatus;
  page?: number;
  limit?: number;
}
