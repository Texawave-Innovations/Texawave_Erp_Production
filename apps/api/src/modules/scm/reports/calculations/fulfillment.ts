import type { OrderAcknowledgement, OrderFulfillment } from "@/types";
import { CLOSED_FULFILLMENT_STATUSES } from "../../shared/businessRules";
import { ALL } from "../../shared/format";
import {
  type DateRange,
  bucketByPeriod,
  groupBy,
  inRange,
  pickGranularity,
  safeRatePercent,
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

/** Same shortage rule as `ScmBackorders.tsx`: still open and at least one line has unreserved
 * demand. */
export function isBackorderedFulfillment(f: OrderFulfillment): boolean {
  return (
    !CLOSED_FULFILLMENT_STATUSES.has(f.status) &&
    f.items.some((i) => i.orderedQty - i.reservedQty > 0)
  );
}

export interface FulfillmentInput {
  fulfillments: OrderFulfillment[];
  salesOrders: OrderAcknowledgement[];
}

export interface FulfillmentKpis {
  salesOrderCount: number;
  fulfillmentCount: number;
  allocatedQty: number;
  issuedQty: number;
  orderedQty: number;
  completedCount: number;
  backorderCount: number;
  completionRatePercent: number | null;
}

export interface FulfillmentReportData {
  kpis: FulfillmentKpis;
  statusDistribution: Series[];
  volumeOverTime: TimePoint[];
  backorderTrend: TimePoint[];
  topProductsByFulfilledQty: Series[];
}

function selectFulfillment(
  input: FulfillmentInput,
  range: DateRange,
  filters: ReportFilters,
) {
  return {
    fulfillments: input.fulfillments.filter(
      (f) =>
        inRange(f.createdAt, range) &&
        matchWarehouse(f.warehouseId, filters) &&
        matchStatus(f.status, filters) &&
        (filters.productCode === ALL ||
          f.items.some((i) => i.itemCode === filters.productCode)),
    ),
    salesOrders: input.salesOrders.filter((s) =>
      inRange(s.soDate || s.createdAt, range),
    ),
  };
}

function fulfillmentKpis(
  sel: ReturnType<typeof selectFulfillment>,
): FulfillmentKpis {
  const ff = sel.fulfillments;
  const sumItems = (pick: (i: OrderFulfillment["items"][number]) => number) =>
    ff.reduce(
      (s, f) => s + f.items.reduce((si, i) => si + (pick(i) || 0), 0),
      0,
    );
  const orderedQty = sumItems((i) => i.orderedQty);
  const issuedQty = sumItems((i) => i.issuedQty);
  return {
    salesOrderCount: sel.salesOrders.length,
    fulfillmentCount: ff.length,
    allocatedQty: sumItems((i) => i.reservedQty),
    issuedQty,
    orderedQty,
    completedCount: ff.filter((f) => f.status === "FULFILLED").length,
    backorderCount: ff.filter(isBackorderedFulfillment).length,
    completionRatePercent: safeRatePercent(issuedQty, orderedQty),
  };
}

export function computeFulfillmentKpis(
  input: FulfillmentInput,
  range: DateRange,
  filters: ReportFilters,
): FulfillmentKpis {
  return fulfillmentKpis(selectFulfillment(input, range, filters));
}

export function computeFulfillmentReport(
  input: FulfillmentInput,
  range: DateRange,
  filters: ReportFilters,
): FulfillmentReportData {
  const sel = selectFulfillment(input, range, filters);
  const ff = sel.fulfillments;
  const granularity = pickGranularity(range);
  const flatItems = ff.flatMap((f) => f.items);

  return {
    kpis: fulfillmentKpis(sel),
    statusDistribution: withStatusLabels(groupBy(ff, (f) => f.status)),
    volumeOverTime: bucketByPeriod(ff, (f) => f.createdAt, granularity),
    backorderTrend: bucketByPeriod(
      ff.filter(isBackorderedFulfillment),
      (f) => f.createdAt,
      granularity,
    ),
    topProductsByFulfilledQty: topN(
      flatItems,
      (i) => i.itemCode,
      (i) => i.itemDescription,
      (i) => i.issuedQty || 0,
    ),
  };
}
