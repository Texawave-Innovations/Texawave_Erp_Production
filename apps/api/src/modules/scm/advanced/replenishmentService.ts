// Deterministic replenishment recommendations — no AI, no demand prediction. Every number is
// read from a `StockBalance`/`InventorySettings` record or averaged from actual `SALES_ISSUE`
// ledger entries. Without enough ledger history to trust an average, the recommendation says so.
import type { ScmReportsRawData } from "../reports/reportService";
import { OVERSTOCK_MULTIPLE } from "../shared/businessRules";
import { MS_PER_DAY } from "../shared/format";
import { replenishmentKey } from "./advancedPaths";
import type { ReplenishmentRecommendation } from "./advancedTypes";

/** Consumption is averaged over this trailing window... */
const CONSUMPTION_LOOKBACK_DAYS = 30;
/** ...but only trusted once the product+warehouse has at least this many days of ledger history. */
const MIN_HISTORY_DAYS_FOR_AVERAGE = 14;
/** "Reorder Now" target: replenish up to this many days of cover (shown verbatim in the UI). */
const TARGET_COVER_DAYS = 30;
/** Averages are rounded so a recomputation with unchanged data never looks like a change. */
const ROUNDING_FACTOR = 100;

const round = (n: number) => Math.round(n * ROUNDING_FACTOR) / ROUNDING_FACTOR;

interface LedgerSummary {
  earliest: number;
  issuedInWindow: number;
}

/** One pass over the ledger: earliest entry and in-window sales issues per product+warehouse. */
function summarizeLedger(
  ledger: ScmReportsRawData["stockLedger"],
  windowStart: number,
): Map<string, LedgerSummary> {
  const byKey = new Map<string, LedgerSummary>();
  for (const e of ledger) {
    const key = replenishmentKey(e.productCode, e.warehouseId);
    let summary = byKey.get(key);
    if (!summary) {
      summary = { earliest: e.transactionDate, issuedInWindow: 0 };
      byKey.set(key, summary);
    } else if (e.transactionDate < summary.earliest) {
      summary.earliest = e.transactionDate;
    }
    if (e.transactionType === "SALES_ISSUE" && e.transactionDate >= windowStart)
      summary.issuedInWindow += e.quantityOut || 0;
  }
  return byKey;
}

function avgDailyConsumption(
  summary: LedgerSummary | undefined,
  now: number,
): number | null {
  if (!summary) return null;
  const historyDays = (now - summary.earliest) / MS_PER_DAY;
  if (historyDays < MIN_HISTORY_DAYS_FOR_AVERAGE) return null;
  return round(
    summary.issuedInWindow / Math.min(CONSUMPTION_LOOKBACK_DAYS, historyDays),
  );
}

/** One recommendation per product+warehouse stock-balance row. Pure. */
export function computeReplenishmentRecommendations(
  data: ScmReportsRawData,
  now = Date.now(),
): ReplenishmentRecommendation[] {
  const productByCode = new Map(data.products.map((p) => [p.productCode, p]));
  const settingsByCode = new Map(
    data.inventorySettings.map((s) => [s.productCode, s]),
  );
  const warehouseById = new Map(data.warehouses.map((w) => [w.id, w]));
  const ledgerByKey = summarizeLedger(
    data.stockLedger,
    now - CONSUMPTION_LOOKBACK_DAYS * MS_PER_DAY,
  );

  return data.stockBalances.map((b): ReplenishmentRecommendation => {
    const id = replenishmentKey(b.productCode, b.warehouseId);
    const available = b.available ?? (b.onHand || 0) - (b.reserved || 0);
    const reorderLevel =
      settingsByCode.get(b.productCode)?.reorderLevel ?? null;
    const avgDaily = avgDailyConsumption(ledgerByKey.get(id), now);
    const daysOfCover =
      avgDaily && avgDaily > 0 ? round(available / avgDaily) : null;

    let status: ReplenishmentRecommendation["status"];
    let reason: string;
    let suggestedReorderQty: number | null = null;

    if (reorderLevel == null) {
      status = "No Recommendation";
      reason =
        "No reorder level is configured for this product — set one in Inventory Settings to enable recommendations.";
    } else if (available <= reorderLevel) {
      status = "Reorder Now";
      reason = `Available stock (${available}) is at or below the configured reorder threshold (${reorderLevel}).`;
      if (avgDaily != null && avgDaily > 0) {
        suggestedReorderQty = Math.max(
          0,
          Math.ceil(avgDaily * TARGET_COVER_DAYS - available),
        );
        reason += ` Suggested quantity covers ${TARGET_COVER_DAYS} days at the recent average consumption of ${avgDaily.toFixed(2)}/day.`;
      } else {
        reason +=
          " Insufficient historical data to size a suggested quantity — review manually.";
      }
    } else if (
      reorderLevel > 0 &&
      available > reorderLevel * OVERSTOCK_MULTIPLE
    ) {
      status = "Overstock";
      reason = `Available stock (${available}) is more than ${OVERSTOCK_MULTIPLE}x the reorder threshold (${reorderLevel}).`;
    } else if (avgDaily == null) {
      status = "No Recommendation";
      reason = "Insufficient historical data.";
    } else {
      status = "Monitor";
      reason = `Available stock (${available}) is above the reorder threshold (${reorderLevel}); no action needed yet.`;
    }

    return {
      id,
      productCode: b.productCode,
      productName:
        productByCode.get(b.productCode)?.name ||
        b.productName ||
        b.productCode,
      warehouseId: b.warehouseId,
      warehouseName:
        warehouseById.get(b.warehouseId)?.name || "Unknown warehouse",
      availableStock: available,
      onHand: b.onHand || 0,
      reorderLevel,
      avgDailyConsumption: avgDaily,
      daysOfCover,
      suggestedReorderQty,
      status,
      reason,
    };
  });
}
