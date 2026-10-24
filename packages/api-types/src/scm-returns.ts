// HANDWRITTEN — mirrors apps/api/src/modules/scm/returns. Migrated from the
// LEGACY TexaWave_ERP_old/src/modules/scm/returns. Decimal columns arrive as
// strings. See packages/api-types/README.md.

export const RETURN_TYPES = ["CUSTOMER_RETURN", "VENDOR_RETURN"] as const;
export type ScmReturnType = (typeof RETURN_TYPES)[number];

export type ScmReturnReasonCode = string;

export const RETURN_CONDITIONS = [
  "NEW",
  "LIKE_NEW",
  "USED",
  "DAMAGED",
  "DEFECTIVE",
  "MISSING_PARTS",
  "UNKNOWN",
] as const;
export type ScmReturnCondition = (typeof RETURN_CONDITIONS)[number];

export const CUSTOMER_RETURN_STATUSES = [
  "REQUESTED",
  "PENDING_APPROVAL",
  "APPROVED",
  "REJECTED",
  "IN_TRANSIT",
  "RECEIVED",
  "INSPECTION_PENDING",
  "INSPECTED",
  "DISPOSITION_PENDING",
  "COMPLETED",
  "CANCELLED",
] as const;
export const VENDOR_RETURN_STATUSES = [
  "REQUESTED",
  "PENDING_APPROVAL",
  "APPROVED",
  "REJECTED",
  "READY_TO_SHIP",
  "SHIPPED",
  "VENDOR_RECEIVED",
  "COMPLETED",
  "CANCELLED",
] as const;
export const ALL_RETURN_STATUSES = [
  ...new Set([...CUSTOMER_RETURN_STATUSES, ...VENDOR_RETURN_STATUSES]),
];
export type ScmReturnStatus = (typeof ALL_RETURN_STATUSES)[number];

export const RETURN_DISPOSITIONS = [
  "RESTOCK",
  "QUARANTINE",
  "DAMAGED",
  "SCRAP",
  "REJECT",
] as const;
export type ScmReturnDisposition = (typeof RETURN_DISPOSITIONS)[number];

export interface ScmReturnItem {
  id: number;
  lineNo: number;
  productId: number;
  productCode: string;
  productName: string;
  uom: string;
  orderedQty: string | null;
  sourceQty: string;
  previouslyReturnedQty: string;
  requestedQty: string;
  receivedReturnQty: string | null;
  acceptedQty: string | null;
  rejectedQty: string | null;
  condition: ScmReturnCondition | null;
  grnItemId: number | null;
  batchId: number | null;
  batchNumber: string | null;
  serialNumbers: string[];
  warehouseId: number;
  locationId: number | null;
  postedLedgerEntryId: number | null;
  unitCost: string | null;
  notes: string | null;
  dispositionQuantities?:
    Partial<Record<ScmReturnDisposition, number>> | undefined;
  remainingToDisposition?: number | undefined;
}

export interface ScmReturnInspectionRecord {
  id: number;
  inspectorId: number;
  inspectionDate: string;
  condition: string;
  acceptedQty: string;
  rejectedQty: string;
  result: "ACCEPTED" | "PARTIALLY_ACCEPTED" | "REJECTED";
  items: {
    itemId: number;
    condition: string;
    acceptedQuantity: number;
    rejectedQuantity: number;
  }[];
  notes: string | null;
  createdAt: string;
}

export interface ScmReturnDispositionRecord {
  id: number;
  returnItemId: number;
  productId: number;
  disposition: ScmReturnDisposition;
  quantity: string;
  warehouseId: number;
  locationId: number | null;
  notes: string | null;
  ledgerEntryIds: number[];
  quarantineRecordId: number | null;
  createdAt: string;
}

