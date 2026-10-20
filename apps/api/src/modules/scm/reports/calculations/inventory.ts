import type {
  InventorySettings,
  StockBalance,
  StockLedgerEntry,
  Warehouse,
} from "@/types";
import type { SellableProduct } from "../../inventory/productCatalog";
import { stockValue } from "../../shared/businessRules";
import { ALL } from "../../shared/format";
import {
  type DateRange,
  type Granularity,
  bucketSeriesByPeriod,
  groupBy,
  inRange,
  pickGranularity,
} from "../reportHelpers";
import {
  type InventoryRowWithStatus,
  type ReportFilters,
  type Series,
  buildInventoryRows,
  matchProduct,
  matchWarehouse,
  withKeyLabels,
} from "./shared";

const LOW_STOCK_LIMIT = 25;
const TOP_STOCKED_LIMIT = 10;

/** One stock-balance row as shown by the inventory reports (status computed once). */
export type InventoryReportRow = InventoryRowWithStatus;

export interface InventoryInput {
  stockBalances: StockBalance[];
  products: SellableProduct[];
  warehouses: Warehouse[];
  inventorySettings: InventorySettings[];
  stockLedger: StockLedgerEntry[];
}

export interface InventoryKpis {
  totalSKUs: number;
  totalUnits: number;
  inventoryValue: number | null;
  valuedSkuCount: number;
  totalSkuCount: number;
  available: number;
  reserved: number;
  incoming: number;
  damaged: number;
  lowStockCount: number;
  outOfStockCount: number;
}

export interface MovementTrendPoint {
  period: string;
  label: string;
  Inbound: number;
  Outbound: number;
  Transfers: number;
  Returns: number;
  Adjustments: number;
  Damage: number;
  Quarantine: number;
}

export interface InventoryReportData {
  kpis: InventoryKpis;
  valueByWarehouse: Series[] | null;
  stockByCategory: Series[];
  movementTrend: MovementTrendPoint[];
  reservationVsAvailable: Series[];
  lowStockItems: InventoryReportRow[];
  topStockedProducts: InventoryReportRow[];
}

/** Rows after the warehouse/product/status filters. Status (Healthy/Low/Out/Overstock) uses the
 * inventory domain's `computeStockStatus`, so counts always match the Stock Overview. */
function selectInventoryRows(
  input: InventoryInput,
  filters: ReportFilters,
): InventoryReportRow[] {
  return buildInventoryRows(input).filter(
    (r) =>
      matchWarehouse(r.warehouseId, filters) &&
      matchProduct(r.productCode, filters) &&
      (filters.status === ALL || r.status === filters.status),
  );
}

const sum = (
  rows: InventoryReportRow[],
  pick: (r: InventoryReportRow) => number,
) => rows.reduce((s, r) => s + pick(r), 0);

function inventoryKpis(rows: InventoryReportRow[]): InventoryKpis {
  const costed = rows.filter((r) => r.costPrice != null);
  return {
    totalSKUs: new Set(rows.map((r) => r.productCode)).size,
    totalUnits: sum(rows, (r) => r.onHand),
    inventoryValue:
      costed.length > 0
        ? sum(costed, (r) => stockValue(r.onHand, r.costPrice))
        : null,
    valuedSkuCount: costed.length,
    totalSkuCount: rows.length,
    available: sum(rows, (r) => r.available),
    reserved: sum(rows, (r) => r.reserved),
    incoming: sum(rows, (r) => r.incoming),
    damaged: sum(rows, (r) => r.damaged),
    lowStockCount: rows.filter((r) => r.status === "Low Stock").length,
    outOfStockCount: rows.filter((r) => r.status === "Out of Stock").length,
  };
}

export function computeInventoryKpis(
  input: InventoryInput,
  filters: ReportFilters,
): InventoryKpis {
  return inventoryKpis(selectInventoryRows(input, filters));
}

export function computeInventoryReport(
  input: InventoryInput,
  range: DateRange,
  filters: ReportFilters,
): InventoryReportData {
  const rows = selectInventoryRows(input, filters);
  const kpis = inventoryKpis(rows);
  const costed = rows.filter((r) => r.costPrice != null);

  const ledger = input.stockLedger.filter(
    (e) =>
      inRange(e.transactionDate, range) &&
      matchWarehouse(e.warehouseId, filters) &&
      matchProduct(e.productCode, filters),
  );

  return {
    kpis,
    valueByWarehouse:
      costed.length > 0
        ? withKeyLabels(
            groupBy(
              costed,
              (r) => r.warehouseName,
              (r) => stockValue(r.onHand, r.costPrice),
            ),
          )
        : null,
    stockByCategory: withKeyLabels(
      groupBy(
        rows,
        (r) => r.category || "Uncategorized",
        (r) => r.onHand,
      ),
    ),
    movementTrend: bucketMovementTrend(ledger, pickGranularity(range)),
    reservationVsAvailable: [
      {
        key: "available",
        label: "Available",
        value: Math.max(0, kpis.available),
      },
      { key: "reserved", label: "Reserved", value: kpis.reserved },
    ],
    lowStockItems: rows
      .filter((r) => r.status === "Low Stock")
      .sort((a, b) => a.available - b.available)
      .slice(0, LOW_STOCK_LIMIT),
    topStockedProducts: [...rows]
      .sort((a, b) => b.onHand - a.onHand)
      .slice(0, TOP_STOCKED_LIMIT),
  };
}

const INBOUND_TYPES = new Set([
  "PURCHASE_RECEIPT",
  "OPENING_BALANCE",
  "QC_RELEASE",
]);
const ADJUST_TYPES = new Set(["ADJUSTMENT_IN", "ADJUSTMENT_OUT"]);

type MovementSeries = Omit<MovementTrendPoint, "period" | "label">;

function addMovement(b: MovementSeries, e: StockLedgerEntry) {
  const t = e.transactionType;
  const qIn = e.quantityIn || 0;
  const qOut = e.quantityOut || 0;
  if (INBOUND_TYPES.has(t)) b.Inbound += qIn;
  else if (t === "SALES_ISSUE") b.Outbound += qOut;
  else if (t === "TRANSFER_IN" || t === "TRANSFER_OUT")
    b.Transfers += qIn + qOut;
  else if (t === "SALES_RETURN") b.Returns += qIn;
  else if (t === "PURCHASE_RETURN") b.Returns += qOut;
  else if (ADJUST_TYPES.has(t)) b.Adjustments += qIn + qOut;
  else if (t === "DAMAGE") b.Damage += qOut;
  else if (t === "QUARANTINE" || t === "QC_REJECT") b.Quarantine += qOut;
}

function bucketMovementTrend(
  ledger: StockLedgerEntry[],
  granularity: Granularity,
): MovementTrendPoint[] {
  return bucketSeriesByPeriod(
    ledger,
    (e) => e.transactionDate,
    granularity,
    (): MovementSeries => ({
      Inbound: 0,
      Outbound: 0,
      Transfers: 0,
      Returns: 0,
      Adjustments: 0,
      Damage: 0,
      Quarantine: 0,
    }),
    addMovement,
  );
}
