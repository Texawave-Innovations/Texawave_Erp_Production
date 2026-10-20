import type {
  GoodsReceipt,
  OrderFulfillment,
  ScmReturn,
  ScmReturnDispositionRecord,
} from "@/types";
import {
  PENDING_APPROVAL_RETURN_STATUSES,
  isPostedGrn,
} from "../../shared/businessRules";
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
  matchProduct,
  matchProductInItems,
  matchStatus,
  matchVendor,
  matchWarehouse,
  withStatusLabels,
} from "./shared";

const IN_TRANSIT_RETURN = new Set<string>(["IN_TRANSIT", "SHIPPED"]);
const RECEIVED_RETURN = new Set<string>(["RECEIVED", "VENDOR_RECEIVED"]);

export interface ReturnsInput {
  returns: ScmReturn[];
  returnDispositions: ScmReturnDispositionRecord[];
  fulfillments: OrderFulfillment[];
  grns: GoodsReceipt[];
}

export interface ReturnsKpis {
  customerReturnCount: number;
  vendorReturnCount: number;
  pendingApprovalCount: number;
  inTransitCount: number;
  receivedCount: number;
  completedCount: number;
  rejectedCount: number;
  restockedQty: number;
  quarantinedQty: number;
  damagedQty: number;
  scrapQty: number;
  customerReturnRatePercent: number | null;
  vendorReturnRatePercent: number | null;
}

export interface ReturnsReportData {
  kpis: ReturnsKpis;
  returnsOverTime: TimePoint[];
  reasonDistribution: Series[];
  customerVsVendor: Series[];
  dispositionDistribution: Series[];
  topReturnedProducts: Series[];
}

function selectReturns(
  input: ReturnsInput,
  range: DateRange,
  filters: ReportFilters,
) {
  const returns = input.returns.filter(
    (r) =>
      inRange(r.requestedDate, range) &&
      matchWarehouse(r.warehouseId, filters) &&
      matchVendor(r.vendorId, filters) &&
      matchStatus(r.status, filters) &&
      matchProductInItems(r.items, filters),
  );
  const returnIds = new Set(returns.map((r) => r.id));
  return {
    returns,
    dispositions: input.returnDispositions.filter((d) =>
      returnIds.has(d.returnId),
    ),
  };
}

/** Completed return quantity ÷ the quantity it could have come from in the same window, with the
 * same warehouse/vendor/product filters applied to numerator and denominator. The customer base
 * is fulfilled (issued) quantity, the vendor base is accepted quantity on posted GRNs. */
function returnRates(
  input: ReturnsInput,
  returns: ScmReturn[],
  range: DateRange,
  filters: ReportFilters,
) {
  const completedQty = (type: ScmReturn["returnType"]) =>
    returns
      .filter((r) => r.returnType === type && r.status === "COMPLETED")
      .reduce(
        (s, r) =>
          s +
          r.items.reduce(
            (si, i) =>
              si +
              (matchProduct(i.productCode, filters)
                ? i.requestedQuantity || 0
                : 0),
            0,
          ),
        0,
      );

  // Fulfillments carry no supplier, so a supplier filter makes the customer rate undefined.
  const fulfilledQty =
    filters.vendorId !== ALL
      ? 0
      : input.fulfillments
          .filter(
            (f) =>
              inRange(f.createdAt, range) &&
              matchWarehouse(f.warehouseId, filters),
          )
          .reduce(
            (s, f) =>
              s +
              f.items.reduce(
                (si, i) =>
                  si +
                  (matchProduct(i.itemCode, filters) ? i.issuedQty || 0 : 0),
                0,
              ),
            0,
          );
  const receivedQty = input.grns
    .filter(
      (g) =>
        isPostedGrn(g.status) &&
        inRange(g.receiptDate || g.createdAt, range) &&
        matchWarehouse(g.warehouseId, filters) &&
        matchVendor(g.vendorId, filters),
    )
    .reduce(
      (s, g) =>
        s +
        g.items.reduce(
          (si, i) =>
            si +
            (matchProduct(i.productCode, filters)
              ? i.acceptedQuantity || 0
              : 0),
          0,
        ),
      0,
    );

  return {
    customerReturnRatePercent: safeRatePercent(
      completedQty("CUSTOMER_RETURN"),
      fulfilledQty,
    ),
    vendorReturnRatePercent: safeRatePercent(
      completedQty("VENDOR_RETURN"),
      receivedQty,
    ),
  };
}

function returnsKpis(
  input: ReturnsInput,
  sel: ReturnType<typeof selectReturns>,
  range: DateRange,
  filters: ReportFilters,
): ReturnsKpis {
  const { returns, dispositions } = sel;
  const count = (pred: (r: ScmReturn) => boolean) =>
    returns.filter(pred).length;
  const dispositionQty = (code: string) =>
    dispositions
      .filter((d) => d.disposition === code)
      .reduce((s, d) => s + (d.quantity || 0), 0);
  return {
    customerReturnCount: count((r) => r.returnType === "CUSTOMER_RETURN"),
    vendorReturnCount: count((r) => r.returnType === "VENDOR_RETURN"),
    pendingApprovalCount: count((r) =>
      PENDING_APPROVAL_RETURN_STATUSES.has(r.status),
    ),
    inTransitCount: count((r) => IN_TRANSIT_RETURN.has(r.status)),
    receivedCount: count((r) => RECEIVED_RETURN.has(r.status)),
    completedCount: count((r) => r.status === "COMPLETED"),
    rejectedCount: count((r) => r.status === "REJECTED"),
    restockedQty: dispositionQty("RESTOCK"),
    quarantinedQty: dispositionQty("QUARANTINE"),
    damagedQty: dispositionQty("DAMAGED"),
    scrapQty: dispositionQty("SCRAP"),
    ...returnRates(input, returns, range, filters),
  };
}

export function computeReturnsKpis(
  input: ReturnsInput,
  range: DateRange,
  filters: ReportFilters,
): ReturnsKpis {
  return returnsKpis(
    input,
    selectReturns(input, range, filters),
    range,
    filters,
  );
}

export function computeReturnsReport(
  input: ReturnsInput,
  range: DateRange,
  filters: ReportFilters,
): ReturnsReportData {
  const sel = selectReturns(input, range, filters);
  const kpis = returnsKpis(input, sel, range, filters);
  const flatItems = sel.returns
    .flatMap((r) => r.items)
    .filter((i) => matchProduct(i.productCode, filters));

  return {
    kpis,
    returnsOverTime: bucketByPeriod(
      sel.returns,
      (r) => r.requestedDate,
      pickGranularity(range),
    ),
    reasonDistribution: withStatusLabels(
      groupBy(sel.returns, (r) => r.reasonCode),
    ),
    customerVsVendor: [
      {
        key: "CUSTOMER_RETURN",
        label: "Customer Returns",
        value: kpis.customerReturnCount,
      },
      {
        key: "VENDOR_RETURN",
        label: "Vendor Returns",
        value: kpis.vendorReturnCount,
      },
    ],
    dispositionDistribution: withStatusLabels(
      groupBy(
        sel.dispositions,
        (d) => d.disposition,
        (d) => d.quantity || 0,
      ),
    ),
    topReturnedProducts: topN(
      flatItems,
      (i) => i.productCode,
      (i) => i.productNameSnapshot,
      (i) => i.requestedQuantity || 0,
    ),
  };
}
