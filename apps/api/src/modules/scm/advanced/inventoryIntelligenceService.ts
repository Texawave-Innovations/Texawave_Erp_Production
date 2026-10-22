// Deterministic inventory intelligence — spec's "Inventory Intelligence" page. Reuses
// `computeInventoryReport` (Phase 10) for every KPI/chart it already produces (stock health,
// value, category mix, low/out-of-stock, movement trend) instead of re-deriving them, and adds
// only what that report doesn't already expose: an overstock list, a warehouse-wise status
// breakdown, and fast/slow-moving + dead-stock detection from actual ledger history.
import {
  buildInventoryRows,
  computeInventoryReport,
  EMPTY_FILTERS,
  type InventoryReportData,
  type InventoryReportRow,
} from "../reports/calculations";
import { presetRange } from "../reports/reportHelpers";
import type { ScmReportsRawData } from "../reports/reportService";
import { MS_PER_DAY } from "../shared/format";

/** Outbound movement is summed over this trailing window to classify fast/slow movers... */
const MOVEMENT_LOOKBACK_DAYS = 90;
/** ...but only for a product+warehouse whose ledger history spans the full window — otherwise
 * "zero outbound" would label a brand-new SKU as dead stock. */
const MIN_HISTORY_DAYS_FOR_MOVEMENT = 90;
const TOP_N = 10;
const DEAD_STOCK_LIMIT = TOP_N * 2;

export interface WarehouseStockHealth {
  warehouseId: string;
  warehouseName: string;
  totalSkus: number;
  healthy: number;
  lowStock: number;
  outOfStock: number;
  overstock: number;
}

export interface MovementStat {
  productCode: string;
  productName: string;
  warehouseId: string;
  warehouseName: string;
  outboundQty: number;
}

export interface MovementIntelligence {
  fastMoving: MovementStat[];
  slowMoving: MovementStat[];
  deadStock: MovementStat[];
  /** True when there isn't enough overall ledger history yet to trust any of the three lists
   * above — shown to the user as "Insufficient data" rather than an empty/misleading list. */
  insufficientData: boolean;
  lookbackDays: number;
}

function computeMovementIntelligence(
  data: ScmReportsRawData,
  now = Date.now(),
): MovementIntelligence {
  const windowStart = now - MOVEMENT_LOOKBACK_DAYS * MS_PER_DAY;
  const warehouseById = new Map(data.warehouses.map((w) => [w.id, w]));
  const productByCode = new Map(data.products.map((p) => [p.productCode, p]));

  // Earliest ledger entry per product+warehouse — used to decide whether that row's history is
  // long enough to trust for this window.
  const earliestByKey = new Map<string, number>();
  const outboundByKey = new Map<string, number>();
  for (const e of data.stockLedger) {
    const key = `${e.productCode}__${e.warehouseId}`;
    const prevEarliest = earliestByKey.get(key);
    if (prevEarliest == null || e.transactionDate < prevEarliest)
      earliestByKey.set(key, e.transactionDate);
    if (
      e.transactionType === "SALES_ISSUE" &&
      e.transactionDate >= windowStart
    ) {
      outboundByKey.set(
        key,
        (outboundByKey.get(key) || 0) + (e.quantityOut || 0),
      );
    }
  }

  if (data.stockLedger.length === 0) {
    return {
      fastMoving: [],
      slowMoving: [],
      deadStock: [],
      insufficientData: true,
      lookbackDays: MOVEMENT_LOOKBACK_DAYS,
    };
  }

  const stats: MovementStat[] = [];
  const dead: MovementStat[] = [];
  for (const b of data.stockBalances) {
    const key = `${b.productCode}__${b.warehouseId}`;
    const earliest = earliestByKey.get(key);
    const historyDays = earliest != null ? (now - earliest) / MS_PER_DAY : 0;
    if (historyDays < MIN_HISTORY_DAYS_FOR_MOVEMENT) continue; // not enough history for this specific SKU/warehouse — skip rather than guess
    const outboundQty = outboundByKey.get(key) || 0;
    const stat: MovementStat = {
      productCode: b.productCode,
      productName:
        productByCode.get(b.productCode)?.name ||
        b.productName ||
        b.productCode,
      warehouseId: b.warehouseId,
      warehouseName:
        warehouseById.get(b.warehouseId)?.name || "Unknown warehouse",
      outboundQty,
    };
    if ((b.onHand || 0) > 0 && outboundQty === 0) dead.push(stat);
    else if (outboundQty > 0) stats.push(stat);
  }

  const fastMoving = [...stats]
    .sort((a, b) => b.outboundQty - a.outboundQty)
    .slice(0, TOP_N);
  const slowMoving = [...stats]
    .sort((a, b) => a.outboundQty - b.outboundQty)
    .slice(0, TOP_N);

  return {
    fastMoving,
    slowMoving,
    deadStock: dead.slice(0, DEAD_STOCK_LIMIT),
    insufficientData: stats.length === 0 && dead.length === 0,
    lookbackDays: MOVEMENT_LOOKBACK_DAYS,
  };
}

function computeWarehouseHealth(
  rows: InventoryReportRow[],
  data: ScmReportsRawData,
): WarehouseStockHealth[] {
  const byWarehouse = new Map<string, WarehouseStockHealth>();
  for (const r of rows) {
    if (!byWarehouse.has(r.warehouseId)) {
      byWarehouse.set(r.warehouseId, {
        warehouseId: r.warehouseId,
        warehouseName: r.warehouseName,
        totalSkus: 0,
        healthy: 0,
        lowStock: 0,
        outOfStock: 0,
        overstock: 0,
      });
    }
    const entry = byWarehouse.get(r.warehouseId)!;
    entry.totalSkus += 1;
    if (r.status === "Healthy") entry.healthy += 1;
    else if (r.status === "Low Stock") entry.lowStock += 1;
    else if (r.status === "Out of Stock") entry.outOfStock += 1;
    else if (r.status === "Overstock") entry.overstock += 1;
  }
  // Include active warehouses with zero balance rows too, so an empty warehouse is visible
  // rather than silently missing from the breakdown.
  for (const w of data.warehouses) {
    if (w.status === "Active" && !byWarehouse.has(w.id)) {
      byWarehouse.set(w.id, {
        warehouseId: w.id,
        warehouseName: w.name,
        totalSkus: 0,
        healthy: 0,
        lowStock: 0,
        outOfStock: 0,
        overstock: 0,
      });
    }
  }
  return Array.from(byWarehouse.values()).sort((a, b) =>
    a.warehouseName.localeCompare(b.warehouseName),
  );
}

export interface InventoryIntelligenceData {
  report: InventoryReportData;
  overstockItems: InventoryReportRow[];
  warehouseHealth: WarehouseStockHealth[];
  movement: MovementIntelligence;
}

/** Single entry point for the Inventory Intelligence page — everything it needs, derived from
 * the one shared `ScmReportsRawData` load. */
export function computeInventoryIntelligence(
  data: ScmReportsRawData,
  now = Date.now(),
): InventoryIntelligenceData {
  const range = presetRange("90d");
  const report = computeInventoryReport(data, range, EMPTY_FILTERS);
  const allRows = buildInventoryRows(data);
  const overstockItems = allRows
    .filter((r) => r.status === "Overstock")
    .sort((a, b) => b.available - a.available);

  return {
    report,
    overstockItems,
    warehouseHealth: computeWarehouseHealth(allRows, data),
    movement: computeMovementIntelligence(data, now),
  };
}
