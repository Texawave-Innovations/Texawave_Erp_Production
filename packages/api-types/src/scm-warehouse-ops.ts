// HANDWRITTEN — mirrors apps/api/src/modules/scm/warehouse-ops. Migrated from
// the LEGACY TexaWave_ERP_old/src/modules/scm/warehouse. Decimal columns
// arrive as strings. See packages/api-types/README.md.

export const PUTAWAY_STATUSES = [
  "PENDING",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
] as const;
export type PutawayStatus = (typeof PUTAWAY_STATUSES)[number];

export const MOVEMENT_STATUSES = [
  "DRAFT",
  "REQUESTED",
  "APPROVED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
] as const;
export type MovementStatus = (typeof MOVEMENT_STATUSES)[number];

export interface PutawayItem {
  id: number;
  lineNo: number;
  productId: number;
  productCode: string;
  productName: string;
  quantity: string;
  destinationLocationId: number | null;
  putAwayQuantity: string;
  batchId: number | null;
  batchNumber: string | null;
  serialNumbers: string[];
  notes: string | null;
}

export interface Putaway {
  id: number;
  putawayNumber: string;
  warehouseId: number;
  grnId: number | null;
  grnNumber: string | null;
  status: PutawayStatus;
  notes: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  items: PutawayItem[];
  warehouse?: { id: number; name: string; code: string };
}

export interface PutawaySource {
  id: number;
  grnNumber: string;
  warehouseId: number;
  vendorNameSnapshot: string;
}

export interface CreatePutawayInput {
  warehouseId: number;
  grnId?: number | undefined;
  notes?: string | undefined;
}
export interface RecordPutawayItemInput {
  quantity: number;
  destinationLocationId: number;
}
export interface AddPutawayLineInput {
  productId: number;
  quantity: number;
}

export interface MovementItem {
  id: number;
  lineNo: number;
  productId: number;
  productCode: string;
  productName: string;
  quantity: string;
  sourceLocationId: number;
  destinationLocationId: number;
  batchId: number | null;
  batchNumber: string | null;
  serialNumbers: string[];
}

export interface WarehouseMovement {
  id: number;
  movementNumber: string;
  warehouseId: number;
  status: MovementStatus;
  requestedBy: number | null;
  approvedBy: number | null;
  approvedAt: string | null;
  notes: string | null;
  createdAt: string;
  completedAt: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  items: MovementItem[];
  warehouse?: { id: number; name: string; code: string };
}

export interface CreateMovementInput {
  warehouseId: number;
  items: {
    productId: number;
    quantity: number;
    sourceLocationId: number;
    destinationLocationId: number;
  }[];
  notes?: string | undefined;
}

export interface LocationStockRow {
  id: number;
  productId: number;
  warehouseId: number;
  locationId: number;
  quantity: string;
  updatedAt: string;
  product: { id: number; productCode: string; name: string };
  warehouse: { id: number; name: string; code: string };
  location: { id: number; binCode: string; locationCode: string | null };
}

export interface WarehouseOpsDashboard {
  putawayByStatus: Record<string, number>;
  movementByStatus: Record<string, number>;
  activeWarehouses: number;
  activeLocations: number;
  occupiedLocations: number;
}

/** One row of the Warehouse Stock page: stock in a bin, or a warehouse's
 * unassigned remainder (`locationId` null). */
export interface WarehouseStockViewRow {
  warehouseId: number;
  warehouseName: string;
  warehouseCode: string;
  locationId: number | null;
  locationCode: string;
  locationName: string | null;
  productId: number;
  productCode: string;
  productName: string;
  quantity: number;
}

export interface StockWriteOffInput {
  productId: number;
  warehouseId: number;
  locationId?: number | undefined;
  quantity: number;
  notes?: string | undefined;
}
