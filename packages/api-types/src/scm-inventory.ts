// HANDWRITTEN — mirrors apps/api/src/modules/scm/{products,warehouses,inventory}.
// Migrated from the LEGACY TexaWave_ERP_old/src/modules/scm/{inventory,warehouse}.
// Decimal columns arrive as strings; computed overview rows are numbers.

export interface ScmProduct {
  id: number;
  organizationId: number;
  productCode: string;
  name: string;
  category: string | null;
  uom: string;
  hsn: string | null;
  unitPrice: string;
  costPrice: string;
  reorderLevel: string | null;
  minimumStock: string | null;
  maximumStock: string | null;
  batchTracked: boolean;
  serialTracked: boolean;
  description: string | null;
  isActive: boolean;
  /** Barcode override; when null the screens derive one from productCode. */
  barcode: string | null;
  /** When the product barcode was first generated (printed on the label). */
  barcodeCreatedAt: string | null;
  /** Warehouse chosen for this SKU; its default bin must belong to it. */
  warehouseId: number | null;
  /** Manually assigned default bin location. */
  binLocationId: number | null;
  /** Product-level expiry (YYYY-MM-DD); read only when no batch expiry exists. */
  expiryDate: string | null;
  expiryNotApplicable: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateScmProductInput {
  productCode: string;
  name: string;
  category?: string | undefined;
  uom?: string | undefined;
  hsn?: string | undefined;
  unitPrice?: number | undefined;
  costPrice?: number | undefined;
  reorderLevel?: number | null | undefined;
  minimumStock?: number | null | undefined;
  maximumStock?: number | null | undefined;
  batchTracked?: boolean | undefined;
  serialTracked?: boolean | undefined;
  description?: string | undefined;
  isActive?: boolean | undefined;
  barcode?: string | null | undefined;
  warehouseId?: number | null | undefined;
  binLocationId?: number | null | undefined;
  expiryDate?: string | null | undefined;
  expiryNotApplicable?: boolean | undefined;
}
export type UpdateScmProductInput = Partial<CreateScmProductInput>;

export interface QueryScmProductsInput {
  page?: number | undefined;
  limit?: number | undefined;
  q?: string | undefined;
  isActive?: boolean | undefined;
}

export interface ScmWarehouse {
  id: number;
  organizationId: number;
  code: string;
  name: string;
  /** One of the org's active `warehouse_type` SCM Master values
   * (scm/master-list-items), not a fixed union. */
  type: string;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  postalCode: string | null;
  managerName: string | null;
  status: "Active" | "Inactive";
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  capacity: string | null;
  capacityUnit: string | null;
  operatingHours: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateWarehouseInput {
  code: string;
  name: string;
  type?: string | undefined;
  address?: string | undefined;
  city?: string | undefined;
  state?: string | undefined;
  country?: string | undefined;
  postalCode?: string | undefined;
  managerName?: string | undefined;
  status?: "Active" | "Inactive" | undefined;
  contactPerson?: string | undefined;
  phone?: string | undefined;
  email?: string | undefined;
  capacity?: number | undefined;
  capacityUnit?: string | undefined;
  operatingHours?: string | undefined;
  notes?: string | undefined;
}
export type UpdateWarehouseInput = Partial<CreateWarehouseInput>;

export interface QueryWarehousesInput {
  page?: number | undefined;
  limit?: number | undefined;
  q?: string | undefined;
  status?: "Active" | "Inactive" | undefined;
}

export const LOCATION_TYPES = ["ZONE", "RACK", "SHELF", "BIN"] as const;
export type LocationType = (typeof LOCATION_TYPES)[number];
/** The parent type each location type must sit inside (legacy rule). */
export const VALID_PARENT_TYPE: Record<LocationType, LocationType | null> = {
  ZONE: null,
  RACK: "ZONE",
  SHELF: "RACK",
  BIN: "SHELF",
};

/** Parent types a location may sit in today: the Rack -> Bin layout is the
 * working model (a rack needs no zone, a bin sits in a rack) while Zone and
 * Shelf stay valid for locations created under the older hierarchy. */
export const ALLOWED_PARENT_TYPES: Record<
  LocationType,
  readonly LocationType[]
> = {
  ZONE: [],
  RACK: ["ZONE"],
  SHELF: ["RACK"],
  BIN: ["RACK", "SHELF"],
};

/** Location types offered when creating a new location. */
export const CREATABLE_LOCATION_TYPES = ["RACK", "BIN"] as const;

export interface ScmLocation {
  id: number;
  warehouseId: number;
  parentLocationId: number | null;
  locationType: LocationType | null;
  locationCode: string | null;
  zone: string | null;
  rack: string | null;
  shelf: string | null;
  binCode: string;
  locationName: string | null;
  capacity: string | null;
  capacityUnit: string | null;
  notes: string | null;
  status: "Active" | "Inactive";
  createdAt: string;
}

export interface CreateLocationInput {
  warehouseId: number;
  locationType: LocationType;
  parentLocationId?: number | undefined;
  code: string;
  locationName?: string | undefined;
  capacity?: number | undefined;
  capacityUnit?: string | undefined;
  notes?: string | undefined;
  /** Racks only: bins (B01, B02, ...) created together with the rack. */
  bins?:
    | {
        name?: string | undefined;
        capacity?: number | undefined;
        capacityUnit?: string | undefined;
      }[]
    | undefined;
}
export interface UpdateLocationInput {
  /** A structural edit (warehouse / type / parent / code) re-derives the code
   * of this location and of everything nested under it. */
  warehouseId?: number | undefined;
  locationType?: LocationType | undefined;
  parentLocationId?: number | null | undefined;
  code?: string | undefined;
  locationName?: string | undefined;
  capacity?: number | undefined;
  capacityUnit?: string | undefined;
  notes?: string | undefined;
  status?: "Active" | "Inactive" | undefined;
}
export interface QueryLocationsInput {
  page?: number | undefined;
  limit?: number | undefined;
  warehouseId?: number | undefined;
  locationType?: LocationType | undefined;
}

export type StockStatus =
  "Out of Stock" | "Low Stock" | "Healthy" | "Overstock";
export const STOCK_STATUSES: readonly StockStatus[] = [
  "Out of Stock",
  "Low Stock",
  "Healthy",
  "Overstock",
];

export interface InventoryRow {
  id: string;
  productId: number;
  productCode: string;
  productName: string;
  category: string | null;
  uom: string;
  warehouseId: number;
  warehouseName: string;
  onHand: number;
  reserved: number;
  available: number;
  incoming: number;
  damaged: number;
  quarantine: number;
  reorderLevel: number | null;
  costPrice: number;
  value: number;
  stockStatus: StockStatus;
}

export interface InventoryKpis {
  totalValue: number;
  totalSkus: number;
  available: number;
  reserved: number;
  incoming: number;
  /** Rejected / bad (damaged) units across the rows. */
  bad: number;
  lowStock: number;
  outOfStock: number;
}

export interface QueryOverviewInput {
  page?: number | undefined;
  limit?: number | undefined;
  q?: string | undefined;
  warehouseId?: number | undefined;
  stockStatus?: StockStatus | undefined;
  hasBadStock?: boolean | undefined;
}

export const LEDGER_TRANSACTION_TYPES = [
  "OPENING_BALANCE",
  "PURCHASE_RECEIPT",
  "SALES_ISSUE",
  "SALES_RETURN",
  "PURCHASE_RETURN",
  "TRANSFER_OUT",
  "TRANSFER_IN",
  "ADJUSTMENT_IN",
  "ADJUSTMENT_OUT",
  "DAMAGE",
  "QUARANTINE",
  "QC_RELEASE",
  "QC_REJECT",
] as const;
export type LedgerTransactionType = (typeof LEDGER_TRANSACTION_TYPES)[number];

export interface LedgerEntry {
  id: number;
  productId: number;
  warehouseId: number;
  transactionType: LedgerTransactionType;
  referenceType: string;
  referenceId: number | null;
  referenceNumber: string | null;
  quantityIn: string;
  quantityOut: string;
  unitCost: string | null;
  transactionDate: string;
  notes: string | null;
  product?: { id: number; productCode: string; name: string; uom: string };
  warehouse?: { id: number; name: string };
  warehouseName?: string;
}

export interface QueryLedgerInput {
  page?: number | undefined;
  limit?: number | undefined;
  q?: string | undefined;
  productId?: number | undefined;
  warehouseId?: number | undefined;
  transactionType?: LedgerTransactionType | undefined;
  from?: string | undefined;
  to?: string | undefined;
}

export interface ScmBatch {
  id: number;
  batchNumber: string;
  productId: number;
  warehouseId: number;
  locationId?: number | null;
  manufacturingDate: string | null;
  expiryDate: string | null;
  quantity: string;
  status: "ACTIVE" | "EXPIRED" | "QUARANTINED" | "BLOCKED";
  createdAt: string;
  product?: { id: number; productCode: string; name: string; uom: string };
  warehouse?: { id: number; name: string };
}
export const BATCH_STATUSES = [
  "ACTIVE",
  "EXPIRED",
  "QUARANTINED",
  "BLOCKED",
] as const;

export const SERIAL_STATUSES = [
  "AVAILABLE",
  "RESERVED",
  "SOLD",
  "TRANSFERRED",
  "DAMAGED",
  "RETURNED",
  "QUARANTINED",
] as const;
export type SerialStatus = (typeof SERIAL_STATUSES)[number];
export interface ScmSerial {
  id: number;
  serialNumber: string;
  productId: number;
  warehouseId: number;
  locationId?: number | null;
  status: SerialStatus;
  currentReference: string | null;
  createdAt: string;
  product?: { id: number; productCode: string; name: string; uom: string };
  warehouse?: { id: number; name: string };
}

export interface ScmReservation {
  id: number;
  productId: number;
  warehouseId: number;
  salesOrderId: number | null;
  salesOrderNumber: string | null;
  quantity: string;
  status: "ACTIVE" | "RELEASED" | "FULFILLED" | "CANCELLED";
  notes: string | null;
  createdAt: string;
  releasedAt: string | null;
  product?: { id: number; productCode: string; name: string; uom: string };
  warehouse?: { id: number; name: string };
}

export const TRANSFER_STATUSES = [
  "DRAFT",
  "REQUESTED",
  "APPROVED",
  "IN_TRANSIT",
  "RECEIVED",
  "CANCELLED",
] as const;
export type TransferStatus = (typeof TRANSFER_STATUSES)[number];
export interface ScmTransfer {
  id: number;
  transferNumber: string;
  productId: number;
  sourceWarehouseId: number;
  destinationWarehouseId: number;
  quantity: string;
  status: TransferStatus;
  notes: string | null;
  createdAt: string;
  approvedAt: string | null;
  dispatchedAt: string | null;
  receivedAt: string | null;
  product?: { id: number; productCode: string; name: string; uom: string };
  sourceWarehouse?: { id: number; name: string };
  destinationWarehouse?: { id: number; name: string };
}

export type AdjustmentDirection = "IN" | "OUT";
export interface ScmAdjustment {
  id: number;
  adjustmentNumber: string;
  productId: number;
  warehouseId: number;
  quantity: string;
  direction: "IN" | "OUT";
  /** One of the org's active `stock_adjustment_reason` SCM Master values
   * (scm/master-list-items), not a fixed union. */
  reason: string;
  notes: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  createdAt: string;
  approvedAt: string | null;
  product?: { id: number; productCode: string; name: string; uom: string };
  warehouse?: { id: number; name: string };
}

export interface InventoryProductDetail {
  product: ScmProduct;
  rows: InventoryRow[];
  ledger: LedgerEntry[];
  batches: ScmBatch[];
  serialCounts: Record<string, number>;
}

export interface QueryInventoryDocsInput {
  page?: number | undefined;
  limit?: number | undefined;
  status?: string | undefined;
  productId?: number | undefined;
  warehouseId?: number | undefined;
  q?: string | undefined;
  expiringSoon?: boolean | undefined;
}

export interface OpeningBalanceInput {
  productId: number;
  warehouseId: number;
  quantity: number;
  unitCost?: number | undefined;
  notes?: string | undefined;
}
export interface CreateReservationInput {
  productId: number;
  warehouseId: number;
  quantity: number;
  salesOrderId?: number | undefined;
  notes?: string | undefined;
}
export interface CreateTransferInput {
  productId: number;
  sourceWarehouseId: number;
  destinationWarehouseId: number;
  quantity: number;
  notes?: string | undefined;
}
export interface CreateAdjustmentInput {
  productId: number;
  warehouseId: number;
  quantity: number;
  direction: "IN" | "OUT";
  reason: string;
  notes?: string | undefined;
}
export interface CreateBatchInput {
  batchNumber: string;
  productId: number;
  warehouseId: number;
  manufacturingDate?: string | undefined;
  expiryDate?: string | undefined;
}
export interface CreateSerialsInput {
  productId: number;
  warehouseId: number;
  serialNumbers: string[];
}

/** Stock stored in a location (non-zero rows only). */
export interface LocationStockEntry {
  locationId: number;
  warehouseId: number;
  quantity: string;
  product: { id: number; productCode: string; name: string };
}
