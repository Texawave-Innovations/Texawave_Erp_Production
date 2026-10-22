import type { ScmShipment, ShipmentException } from "@/types";
import {
  IN_TRANSIT_SHIPMENT_STATUSES,
  PENDING_SHIPMENT_STATUSES,
  PROBLEM_SHIPMENT_STATUSES,
} from "../../shared/businessRules";
import {
  type DateRange,
  averageDurationDays,
  bucketByPeriod,
  groupBy,
  inRange,
  pickGranularity,
  topN,
} from "../reportHelpers";
import {
  type ReportFilters,
  type Series,
  type TimePoint,
  matchStatus,
  matchWarehouse,
  withStatusLabels,
} from "./shared";

const RECENT_LIMIT = 20;

export interface LogisticsInput {
  shipments: ScmShipment[];
  exceptions: ShipmentException[];
}

/** Status buckets use the shared shipment status sets, so pending + in transit + delivered +
 * problem + cancelled always adds up to `shipmentCount` and matches the Logistics dashboard. */
export interface LogisticsKpis {
  shipmentCount: number;
  pendingCount: number;
  inTransitCount: number;
  deliveredCount: number;
  problemCount: number;
  cancelledCount: number;
  exceptionCount: number;
  avgDeliveryDays: number | null;
}

export interface LogisticsReportData {
  kpis: LogisticsKpis;
  statusDistribution: Series[];
  shipmentsOverTime: TimePoint[];
  carrierVolume: Series[];
  exceptionTrend: TimePoint[];
  recentShipments: ScmShipment[];
  openExceptions: ShipmentException[];
}

function selectLogistics(
  input: LogisticsInput,
  range: DateRange,
  filters: ReportFilters,
) {
  const shipments = input.shipments.filter(
    (s) =>
      inRange(s.shipmentDate || s.createdAt, range) &&
      matchWarehouse(s.warehouseId, filters) &&
      matchStatus(s.status, filters),
  );
  const shipmentIds = new Set(shipments.map((s) => s.id));
  const exceptions = input.exceptions.filter(
    (e) => inRange(e.occurredAt, range) && shipmentIds.has(e.shipmentId),
  );
  return { shipments, exceptions };
}

function logisticsKpis({
  shipments,
  exceptions,
}: ReturnType<typeof selectLogistics>): LogisticsKpis {
  const count = (pred: (s: ScmShipment) => boolean) =>
    shipments.filter(pred).length;
  return {
    shipmentCount: shipments.length,
    pendingCount: count((s) => PENDING_SHIPMENT_STATUSES.has(s.status)),
    inTransitCount: count((s) => IN_TRANSIT_SHIPMENT_STATUSES.has(s.status)),
    deliveredCount: count((s) => s.status === "DELIVERED"),
    problemCount: count((s) => PROBLEM_SHIPMENT_STATUSES.has(s.status)),
    cancelledCount: count((s) => s.status === "CANCELLED"),
    exceptionCount: exceptions.length,
    avgDeliveryDays: averageDurationDays(
      shipments.map((s) => ({ from: s.dispatchedAt, to: s.deliveredAt })),
    ),
  };
}

export function computeLogisticsKpis(
  input: LogisticsInput,
  range: DateRange,
  filters: ReportFilters,
): LogisticsKpis {
  return logisticsKpis(selectLogistics(input, range, filters));
}

export function computeLogisticsReport(
  input: LogisticsInput,
  range: DateRange,
  filters: ReportFilters,
): LogisticsReportData {
  const sel = selectLogistics(input, range, filters);
  const { shipments, exceptions } = sel;
  const granularity = pickGranularity(range);

  return {
    kpis: logisticsKpis(sel),
    statusDistribution: withStatusLabels(groupBy(shipments, (s) => s.status)),
    shipmentsOverTime: bucketByPeriod(
      shipments,
      (s) => s.shipmentDate || s.createdAt,
      granularity,
    ),
    carrierVolume: topN(
      shipments,
      (s) => s.carrierId || s.carrierNameSnapshot,
      (s) => s.carrierNameSnapshot || "Unassigned",
      () => 1,
    ),
    exceptionTrend: bucketByPeriod(
      exceptions,
      (e) => e.occurredAt,
      granularity,
    ),
    recentShipments: [...shipments]
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
      .slice(0, RECENT_LIMIT),
    openExceptions: exceptions
      .filter((e) => !e.resolvedAt)
      .sort((a, b) => (b.occurredAt || 0) - (a.occurredAt || 0))
      .slice(0, RECENT_LIMIT),
  };
}
