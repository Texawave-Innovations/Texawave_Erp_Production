import type {
  GoodsReceipt,
  PurchaseRequisition,
  Rfq,
  ScmPurchaseOrder,
  SupplierQuotation,
  Vendor,
} from "@/types";
import {
  OPEN_PO_STATUSES,
  OPEN_REQUISITION_STATUSES,
  RECEIVABLE_PO_STATUSES,
  isPostedGrn,
  pendingReceiptQty,
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
  matchProductInItems,
  matchStatus,
  matchVendor,
  matchWarehouse,
  vendorName,
  withStatusLabels,
} from "./shared";

const PENDING_RECEIPTS_LIMIT = 25;
const RECENT_POS_LIMIT = 20;
const VALUED_PO_STATUSES = new Set<string>([
  "APPROVED",
  "SENT",
  "PARTIALLY_RECEIVED",
  "RECEIVED",
  "CLOSED",
]);

export interface ProcurementInput {
  requisitions: PurchaseRequisition[];
  rfqs: Rfq[];
  quotations: SupplierQuotation[];
  purchaseOrders: ScmPurchaseOrder[];
  grns: GoodsReceipt[];
  vendors: Vendor[];
}

export interface ProcurementKpis {
  prCount: number;
  rfqCount: number;
  quotationCount: number;
  poCount: number;
  poValue: number;
  approvedPoValue: number;
  pendingPoCount: number;
  grnCount: number;
  receivedQty: number;
  pendingReceiptQty: number;
  avgPrToPoDays: number | null;
  avgPoToGrnDays: number | null;
  /** Point-in-time (not date-filtered): requisitions in an open status. */
  openRequisitionCount: number;
  /** Point-in-time (not date-filtered): sent POs still awaiting goods. */
  posAwaitingReceiptCount: number;
}

export interface ProcurementReportData {
  kpis: ProcurementKpis;
  posOverTime: TimePoint[];
  poValueOverTime: TimePoint[];
  statusDistribution: Series[];
  topSuppliersByValue: Series[];
  pendingReceipts: Array<{
    id: string;
    poNumber: string;
    vendorName: string;
    pendingQty: number;
    expectedDeliveryDate?: string;
  }>;
  recentPOs: ScmPurchaseOrder[];
}

const poPendingQty = (p: ScmPurchaseOrder) =>
  p.items.reduce((s, i) => s + pendingReceiptQty(i), 0);

function selectProcurement(
  input: ProcurementInput,
  range: DateRange,
  filters: ReportFilters,
) {
  const scopedPo = (p: ScmPurchaseOrder) =>
    matchWarehouse(p.warehouseId, filters) &&
    matchVendor(p.vendorId, filters) &&
    matchProductInItems(p.items, filters);
  return {
    prs: input.requisitions.filter(
      (r) =>
        inRange(r.requestDate || r.createdAt, range) &&
        matchWarehouse(r.warehouseId, filters),
    ),
    rfqs: input.rfqs.filter(
      (r) =>
        inRange(r.issueDate || r.createdAt, range) &&
        matchWarehouse(r.warehouseId, filters),
    ),
    quotations: input.quotations.filter(
      (q) =>
        inRange(q.quotationDate || q.createdAt, range) &&
        matchVendor(q.vendorId, filters),
    ),
    pos: input.purchaseOrders.filter(
      (p) =>
        inRange(p.poDate || p.createdAt, range) &&
        scopedPo(p) &&
        matchStatus(p.status, filters),
    ),
    grns: input.grns.filter(
      (g) =>
        isPostedGrn(g.status) &&
        inRange(g.receiptDate || g.createdAt, range) &&
        matchWarehouse(g.warehouseId, filters) &&
        matchVendor(g.vendorId, filters) &&
        matchProductInItems(g.items, filters),
    ),
    openPrs: input.requisitions.filter(
      (r) =>
        OPEN_REQUISITION_STATUSES.has(r.status) &&
        matchWarehouse(r.warehouseId, filters),
    ),
    awaitingReceipt: input.purchaseOrders.filter(
      (p) =>
        RECEIVABLE_PO_STATUSES.has(p.status) &&
        scopedPo(p) &&
        poPendingQty(p) > 0,
    ),
  };
}

