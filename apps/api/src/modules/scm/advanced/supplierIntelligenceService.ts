// Supplier performance intelligence — builds on the descriptive `computeSupplierReport` and adds
// transparent, documented rates only (no composite score):
//  - on-time receipt rate: posted GRNs received on or before their PO's expected delivery date;
//  - average fulfillment days: PO date → GRN receipt date (calendar days).
// Both use the same range/vendor-filtered, posted (non-draft, non-cancelled) GRNs as the report.
import {
  computeSupplierReport,
  EMPTY_FILTERS,
  selectSupplierGrns,
  type ReportFilters,
  type SupplierReportData,
  type SupplierReportRow,
} from "../reports/calculations";
import {
  average,
  safeRatePercent,
  type DateRange,
} from "../reports/reportHelpers";
import type { ScmReportsRawData } from "../reports/reportService";
import { daysBetween, parseLocalDate } from "../shared/format";
import type { GoodsReceipt } from "@/types";

export interface SupplierIntelligenceRow extends SupplierReportRow {
  onTimeReceiptCount: number;
  delayedReceiptCount: number;
  partialReceiptCount: number;
  /** `onTime / (onTime + delayed) * 100` — `null` below `MIN_SAMPLES_FOR_RATE` comparable receipts. */
  onTimeRatePercent: number | null;
  /** Average calendar days from PO date to GRN receipt date — `null` below `MIN_SAMPLES_FOR_RATE`. */
  avgFulfillmentDays: number | null;
}

const MIN_SAMPLES_FOR_RATE = 3;

export function computeSupplierIntelligence(
  data: ScmReportsRawData,
  range: DateRange,
  filters: ReportFilters = EMPTY_FILTERS,
): { kpis: SupplierReportData["kpis"]; rows: SupplierIntelligenceRow[] } {
  const base = computeSupplierReport(data, range, filters);
  const poById = new Map(data.purchaseOrders.map((p) => [p.id, p]));

  const grnsByVendor = new Map<string, GoodsReceipt[]>();
  for (const g of selectSupplierGrns(data.grns, range, filters)) {
    const list = grnsByVendor.get(g.vendorId);
    if (list) list.push(g);
    else grnsByVendor.set(g.vendorId, [g]);
  }

  const rows = base.rows.map((row): SupplierIntelligenceRow => {
    let onTime = 0;
    let delayed = 0;
    let partial = 0;
    const fulfillmentDays: number[] = [];

    for (const g of grnsByVendor.get(row.vendorId) || []) {
      if (g.status === "PARTIALLY_RECEIVED") partial += 1;
      const po = poById.get(g.purchaseOrderId);
      if (!po || !g.receiptDate) continue;
      const received = parseLocalDate(g.receiptDate);
      if (po.poDate) {
        const days = daysBetween(parseLocalDate(po.poDate), received);
        if (Number.isFinite(days) && days >= 0) fulfillmentDays.push(days);
      }
      if (!po.expectedDeliveryDate) continue;
      const lateDays = daysBetween(
        parseLocalDate(po.expectedDeliveryDate),
        received,
      );
      if (!Number.isFinite(lateDays)) continue;
      if (lateDays <= 0) onTime += 1;
      else delayed += 1;
    }

    return {
      ...row,
      onTimeReceiptCount: onTime,
      delayedReceiptCount: delayed,
      partialReceiptCount: partial,
      onTimeRatePercent:
        onTime + delayed >= MIN_SAMPLES_FOR_RATE
          ? safeRatePercent(onTime, onTime + delayed)
          : null,
      avgFulfillmentDays:
        fulfillmentDays.length >= MIN_SAMPLES_FOR_RATE
          ? average(fulfillmentDays)
          : null,
    };
  });

  return { kpis: base.kpis, rows };
}
