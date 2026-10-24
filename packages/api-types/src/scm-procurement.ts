// HANDWRITTEN — mirrors apps/api/src/modules/scm/procurement. Migrated from
// the LEGACY TexaWave_ERP_old/src/modules/scm/procurement. Decimal columns
// arrive as strings. See packages/api-types/README.md.

export type RequisitionPriority = string;
export const REQUISITION_STATUSES = [
  "DRAFT",
  "SUBMITTED",
  "APPROVED",
  "REJECTED",
  "CANCELLED",
  "CONVERTED",
] as const;
export type RequisitionStatus = (typeof REQUISITION_STATUSES)[number];

export interface RequisitionItem {
  id: number;
  lineNo: number;
  productId: number;
  productNameSnapshot: string;
  uom: string;
  quantity: string;
  estimatedUnitCost: string;
  estimatedTotal: string;
  requiredDate: string | null;
  notes: string | null;
}

export interface PurchaseRequisition {
  id: number;
  requisitionNumber: string;
  requestedByName: string;
  department: string | null;
  requestDate: string;
  requiredDate: string | null;
  priority: RequisitionPriority;
  warehouseId: number;
  purpose: string | null;
  notes: string | null;
  subtotal: string;
  tax: string;
  total: string;
  status: RequisitionStatus;
  approvedByName: string | null;
  approvedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
  items: RequisitionItem[];
  warehouse?: { id: number; name: string; code: string };
  /** POs raised from this requisition (cancelled ones included). */
  purchaseOrders?: RequisitionLinkedPo[];
}

export interface RequisitionLinkedPo {
  id: number;
  poNumber: string;
  vendorNameSnapshot: string;
  status: PoStatus;
  items: { productId: number; quantity: string; receivedQuantity: string }[];
}

export interface RequisitionPayload {
  department?: string | undefined;
  requestDate: string;
  requiredDate?: string | undefined;
  priority?: RequisitionPriority | undefined;
  warehouseId: number;
  purpose?: string | undefined;
  notes?: string | undefined;
  tax?: number | undefined;
  items: {
    productId: number;
    quantity: number;
    estimatedUnitCost?: number | undefined;
    requiredDate?: string | undefined;
    notes?: string | undefined;
  }[];
}

export interface QueryRequisitionsInput {
  page?: number | undefined;
  limit?: number | undefined;
  q?: string | undefined;
  status?: RequisitionStatus | undefined;
  from?: string | undefined;
  to?: string | undefined;
}

export const RFQ_STATUSES = [
  "DRAFT",
  "RESPONSES_PENDING",
  "PARTIALLY_RESPONDED",
  "RESPONDED",
  "CLOSED",
  "CANCELLED",
] as const;
export type RfqStatus = (typeof RFQ_STATUSES)[number];

export interface Rfq {
  id: number;
  rfqNumber: string;
  requisitionId: number | null;
  issueDate: string;
  responseDueDate: string | null;
  warehouseId: number;
  deliveryLocation: string | null;
  currency: string;
  paymentTerms: string | null;
  deliveryTerms: string | null;
  notes: string | null;
  status: RfqStatus;
  createdAt: string;
  items: {
    id: number;
    lineNo: number;
    productId: number;
    productNameSnapshot: string;
    uom: string;
    quantity: string;
    notes: string | null;
  }[];
  suppliers: { id: number; supplierId: number; supplierNameSnapshot: string }[];
  warehouse?: { id: number; name: string; code: string };
  requisition?: { id: number; requisitionNumber: string } | null;
  _count?: { quotations: number };
}

export interface CreateRfqInput {
  requisitionId?: number | undefined;
  supplierIds: number[];
  issueDate: string;
  responseDueDate?: string | undefined;
  warehouseId: number;
  deliveryLocation?: string | undefined;
  currency?: string | undefined;
  paymentTerms?: string | undefined;
  deliveryTerms?: string | undefined;
  notes?: string | undefined;
  items: { productId: number; quantity: number; notes?: string | undefined }[];
}

export interface QueryRfqsInput {
  page?: number | undefined;
  limit?: number | undefined;
  q?: string | undefined;
  status?: RfqStatus | undefined;
}

export const SCM_QUOTATION_STATUSES = [
  "RECEIVED",
  "SHORTLISTED",
  "SELECTED",
  "REJECTED",
  "CANCELLED",
] as const;
export type ScmQuotationStatus = (typeof SCM_QUOTATION_STATUSES)[number];

export interface SupplierQuotationItem {
  id: number;
  lineNo: number;
  productId: number;
  productNameSnapshot: string;
  uom: string;
  quantity: string;
  unitPrice: string;
  discount: string;
  taxRate: string;
  taxAmount: string;
  total: string;
  promisedDeliveryDate: string | null;
  notes: string | null;
}

export interface SupplierQuotation {
  id: number;
  quotationNumber: string;
  supplierQuotationNumber: string | null;
  rfqId: number;
  supplierId: number;
  vendorNameSnapshot: string;
  vendorGstinSnapshot: string | null;
  quotationDate: string;
  validUntil: string | null;
  currency: string;
  paymentTerms: string | null;
  deliveryTerms: string | null;
  freight: string;
  discount: string;
  tax: string;
  subtotal: string;
  total: string;
  notes: string | null;
  status: ScmQuotationStatus;
  createdAt: string;
  items: SupplierQuotationItem[];
  rfq?: { id: number; rfqNumber: string; status: RfqStatus };
  supplier?: { id: number; supplierCode: string; companyName: string };
}

