// Read-only data context for the SCM AI Copilot. This deliberately introduces no new Firebase
// path and no second data pipeline: it reuses `useScmReportsData` (the one hook every SCM
// Reports page already shares) for the raw records, and the exact same domain calculation
// functions the Reports module uses for every KPI, so a number the Copilot states can never
// drift from what the matching report page shows (mirrors spec #40 in reportCalculations.ts).
import { useMemo } from "react";
import {
  useScmReportsData,
  type ScmReportsRawData,
} from "../reports/reportService";
import {
  computeSupplierReport,
  computeProcurementReport,
  computeInventoryReport,
  computeWarehouseReport,
  computeFulfillmentReport,
  computeLogisticsReport,
  computeReturnsReport,
  computeQualityReport,
  EMPTY_FILTERS,
  type ExecutiveSummary,
  type SupplierReportRow,
} from "../reports/reportCalculations";
import { presetRange } from "../reports/reportHelpers";
import { getSupplierStatus } from "../suppliers/supplierHelpers";

// Unbounded lower date, "today" upper date — every real record in the app is on or before
// today, so this behaves as "all time" while still using the same `DateRange`/`inRange`
// machinery every report already relies on (no separate "no filter" code path to drift).
const ALL_TIME = presetRange("custom");

export interface ScmAiComputed {
  summary: ExecutiveSummary;
  supplierRows: SupplierReportRow[];
  lowStockItems: ReturnType<typeof computeInventoryReport>["lowStockItems"];
  pendingReceipts: ReturnType<
    typeof computeProcurementReport
  >["pendingReceipts"];
  recentShipments: ReturnType<typeof computeLogisticsReport>["recentShipments"];
  openExceptions: ReturnType<typeof computeLogisticsReport>["openExceptions"];
  recentFailures: ReturnType<typeof computeQualityReport>["recentFailures"];
}

export interface ScmAiContext {
  loading: boolean;
  error: string | null;
  data: ScmReportsRawData;
  computed: ScmAiComputed | null;
  supplierStatusCounts: Record<string, number>;
}

export function useScmAiContext(): ScmAiContext {
  const { loading, error, data } = useScmReportsData();

  const computed = useMemo<ScmAiComputed | null>(() => {
    if (loading) return null;
    const procurement = computeProcurementReport(data, ALL_TIME, EMPTY_FILTERS);
    const inventory = computeInventoryReport(data, ALL_TIME, EMPTY_FILTERS);
    const warehouse = computeWarehouseReport(data, ALL_TIME, EMPTY_FILTERS);
    const fulfillment = computeFulfillmentReport(data, ALL_TIME, EMPTY_FILTERS);
    const logistics = computeLogisticsReport(data, ALL_TIME, EMPTY_FILTERS);
    const returns = computeReturnsReport(data, ALL_TIME, EMPTY_FILTERS);
    const quality = computeQualityReport(data, ALL_TIME, EMPTY_FILTERS);
    const supplier = computeSupplierReport(data, ALL_TIME, EMPTY_FILTERS);
    return {
      summary: {
        procurement: procurement.kpis,
        inventory: inventory.kpis,
        warehouse: warehouse.kpis,
        fulfillment: fulfillment.kpis,
        logistics: logistics.kpis,
        returns: returns.kpis,
        quality: quality.kpis,
      },
      supplierRows: supplier.rows,
      lowStockItems: inventory.lowStockItems,
      pendingReceipts: procurement.pendingReceipts,
      recentShipments: logistics.recentShipments,
      openExceptions: logistics.openExceptions,
      recentFailures: quality.recentFailures,
    };
  }, [data, loading]);

  const supplierStatusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const v of data.vendors) {
      const status = getSupplierStatus(v);
      counts[status] = (counts[status] || 0) + 1;
    }
    return counts;
  }, [data.vendors]);

  // Memoized so the returned object is reference-stable whenever nothing actually changed —
  // `data`/`computed`/`supplierStatusCounts` are themselves already memoized/stable refs, so
  // this only produces a new object when a real value changes. Callers (the chat panel's data
  // bridge) key a `useEffect` off this object, and without this memo a fresh literal on every
  // render would re-fire that effect forever.
  return useMemo(
    () => ({ loading, error, data, computed, supplierStatusCounts }),
    [loading, error, data, computed, supplierStatusCounts],
  );
}
