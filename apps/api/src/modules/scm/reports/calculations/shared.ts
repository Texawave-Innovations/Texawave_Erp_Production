// Filters, lookups and small helpers shared by every per-domain report calculation. Nothing in
// `calculations/` reads or writes Firebase, and nothing mutates its inputs.
import {
  buildInventoryRow,
  computeStockStatus,
  type InventoryRow,
  type StockStatus,
} from "../../inventory/useInventoryData";
import type { SellableProduct } from "../../inventory/productCatalog";
import { ALL } from "../../shared/format";
import type {
  InventorySettings,
  StockBalance,
  Vendor,
  Warehouse,
  WarehouseMovement,
  WarehousePicking,
  WarehousePutaway,
} from "@/types";

/** Filters shared by every report page's filter bar. Not every report honors every field —
 * each domain function documents which ones it applies and to which date field. */
export interface ReportFilters {
  warehouseId: string;
  vendorId: string;
  productCode: string;
  status: string;
}

export const EMPTY_FILTERS: ReportFilters = {
  warehouseId: ALL,
  vendorId: ALL,
  productCode: ALL,
  status: ALL,
};

export interface Series {
  key: string;
  label: string;
  value: number;
}
export interface TimePoint {
  period: string;
  label: string;
  value: number;
}

export const matchWarehouse = (id: string | undefined, f: ReportFilters) =>
  f.warehouseId === ALL || id === f.warehouseId;
export const matchVendor = (id: string | undefined, f: ReportFilters) =>
  f.vendorId === ALL || id === f.vendorId;
export const matchProduct = (code: string | undefined, f: ReportFilters) =>
  f.productCode === ALL || code === f.productCode;
export const matchStatus = (status: string | undefined, f: ReportFilters) =>
  f.status === ALL || status === f.status;

/** For documents that hold a product only inside a line-items array — true when the product
 * filter is off, or at least one line matches it. */
export const matchProductInItems = <T extends { productCode?: string }>(
  items: T[],
  f: ReportFilters,
) =>
  f.productCode === ALL || items.some((i) => i.productCode === f.productCode);

/** `status` key → "Partially Received"-style label for chart series. */
export const withStatusLabels = (
  series: Array<{ key: string; value: number }>,
): Series[] => series.map((g) => ({ ...g, label: g.key.replace(/_/g, " ") }));

export const withKeyLabels = (
  series: Array<{ key: string; value: number }>,
): Series[] => series.map((g) => ({ ...g, label: g.key }));

export function vendorName(
  vendors: Vendor[],
  id: string | undefined,
  fallback?: string,
): string {
  return (
    fallback ||
    vendors.find((v) => v.id === id)?.companyName ||
    id ||
    "Unknown supplier"
  );
}

/** Warehouse display name from a pre-built id → warehouse map. */
export function warehouseName(
  warehouseById: Map<string, Warehouse>,
  id: string | undefined,
): string | undefined {
  return id ? warehouseById.get(id)?.name : undefined;
}

export type InventoryRowWithStatus = InventoryRow & { status: StockStatus };

/** Every stock balance as an `InventoryRow` (via the inventory domain's `buildInventoryRow`)
 * with its stock status computed exactly once. */
export function buildInventoryRows(input: {
  stockBalances: StockBalance[];
  products: SellableProduct[];
  inventorySettings: InventorySettings[];
  warehouses: Warehouse[];
}): InventoryRowWithStatus[] {
  const productByCode = new Map(input.products.map((p) => [p.productCode, p]));
  const settingsByCode = new Map(
    input.inventorySettings.map((s) => [s.productCode, s]),
  );
  const warehouseById = new Map(input.warehouses.map((w) => [w.id, w]));
  return input.stockBalances.map((b) => {
    const row = buildInventoryRow(
      b,
      productByCode.get(b.productCode),
      settingsByCode.get(b.productCode),
      warehouseById.get(b.warehouseId),
    );
    return { ...row, status: computeStockStatus(row) };
  });
}

/** Units currently occupying each location, from completed put-aways, movements and picks —
 * the same rules as the warehouse domain's `computeLocationStock`, keyed on structured fields
 * (never by splitting composite keys, which breaks on product codes containing `__`). Negative
 * per-product balances are clamped to zero before summing per location. */
export function computeOccupancyByLocation(
  putaways: WarehousePutaway[],
  movements: WarehouseMovement[],
  pickings: WarehousePicking[],
): Map<string, number> {
  const byLocation = new Map<string, Map<string, number>>();
  const add = (
    locationId: string | undefined,
    productCode: string,
    delta: number,
  ) => {
    if (!locationId) return;
    let products = byLocation.get(locationId);
    if (!products) {
      products = new Map();
      byLocation.set(locationId, products);
    }
    products.set(productCode, (products.get(productCode) || 0) + delta);
  };

  for (const p of putaways) {
    if (p.status !== "COMPLETED") continue;
    for (const item of p.items)
      add(item.destinationLocationId, item.productCode, item.quantity);
  }
  for (const m of movements) {
    if (m.status !== "COMPLETED") continue;
    for (const item of m.items) {
      add(m.sourceLocationId, item.productCode, -item.quantity);
      add(m.destinationLocationId, item.productCode, item.quantity);
    }
  }
  for (const pk of pickings) {
    if (pk.status !== "COMPLETED" && pk.status !== "PARTIALLY_PICKED") continue;
    for (const item of pk.items) {
      if (item.pickedQuantity > 0)
        add(item.sourceLocationId, item.productCode, -item.pickedQuantity);
    }
  }

  const occupied = new Map<string, number>();
  for (const [locationId, products] of byLocation) {
    let total = 0;
    for (const qty of products.values()) total += Math.max(0, qty);
    occupied.set(locationId, total);
  }
  return occupied;
}