export interface CreateQuotationInput {
  supplierQuotationNumber?: string | undefined;
  rfqId: number;
  supplierId: number;
  quotationDate: string;
  validUntil?: string | undefined;
  currency?: string | undefined;
  paymentTerms?: string | undefined;
  deliveryTerms?: string | undefined;
  freight?: number | undefined;
  discount?: number | undefined;
  notes?: string | undefined;
  items: {
    productId: number;
    quantity: number;
    unitPrice: number;
    discount?: number | undefined;
    taxRate?: number | undefined;
    promisedDeliveryDate?: string | undefined;
    notes?: string | undefined;
  }[];
}

export interface QueryScmQuotationsInput {
  page?: number | undefined;
  limit?: number | undefined;
  q?: string | undefined;
  status?: ScmQuotationStatus | undefined;
  rfqId?: number | undefined;
  supplierId?: number | undefined;
}

export interface QuotationComparisonRecord {
  id: number;
  rfqId: number;
  quotationIds: number[];
  selectedQuotationIds: number[];
  selectedAt: string | null;
  remarks: string | null;
  status: "OPEN" | "DECIDED";
  createdAt: string;
}

export const PO_STATUSES = [
  "DRAFT",
  "PENDING_APPROVAL",
  "APPROVED",
  "SENT",
  "PARTIALLY_RECEIVED",
  "RECEIVED",
  "CANCELLED",
  "CLOSED",
] as const;
export type PoStatus = (typeof PO_STATUSES)[number];

export interface PurchaseOrderItem {
  id: number;
  lineNo: number;
  productId: number;
  productNameSnapshot: string;
  uom: string;
  quantity: string;
  receivedQuantity: string;
  unitPrice: string;
  discount: string;
  taxRate: string;
  taxAmount: string;
  total: string;
}

export interface PurchaseOrder {
  id: number;
  poNumber: string;
  supplierId: number;
  vendorNameSnapshot: string;
  vendorGstinSnapshot: string | null;
  rfqId: number | null;
  quotationId: number | null;
  requisitionId: number | null;
  requisitionNumber: string | null;
  poDate: string;
  expectedDeliveryDate: string | null;
  warehouseId: number;
  deliveryLocation: string | null;
  paymentTerms: string | null;
  currency: string;
  freight: string;
  discount: string;
  subtotal: string;
  taxAmount: string;
  total: string;
  notes: string | null;
  status: PoStatus;
  approvedByName: string | null;
  approvedAt: string | null;
  incomingApplied: boolean;
  createdAt: string;
  items: PurchaseOrderItem[];
  warehouse?: { id: number; name: string; code: string };
  quotation?: { id: number; quotationNumber: string } | null;
  rfq?: { id: number; rfqNumber: string } | null;
  requisition?: {
    id: number;
    requisitionNumber: string;
    requestedByName: string;
    department: string | null;
    purpose: string | null;
  } | null;
  _count?: { receipts: number };
}

export interface CreatePurchaseOrderInput {
  quotationId?: number | undefined;
  /** Material Requisition to link; it flips to CONVERTED. */
  requisitionId?: number | undefined;
  supplierId?: number | undefined;
  poDate: string;
  expectedDeliveryDate?: string | undefined;
  warehouseId: number;
  deliveryLocation?: string | undefined;
  paymentTerms?: string | undefined;
  currency?: string | undefined;
  freight?: number | undefined;
  discount?: number | undefined;
  notes?: string | undefined;
  items?:
    | {
        productId: number;
        quantity: number;
        unitPrice: number;
        discount?: number | undefined;
        taxRate?: number | undefined;
      }[]
    | undefined;
}

export interface QueryPurchaseOrdersInput {
  page?: number | undefined;
  limit?: number | undefined;
  q?: string | undefined;
  status?: PoStatus | undefined;
  supplierId?: number | undefined;
  requisitionId?: number | undefined;
  receivable?: string | undefined;
}

export interface GoodsReceiptItem {
  id: number;
  purchaseOrderItemId: number;
  productId: number;
  productNameSnapshot: string;
  uom: string;
  orderedQuantity: string;
  previouslyReceivedQuantity: string;
  receivingQuantity: string;
  rejectedQuantity: string;
  acceptedQuantity: string;
  batchNumber: string | null;
  serialNumbers: string[];
  unitCost: string;
  totalCost: string;
  notes: string | null;
}

export interface GoodsReceipt {
  id: number;
  grnNumber: string;
  purchaseOrderId: number;
  supplierId: number;
  vendorNameSnapshot: string;
  receiptDate: string;
  warehouseId: number;
  receivedByName: string;
  notes: string | null;
  status: "COMPLETED" | "CANCELLED";
  createdAt: string;
  items: GoodsReceiptItem[];
  purchaseOrder?: { id: number; poNumber: string; status: PoStatus };
  warehouse?: { id: number; name: string; code: string };
  ledgerEntries?: {
    id: number;
    productId: number;
    transactionType: string;
    quantityIn: string;
  }[];
}

export interface CreateGoodsReceiptInput {
  purchaseOrderId: number;
  receiptDate: string;
  locationId?: number | undefined;
  notes?: string | undefined;
  lines: {
    purchaseOrderItemId: number;
    receivingQuantity: number;
    rejectedQuantity?: number | undefined;
    batchNumber?: string | undefined;
    serialNumbers?: string[] | undefined;
    unitCost?: number | undefined;
    manufacturingDate?: string | undefined;
    expiryDate?: string | undefined;
    notes?: string | undefined;
  }[];
}

export interface QueryGoodsReceiptsInput {
  page?: number | undefined;
  limit?: number | undefined;
  q?: string | undefined;
  purchaseOrderId?: number | undefined;
  supplierId?: number | undefined;
}

export interface ProcurementDashboardSummary {
  requisitions: Record<string, number>;
  rfqs: Record<string, number>;
  quotations: Record<string, number>;
  purchaseOrders: Record<string, number>;
  goodsReceipts: number;
  openPurchaseOrderValue: number;
}