type ProcurementSelection = ReturnType<typeof selectProcurement>;

function procurementKpis(
  input: ProcurementInput,
  sel: ProcurementSelection,
): ProcurementKpis {
  const { prs, rfqs, quotations, pos, grns } = sel;
  const prById = new Map(input.requisitions.map((r) => [r.id, r]));
  const poById = new Map(input.purchaseOrders.map((p) => [p.id, p]));
  const openPos = pos.filter((p) => OPEN_PO_STATUSES.has(p.status));
  return {
    prCount: prs.length,
    rfqCount: rfqs.length,
    quotationCount: quotations.length,
    poCount: pos.length,
    poValue: pos.reduce((s, p) => s + (p.total || 0), 0),
    approvedPoValue: pos
      .filter((p) => VALUED_PO_STATUSES.has(p.status))
      .reduce((s, p) => s + (p.total || 0), 0),
    pendingPoCount: pos.filter((p) => p.status === "PENDING_APPROVAL").length,
    grnCount: grns.length,
    receivedQty: grns.reduce(
      (s, g) =>
        s + g.items.reduce((si, i) => si + (i.acceptedQuantity || 0), 0),
      0,
    ),
    pendingReceiptQty: openPos.reduce((s, p) => s + poPendingQty(p), 0),
    avgPrToPoDays: averageDurationDays(
      pos
        .filter((p) => p.sourceRequisitionId)
        .map((p) => ({
          from: prById.get(p.sourceRequisitionId as string)?.createdAt,
          to: p.createdAt,
        })),
    ),
    avgPoToGrnDays: averageDurationDays(
      grns.map((g) => ({
        from: poById.get(g.purchaseOrderId)?.createdAt,
        to: g.createdAt,
      })),
    ),
    openRequisitionCount: sel.openPrs.length,
    posAwaitingReceiptCount: sel.awaitingReceipt.length,
  };
}

export function computeProcurementKpis(
  input: ProcurementInput,
  range: DateRange,
  filters: ReportFilters,
): ProcurementKpis {
  return procurementKpis(input, selectProcurement(input, range, filters));
}

export function computeProcurementReport(
  input: ProcurementInput,
  range: DateRange,
  filters: ReportFilters,
): ProcurementReportData {
  const sel = selectProcurement(input, range, filters);
  const { pos } = sel;
  const granularity = pickGranularity(range);
  const supplierName = (p: ScmPurchaseOrder) =>
    vendorName(input.vendors, p.vendorId, p.vendorNameSnapshot);

  const pendingReceipts = pos
    .filter((p) => OPEN_PO_STATUSES.has(p.status))
    .map((p) => ({
      id: p.id,
      poNumber: p.poNumber,
      vendorName: supplierName(p),
      pendingQty: poPendingQty(p),
      expectedDeliveryDate: p.expectedDeliveryDate,
    }))
    .filter((r) => r.pendingQty > 0)
    .sort((a, b) => b.pendingQty - a.pendingQty)
    .slice(0, PENDING_RECEIPTS_LIMIT);

  return {
    kpis: procurementKpis(input, sel),
    posOverTime: bucketByPeriod(
      pos,
      (p) => p.poDate || p.createdAt,
      granularity,
    ),
    poValueOverTime: bucketByPeriod(
      pos,
      (p) => p.poDate || p.createdAt,
      granularity,
      (p) => p.total || 0,
    ),
    statusDistribution: withStatusLabels(groupBy(pos, (p) => p.status)),
    topSuppliersByValue: topN(
      pos,
      (p) => p.vendorId,
      supplierName,
      (p) => p.total || 0,
    ),
    pendingReceipts,
    recentPOs: [...pos]
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
      .slice(0, RECENT_POS_LIMIT),
  };
}
