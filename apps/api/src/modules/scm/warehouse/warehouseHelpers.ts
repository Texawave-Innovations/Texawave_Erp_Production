import { useCallback, useEffect, useState } from "react";
import {
  getAllRecords,
  updateRecord,
  getRecordsWhere,
} from "@/services/firebase";
import { INVENTORY_PATHS } from "../inventory/inventoryPaths";
import {
  getSellableProducts,
  type SellableProduct,
} from "../inventory/productCatalog";
import { WAREHOUSE_PATHS } from "./warehousePaths";
import type {
  PackStatus,
  PickStatus,
  PutawayStatus,
  WarehouseMovementStatus,
  SerialNumberRecord,
  StockBatch,
  Warehouse,
  WarehouseLocation,
  WarehousePutaway,
  WarehouseMovement,
  WarehousePicking,
  WarehousePacking,
} from "@/types";
import { errorMessage } from "@/modules/scm/shared/format";

export { ALL } from "@/modules/scm/shared/format";

/** Shared data loader for every WMS page — warehouses, the location hierarchy and the sellable
 * product catalog, loaded once instead of every page re-querying Firebase independently. */
export function useWarehouseMasters() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [locations, setLocations] = useState<WarehouseLocation[]>([]);
  const [products, setProducts] = useState<SellableProduct[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [w, l, p] = await Promise.all([
        getAllRecords(INVENTORY_PATHS.warehouses) as Promise<Warehouse[]>,
        getAllRecords(INVENTORY_PATHS.locations) as Promise<
          WarehouseLocation[]
        >,
        getSellableProducts(),
      ]);
      setWarehouses(w);
      setLocations(l.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)));
      setProducts(p);
    } catch (err: unknown) {
      setError(errorMessage(err, "Failed to load warehouse masters"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { loading, error, warehouses, locations, products, reload: load };
}

export function locationLabel(loc: WarehouseLocation | undefined): string {
  if (!loc) return "—";
  return loc.locationCode || loc.binCode || loc.locationName || loc.id;
}

/** Builds the hierarchy code from each level's structured code (never the descriptive name),
 * e.g. WH01-Z01-R03-S02-B05. Falls back to the flat zone/rack/shelf/binCode fields on a Phase 3
 * record that never got `parentLocationId` set. */
export function buildLocationCode(
  loc: Partial<WarehouseLocation>,
  warehouse: Warehouse | undefined,
  ancestors: WarehouseLocation[],
): string {
  const whPart = warehouse?.code || "WH";
  const chain = [...ancestors, loc]
    .map((l) => l?.binCode || "")
    .filter(Boolean);
  if (chain.length > 0) return [whPart, ...chain].join("-").toUpperCase();
  return [whPart, loc.zone, loc.rack, loc.shelf, loc.binCode]
    .filter(Boolean)
    .join("-")
    .toUpperCase();
}

/** Valid parent location types for each child location type — enforces the
 * Warehouse → Zone → Rack → Shelf → Bin hierarchy described in Phase 5. */
export const VALID_PARENT_TYPE: Record<
  "ZONE" | "RACK" | "SHELF" | "BIN",
  string | null
> = {
  ZONE: null, // parent is the warehouse itself
  RACK: "ZONE",
  SHELF: "RACK",
  BIN: "SHELF",
};

export type CapacityState =
  "Unconfigured" | "Available" | "Partially Occupied" | "Full";

export function capacityState(
  capacity: number | undefined,
  occupied: number,
): CapacityState {
  if (!capacity || capacity <= 0) return "Unconfigured";
  if (occupied <= 0) return "Available";
  if (occupied >= capacity) return "Full";
  return "Partially Occupied";
}

export const CAPACITY_TONE: Record<CapacityState, string> = {
  Unconfigured: "text-muted-foreground",
  Available: "text-emerald-600 border-emerald-200 bg-emerald-50",
  "Partially Occupied": "text-amber-600 border-amber-200 bg-amber-50",
  Full: "text-red-600 border-red-200 bg-red-50",
};

export const PUTAWAY_STATUS_TONE: Record<PutawayStatus, string> = {
  PENDING: "text-amber-600 border-amber-200 bg-amber-50",
  IN_PROGRESS: "text-sky-600 border-sky-200 bg-sky-50",
  COMPLETED: "text-emerald-600 border-emerald-200 bg-emerald-50",
  CANCELLED: "text-red-600 border-red-200 bg-red-50",
};

export const MOVEMENT_STATUS_TONE: Record<WarehouseMovementStatus, string> = {
  DRAFT: "text-slate-600 border-slate-200 bg-slate-50",
  REQUESTED: "text-amber-600 border-amber-200 bg-amber-50",
  APPROVED: "text-indigo-600 border-indigo-200 bg-indigo-50",
  IN_PROGRESS: "text-sky-600 border-sky-200 bg-sky-50",
  COMPLETED: "text-emerald-600 border-emerald-200 bg-emerald-50",
  CANCELLED: "text-red-600 border-red-200 bg-red-50",
};

export const PICK_STATUS_TONE: Record<PickStatus, string> = {
  PENDING: "text-slate-600 border-slate-200 bg-slate-50",
  ASSIGNED: "text-amber-600 border-amber-200 bg-amber-50",
  IN_PROGRESS: "text-sky-600 border-sky-200 bg-sky-50",
  PARTIALLY_PICKED: "text-purple-600 border-purple-200 bg-purple-50",
  COMPLETED: "text-emerald-600 border-emerald-200 bg-emerald-50",
  CANCELLED: "text-red-600 border-red-200 bg-red-50",
};

export const PACK_STATUS_TONE: Record<PackStatus, string> = {
  PENDING: "text-slate-600 border-slate-200 bg-slate-50",
  IN_PROGRESS: "text-sky-600 border-sky-200 bg-sky-50",
  PACKED: "text-emerald-600 border-emerald-200 bg-emerald-50",
  CANCELLED: "text-red-600 border-red-200 bg-red-50",
};

/** Derives on-hand quantity per product/warehouse/location purely from completed putaway,
 * movement and picking documents — there is no separate location-level balance table, so this
 * stays a read-time projection instead of a second source of truth competing with the stock
 * ledger (which remains authoritative for total on-hand per product/warehouse).
 *
 * Picked units leave their bin when the stock is issued (`stockIssuedAt`, set when the
 * fulfillment's SALES_ISSUE posts), the same moment on-hand drops — so bin totals and on-hand
 * never drift apart while a pick waits for packing, and a cancelled fulfillment's picks put
 * nothing back because nothing was taken. Legacy picks with no fulfillment count at completion.
 * A pick with no source bin took unassigned stock: no bin changes, and the "Unassigned"
 * residual (on-hand minus bin totals) shrinks by itself as on-hand drops. */
export function computeLocationStock(
  putaways: WarehousePutaway[],
  movements: WarehouseMovement[],
  pickings: WarehousePicking[],
): Map<string, number> {
  const key = (productCode: string, warehouseId: string, locationId: string) =>
    `${productCode}__${warehouseId}__${locationId}`;
  const map = new Map<string, number>();
  const add = (k: string, delta: number) =>
    map.set(k, (map.get(k) || 0) + delta);

  for (const p of putaways) {
    if (p.status !== "COMPLETED") continue;
    for (const item of p.items) {
      add(
        key(item.productCode, p.warehouseId, item.destinationLocationId),
        item.quantity,
      );
    }
  }
  for (const m of movements) {
    if (m.status !== "COMPLETED") continue;
    for (const item of m.items) {
      add(
        key(item.productCode, m.warehouseId, m.sourceLocationId),
        -item.quantity,
      );
      add(
        key(item.productCode, m.warehouseId, m.destinationLocationId),
        item.quantity,
      );
    }
  }
  for (const pk of pickings) {
    const issued = pk.fulfillmentId
      ? !!pk.stockIssuedAt && pk.status !== "CANCELLED"
      : pk.status === "COMPLETED" || pk.status === "PARTIALLY_PICKED";
    if (!issued) continue;
    for (const item of pk.items) {
      if (!item.sourceLocationId || item.pickedQuantity <= 0) continue;
      add(
        key(item.productCode, pk.warehouseId, item.sourceLocationId),
        -item.pickedQuantity,
      );
    }
  }
  return map;
}

/** Total occupancy of one bin across every product. */
export function binOccupancy(
  stock: Map<string, number>,
  warehouseId: string,
  locationId: string,
): number {
  const suffix = `__${warehouseId}__${locationId}`;
  let total = 0;
  for (const [key, qty] of stock)
    if (key.endsWith(suffix)) total += Math.max(0, qty);
  return total;
}

/** Error message when adding `addQty` units would exceed the bin's capacity, else null. */
export function capacityError(
  loc: WarehouseLocation | undefined,
  stock: Map<string, number>,
  addQty: number,
): string | null {
  if (!loc?.capacity) return null;
  const occupied = binOccupancy(stock, loc.warehouseId, loc.id);
  return occupied + addQty > loc.capacity
    ? `${locationLabel(loc)} is at capacity (${occupied}/${loc.capacity} ${loc.capacityUnit || ""}) — cannot fit ${addQty} more`
    : null;
}

interface TrackedStockMove {
  productCode: string;
  warehouseId: string;
  quantity: number;
  toLocationId: string;
  /** Source bin; when omitted (put-away from receiving) the batch is matched by number only. */
  fromLocationId?: string;
  batchNumber?: string;
  serialNumbers?: string[];
}

/**
 * Carries batch/serial `locationId` along with a put-away or bin movement. A batch record has a
 * single location, so it only moves when the whole batch quantity moves; a partial move leaves it
 * where it is and returns a note for the operator. Named serials move individually; without
 * names, up to `quantity` available serials at the source bin move. Returns notes, never throws
 * for a partial match.
 */
export async function relocateTrackedStock(
  move: TrackedStockMove,
): Promise<string[]> {
  const notes: string[] = [];
  const [batches, serials] = await Promise.all([
    getRecordsWhere<StockBatch>(
      INVENTORY_PATHS.batches,
      "productCode",
      move.productCode,
    ),
    getRecordsWhere<SerialNumberRecord>(
      INVENTORY_PATHS.serials,
      "productCode",
      move.productCode,
    ),
  ]);

  const candidates = batches.filter(
    (b) =>
      b.warehouseId === move.warehouseId &&
      (move.batchNumber
        ? b.batchNumber === move.batchNumber
        : b.locationId === move.fromLocationId),
  );
  if (candidates.length === 1) {
    const batch = candidates[0];
    if (move.quantity >= (batch.quantity || 0)) {
      await updateRecord(INVENTORY_PATHS.batches, batch.id, {
        locationId: move.toLocationId,
      });
    } else {
      notes.push(
        `Batch ${batch.batchNumber} only partly moved (${move.quantity}/${batch.quantity}) — its location was left unchanged.`,
      );
    }
  } else if (candidates.length > 1 && !move.batchNumber) {
    notes.push(
      `${move.productCode}: several batches at the source bin — batch locations were left unchanged.`,
    );
  }

  const toMove = move.serialNumbers?.length
    ? serials.filter(
        (s) =>
          move.serialNumbers?.includes(s.serialNumber) &&
          s.warehouseId === move.warehouseId,
      )
    : serials
        .filter(
          (s) =>
            s.warehouseId === move.warehouseId &&
            s.locationId === move.fromLocationId &&
            s.status === "AVAILABLE",
        )
        .slice(0, move.quantity);
  for (const s of toMove)
    await updateRecord(INVENTORY_PATHS.serials, s.id, {
      locationId: move.toLocationId,
    });
  return notes;
}

/** Shared loader for the four Phase 5 transactional collections, used by the dashboard,
 * stock view, activity and every operations workspace. */
export function useWarehouseOperations() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [putaways, setPutaways] = useState<WarehousePutaway[]>([]);
  const [movements, setMovements] = useState<WarehouseMovement[]>([]);
  const [pickings, setPickings] = useState<WarehousePicking[]>([]);
  const [packings, setPackings] = useState<WarehousePacking[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [pu, mv, pk, pc] = await Promise.all([
        getAllRecords(WAREHOUSE_PATHS.putaways) as Promise<WarehousePutaway[]>,
        getAllRecords(WAREHOUSE_PATHS.movements) as Promise<
          WarehouseMovement[]
        >,
        getAllRecords(WAREHOUSE_PATHS.pickings) as Promise<WarehousePicking[]>,
        getAllRecords(WAREHOUSE_PATHS.packings) as Promise<WarehousePacking[]>,
      ]);
      const newestFirst = <T extends { createdAt?: number }>(rows: T[]) =>
        rows.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setPutaways(newestFirst(pu));
      setMovements(newestFirst(mv));
      setPickings(newestFirst(pk));
      setPackings(newestFirst(pc));
    } catch (err: unknown) {
      setError(errorMessage(err, "Failed to load warehouse operations"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return {
    loading,
    error,
    putaways,
    movements,
    pickings,
    packings,
    reload: load,
  };
}
