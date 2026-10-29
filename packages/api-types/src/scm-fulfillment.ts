// HANDWRITTEN — mirrors apps/api/src/modules/scm/{sales,fulfillment,logistics}.
// Migrated from the LEGACY TexaWave_ERP_old/src/modules/scm. Decimal columns
// arrive as strings. See packages/api-types/README.md.

export const SALES_ORDER_STATUSES = [
  "DRAFT",
  "CONFIRMED",
  "CANCELLED",
  "CLOSED",
] as const;
export type ScmSalesOrderStatus = (typeof SALES_ORDER_STATUSES)[number];

export const FULFILLMENT_STATUSES = [
  "PENDING",
  "PARTIALLY_AVAILABLE",
  "AVAILABLE",
  "RESERVED",
  "PICKING",
  "PACKING",
  "READY_TO_SHIP",
  "FULFILLED",
  "CANCELLED",
  "ON_HOLD",
] as const;
export type FulfillmentStatus = (typeof FULFILLMENT_STATUSES)[number];

export const PICK_STATUSES = [
  "PENDING",
  "ASSIGNED",
  "IN_PROGRESS",
  "PARTIALLY_PICKED",
  "COMPLETED",
  "CANCELLED",
] as const;
export const PACK_STATUSES = [
  "PENDING",
  "IN_PROGRESS",
  "PACKED",
  "CANCELLED",
] as const;
export const SHIPMENT_STATUSES = [
  "READY_TO_SHIP",
  "CARRIER_ASSIGNED",
  "LABEL_CREATED",
  "DISPATCHED",
  "IN_TRANSIT",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "DELIVERY_EXCEPTION",
  "FAILED_DELIVERY",
  "CANCELLED",
] as const;
export type FulfillmentView =
  "allocation" | "reserved" | "backorders" | "active";

export interface ScmCustomer {
  id: number;
  customerCode: string;
  name: string;
  contactPerson: string | null;
  email: string | null;
  phone: string | null;
  gstin: string | null;
  billingAddress: string | null;
  shippingAddress: string | null;
  status: "Active" | "Inactive";
  createdAt: string;
}

export interface ScmCustomerPayload {
  customerCode?: string | undefined;
  name: string;
  contactPerson?: string | undefined;
  email?: string | undefined;
  phone?: string | undefined;
  gstin?: string | undefined;
  billingAddress?: string | undefined;
  shippingAddress?: string | undefined;
  status?: "Active" | "Inactive" | undefined;
}

export interface SalesOrderItem {
  id: number;
  lineNo: number;
  productId: number;
  itemCode: string;
  itemDescription: string;
  uom: string;
  salesQty: string;
  unitPrice: string;
  taxRate: string;
  total: string;
  remainingQty?: number;
}

export interface SalesOrder {
  id: number;
  soNumber: string;
  customerId: number;
  customerName: string;
  orderDate: string;
  expectedDate: string | null;
  shipToAddress: string | null;
  billToAddress: string | null;
  currency: string;
  subtotal: string;
  taxAmount: string;
  total: string;
  notes: string | null;
  status: ScmSalesOrderStatus;
  shippedStatus: string;
  createdAt: string;
  items: SalesOrderItem[];
  customer?: { id: number; customerCode: string; name: string };
  _count?: { fulfillments: number };
  fulfillments?: { id: number; fulfillmentNumber: string; status: string }[];
}

export interface SalesOrderPayload {
  customerId: number;
  orderDate: string;
  expectedDate?: string | undefined;
  shipToAddress?: string | undefined;
  billToAddress?: string | undefined;
  notes?: string | undefined;
  items: {
    productId: number;
    quantity: number;
    unitPrice: number;
    taxRate?: number | undefined;
  }[];
}

export interface FulfillmentItem {
  id: number;
  lineNo: number;
  productId: number;
  itemCode: string;
  itemDescription: string;
  uom: string;
  orderedQty: string;
  reservedQty: string;
  issuedQty: string;
}

