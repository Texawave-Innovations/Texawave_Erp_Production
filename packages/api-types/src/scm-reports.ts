// HANDWRITTEN — mirrors apps/api/src/modules/scm/reports. Migrated from the
// LEGACY TexaWave_ERP_old/src/modules/scm/reports (read-only snapshots, never
// a new data path). See packages/api-types/README.md.

export interface ReportsOverview {
  openPOs: number;
  openPOValue: number;
  lowStockProducts: number;
  openFulfillments: number;
  shipmentsInTransit: number;
  openReturns: number;
  pendingInspections: number;
  activeSuppliers: number;
}

export interface ReportQuery {
  warehouseId?: number | undefined;
  supplierId?: number | undefined;
  from?: string | undefined;
  to?: string | undefined;
}

export interface ProcurementReportRow {
  poNumber: string;
  supplier: string;
  poDate: string;
  status: string;
  lines: number;
  orderedQty: number;
  receivedQty: number;
  total: number;
  goodsReceipts: number;
}

export interface InventoryReportRow {
  productCode: string;
  productName: string;
  warehouse: string;
  onHand: number;
  reserved: number;
  available: number;
  incoming: number;
  damaged: number;
  quarantine: number;
  valuation: number;
  status: "Low Stock" | "Out of Stock" | "Healthy";
}

export interface WarehouseReportRow {
  warehouse: string;
  code: string;
  status: string;
  activeLocations: number;
  occupiedLocations: number;
  pendingPutaways: number;
  openMovements: number;
}

export interface FulfillmentReportRow {
  fulfillmentNumber: string;
  salesOrder: string;
  customer: string;
  status: string;
  deliveryStatus: string;
  orderedQty: number;
  issuedQty: number;
  createdAt: string;
  deliveredAt: string | null;
}

export interface LogisticsReportRow {
  shipmentNumber: string;
  customer: string;
  carrier: string;
  status: string;
  packages: number;
  shippingCost: number;
  dispatchedAt: string | null;
  deliveredAt: string | null;
}

export interface ReturnsReportRow {
  returnNumber: string;
  type: string;
  party: string;
  reasonCode: string;
  status: string;
  lines: number;
  dispositionedQty: number;
  requestedDate: string;
  completedAt: string | null;
}

export interface QualityReportRow {
  inspectionNumber: string;
  type: string;
  source: string;
  status: string;
  result: string | null;
  defects: number;
  inspectionDate: string;
  completedAt: string | null;
}

export interface SupplierReportRow {
  supplier: string;
  status: string;
  purchaseOrders: number;
  totalSpend: number;
  goodsReceipts: number;
  vendorReturns: number;
}