export interface ScmReturn {
  id: number;
  returnNumber: string;
  returnType: ScmReturnType;
  salesOrderId: number | null;
  salesOrderNumber: string | null;
  fulfillmentId: number | null;
  fulfillmentNumber: string | null;
  shipmentId: number | null;
  shipmentNumber: string | null;
  customerId: number | null;
  customerName: string | null;
  purchaseOrderId: number | null;
  purchaseOrderNumber: string | null;
  grnId: number | null;
  grnNumber: string | null;
  supplierId: number | null;
  supplierName: string | null;
  warehouseId: number;
  reasonCode: ScmReturnReasonCode;
  reasonDescription: string | null;
  status: ScmReturnStatus;
  requestedDate: string;
  approvedAt: string | null;
  rejectionReason: string | null;
  receivedAt: string | null;
  inspectedAt: string | null;
  shippedAt: string | null;
  vendorReceivedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  returnShipment: {
    carrier?: string | undefined;
    trackingNumber?: string | undefined;
    shippedDate?: string | undefined;
    receivedDate?: string | undefined;
    notes?: string | undefined;
  } | null;
  qualityInspectionId: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  items: ScmReturnItem[];
  warehouse?: { id: number; name: string; code: string };
  inspections?: ScmReturnInspectionRecord[] | undefined;
  dispositions?: ScmReturnDispositionRecord[] | undefined;
  ledgerEntries?: {
    id: number;
    transactionType: string;
    quantityIn: string;
    quantityOut: string;
  }[];
  qualityInspection?: {
    id: number;
    inspectionNumber: string;
    status: string;
  } | null;
}

export interface CreateCustomerReturnInput {
  fulfillmentId: number;
  shipmentId?: number | undefined;
  reasonCode: ScmReturnReasonCode;
  reasonDescription?: string | undefined;
  items: {
    productId: number;
    requestedQuantity: number;
    batchId?: number | undefined;
    serialNumbers?: string[] | undefined;
    notes?: string | undefined;
  }[];
  notes?: string | undefined;
}

export interface CreateVendorReturnInput {
  grnId: number;
  reasonCode: ScmReturnReasonCode;
  reasonDescription?: string | undefined;
  items: {
    grnItemId: number;
    requestedQuantity: number;
    serialNumbers?: string[] | undefined;
    notes?: string | undefined;
  }[];
  notes?: string | undefined;
}

export interface ReceiveReturnInput {
  receivedQuantities?: { itemId: number; quantity: number }[];
  warehouseId?: number | undefined;
  notes?: string | undefined;
}

export interface CompleteReturnInspectionInput {
  itemResults: {
    itemId: number;
    condition: ScmReturnCondition;
    acceptedQuantity: number;
    rejectedQuantity: number;
  }[];
  notes?: string | undefined;
}

export interface ReturnDispositionInput {
  itemId: number;
  disposition: ScmReturnDisposition;
  quantity: number;
  warehouseId?: number | undefined;
  locationId?: number | undefined;
  notes?: string | undefined;
}

export interface ShipVendorReturnInput {
  carrier: string;
  trackingNumber: string;
  notes?: string | undefined;
}

export interface QueryReturnInput {
  page: number;
  limit: number;
  q?: string | undefined;
  returnType?: ScmReturnType | undefined;
  status?: ScmReturnStatus | undefined;
}

export interface CustomerReturnSourceLine {
  productId: number;
  productCode: string;
  productName: string;
  uom: string;
  orderedQty: number;
  fulfilledQty: number;
  returnedQty: number;
  eligibleQty: number;
}
export interface CustomerReturnSource {
  fulfillmentId: number;
  fulfillmentNumber: string;
  salesOrderNumber: string;
  customerName: string;
  warehouseId: number;
  shipments: { id: number; shipmentNumber: string }[];
  lines: CustomerReturnSourceLine[];
}

export interface VendorReturnSourceLine {
  grnItemId: number;
  productId: number;
  productCode: string;
  productName: string;
  uom: string;
  batchNumber: string | null;
  serialNumbers: string[];
  receivedQty: number;
  returnedQty: number;
  eligibleQty: number;
  unitCost: number;
}
export interface VendorReturnSource {
  grnId: number;
  grnNumber: string;
  poNumber: string;
  supplierName: string;
  warehouseId: number;
  lines: VendorReturnSourceLine[];
}

export interface ReturnsDashboard {
  byStatus: Record<string, number>;
  byType: Record<string, number>;
  dispositionedQty: Record<string, number>;
  recent: ScmReturn[];
}