export interface Fulfillment {
  id: number;
  fulfillmentNumber: string;
  salesOrderId: number;
  salesOrderNumber: string;
  customerId: number;
  customerName: string;
  warehouseId: number;
  status: FulfillmentStatus;
  deliveryStatus: string;
  deliveredAt: string | null;
  cancellationReason: string | null;
  notes: string | null;
  createdAt: string;
  items: FulfillmentItem[];
  warehouse?: { id: number; name: string; code: string };
  requisitions?: { id: number; requisitionNumber: string; status: string }[];
  pickings?: Picking[];
  packings?: Packing[];
  shipments?: {
    id: number;
    shipmentNumber: string;
    status: string;
    trackingNumber: string | null;
  }[];
  reservations?: {
    id: number;
    productId: number;
    quantity: string;
    status: string;
  }[];
  ledgerEntries?: {
    id: number;
    transactionType: string;
    quantityOut: string;
    productId: number;
  }[];
}

export interface PickingItem {
  id: number;
  productId: number;
  productCode: string;
  productName: string;
  requestedQuantity: string;
  pickedQuantity: string;
  sourceLocationId: number | null;
}

export interface Picking {
  id: number;
  pickNumber: string;
  salesOrderId: number;
  salesOrderNumber: string;
  fulfillmentId: number;
  warehouseId: number;
  pickerName: string | null;
  priority: string;
  status: string;
  startedAt: string | null;
  completedAt: string | null;
  notes: string | null;
  createdAt: string;
  items: PickingItem[];
  warehouse?: { id: number; name: string; code: string };
  fulfillment?: { id: number; fulfillmentNumber: string; status: string };
}

export interface PackingPackage {
  id: number;
  packageNumber: string;
  packageType: string | null;
  weight: string | null;
  items: { id: number; productId: number; quantity: string }[];
}

export interface Packing {
  id: number;
  packNumber: string;
  pickingId: number;
  salesOrderId: number;
  salesOrderNumber: string;
  fulfillmentId: number;
  packerName: string | null;
  status: string;
  completedAt: string | null;
  notes: string | null;
  createdAt: string;
  packages: PackingPackage[];
  warehouse?: { id: number; name: string; code: string };
  picking?: { id: number; pickNumber: string };
  fulfillment?: { id: number; fulfillmentNumber: string; status: string };
}

export interface PackingPayload {
  pickingId: number;
  packerName?: string | undefined;
  notes?: string | undefined;
  packages: {
    packageNumber: string;
    packageType?: string | undefined;
    weight?: number | undefined;
    items: { productId: number; quantity: number }[];
  }[];
}

export interface Carrier {
  id: number;
  carrierCode: string;
  carrierName: string;
  serviceTypes: string[];
  contact: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  trackingUrlTemplate: string | null;
  status: "ACTIVE" | "INACTIVE";
  notes: string | null;
  _count?: { shipments: number };
}

export interface ShipmentTrackingEvent {
  id: number;
  shipmentId: number;
  status: string;
  location: string | null;
  description: string | null;
  eventTime: string;
  source: string;
  shipment?: {
    id: number;
    shipmentNumber: string;
    trackingNumber: string | null;
  };
}

export interface ShipmentException {
  id: number;
  exceptionCode: string;
  description: string;
  occurredAt: string;
  resolution: string | null;
  resolvedAt: string | null;
}

export interface Shipment {
  id: number;
  shipmentNumber: string;
  fulfillmentId: number;
  salesOrderId: number;
  salesOrderNumber: string;
  customerId: number;
  customerName: string;
  totalPackages: number;
  totalWeight: string;
  shippingAddress: string;
  carrierId: number | null;
  carrierName: string | null;
  serviceType: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  shippingCost: string | null;
  currency: string;
  status: string;
  shipmentDate: string | null;
  expectedDeliveryDate: string | null;
  actualDeliveryDate: string | null;
  recipientName: string | null;
  deliveryNotes: string | null;
  cancellationReason: string | null;
  createdAt: string;
  packages: unknown;
  carrier?: { id: number; carrierCode: string; carrierName: string };
  fulfillment?: { id: number; fulfillmentNumber: string };
  exceptions: ShipmentException[];
  events?: ShipmentTrackingEvent[];
  trackingEvents?: ShipmentTrackingEvent[];
}

export interface ShippableFulfillment {
  id: number;
  fulfillmentNumber: string;
  salesOrderNumber: string;
  customerName: string;
  status: string;
  blockers: string[];
  unshippedPackings: { id: number; packNumber: string; packages: number }[];
}
