// Descriptive supplier activity — counts and sums only, no scoring or ranking.
import type {
  GoodsReceipt,
  ScmPurchaseOrder,
  ScmQualityInspection,
  ScmReturn,
  Vendor,
} from "@/types";
import { getSupplierStatus } from "../../suppliers/supplierHelpers";
import {
  OPEN_PO_STATUSES,
  isPostedGrn,
  isSupplierActive,
  pendingReceiptQty,
} from "../../shared/businessRules";
import { ALL } from "../../shared/format";
import { type DateRange, inRange } from "../reportHelpers";
import { type ReportFilters, matchStatus, matchVendor } from "./shared";

export interface SupplierReportRow {
  vendorId: string;
  vendorName: string;
  status: string;
  poCount: number;
  poValue: number;
  receivedQty: number;
  pendingQty: number;
  vendorReturnCount: number;
  qcFailureCount: number;
}

export interface SupplierInput {
  vendors: Vendor[];
  purchaseOrders: ScmPurchaseOrder[];
  grns: GoodsReceipt[];
  returns: ScmReturn[];
  qualityInspections: ScmQualityInspection[];
}

export interface SupplierReportData {
  kpis: { activeSupplierCount: number; totalPoValue: number };
  rows: SupplierReportRow[];
}

function groupByVendor<T>(
  items: T[],
  vendorOf: (item: T) => string | undefined,
): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const id = vendorOf(item);
    if (!id) continue;
    const list = map.get(id);
    if (list) list.push(item);
    else map.set(id, [item]);
  }
  return map;
}

/** GRNs in range for the vendor filter (posted receipts only) — shared with Supplier Intelligence. */
export function selectSupplierGrns(
  grns: GoodsReceipt[],
  range: DateRange,
  filters: ReportFilters,
): GoodsReceipt[] {
  return grns.filter(
    (g) =>
      isPostedGrn(g.status) &&
      inRange(g.receiptDate || g.createdAt, range) &&
      matchVendor(g.vendorId, filters),
  );
}

export function computeSupplierReport(
  input: SupplierInput,
  range: DateRange,
  filters: ReportFilters,
): SupplierReportData {
  const { vendors, purchaseOrders, grns, returns, qualityInspections } = input;

  const posByVendor = groupByVendor(
    purchaseOrders.filter(
      (p) =>
        inRange(p.poDate || p.createdAt, range) &&
        matchVendor(p.vendorId, filters),
    ),
    (p) => p.vendorId,
  );
  const grnsByVendor = groupByVendor(
    selectSupplierGrns(grns, range, filters),
    (g) => g.vendorId,
  );
  const returnsByVendor = groupByVendor(
    returns.filter(
      (r) =>
        r.returnType === "VENDOR_RETURN" &&
        inRange(r.requestedDate, range) &&
        matchVendor(r.vendorId, filters),
    ),
    (r) => r.vendorId,
  );
  const qcFailuresByGrn = new Map<string, number>();
  for (const i of qualityInspections) {
    if (
      i.sourceType !== "GRN" ||
      (i.result !== "FAILED" && i.result !== "PARTIALLY_PASSED")
    )
      continue;
    if (!inRange(i.completedAt || i.inspectionDate || i.createdAt, range))
      continue;
    qcFailuresByGrn.set(i.sourceId, (qcFailuresByGrn.get(i.sourceId) || 0) + 1);
  }

  const rows: SupplierReportRow[] = vendors
    .filter(
      (v) =>
        (filters.vendorId === ALL || v.id === filters.vendorId) &&
        matchStatus(getSupplierStatus(v), filters),
    )
    .map((v) => {
      const vPos = posByVendor.get(v.id) || [];
      const vGrns = grnsByVendor.get(v.id) || [];
      return {
        vendorId: v.id,
        vendorName: v.companyName,
        status: getSupplierStatus(v),
        poCount: vPos.length,
        poValue: vPos.reduce((s, p) => s + (p.total || 0), 0),
        receivedQty: vGrns.reduce(
          (s, g) =>
            s + g.items.reduce((si, i) => si + (i.acceptedQuantity || 0), 0),
          0,
        ),
        pendingQty: vPos
          .filter((p) => OPEN_PO_STATUSES.has(p.status))
          .reduce(
            (s, p) =>
              s + p.items.reduce((si, i) => si + pendingReceiptQty(i), 0),
            0,
          ),
        vendorReturnCount: (returnsByVendor.get(v.id) || []).length,
        qcFailureCount: vGrns.reduce(
          (s, g) => s + (qcFailuresByGrn.get(g.id) || 0),
          0,
        ),
      };
    })
    .filter(
      (r) =>
        r.poCount > 0 ||
        r.vendorReturnCount > 0 ||
        r.qcFailureCount > 0 ||
        filters.vendorId !== ALL,
    )
    .sort((a, b) => b.poValue - a.poValue);

  return {
    kpis: {
      activeSupplierCount: vendors.filter((v) => isSupplierActive(v.status))
        .length,
      totalPoValue: rows.reduce((s, r) => s + r.poValue, 0),
    },
    rows,
  };
}
