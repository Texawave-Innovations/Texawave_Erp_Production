// Pure, read-only aggregation formulas for every SCM report. Every function here takes a
// slice of `ScmReportsRawData` (see `reportService.ts`) plus the active `ReportFilters` /
// `DateRange` and returns plain KPI numbers + chart-ready series — nothing in this file
// reads or writes Firebase, and nothing here mutates its inputs (spec #35, #36).
//
// Where a metric already has a canonical definition elsewhere in the SCM module (backorder
// detection, stock status, location occupancy), this file imports and reuses that exact
// helper instead of re-deriving a competing calculation (spec #40).
import { computeStockStatus } from "../inventory/useInventoryData";
import { computeLocationStock } from "../warehouse/warehouseHelpers";
import { getSupplierStatus } from "../suppliers/supplierHelpers";
import type {
  Vendor,
  Warehouse,
  WarehouseLocation,
  PurchaseRequisition,
  Rfq,
  SupplierQuotation,
  ScmPurchaseOrder,
  GoodsReceipt,
  StockBalance,
  StockLedgerEntry,
  InventorySettings,
  WarehousePutaway,
  WarehouseMovement,
  WarehousePicking,
  WarehousePacking,
  OrderFulfillment,
  OrderAcknowledgement,
  ScmShipment,
  ShipmentException,
  ScmReturn,
  ScmReturnDispositionRecord,
  ScmQualityInspection,
  ScmQualityDefect,
  ScmQualityQuarantineRecord,
} from "@/types";
import type { SellableProduct } from "../inventory/productCatalog";
import {
  ALL,
  type DateRange,
  inRange,
  pickGranularity,
  bucketByPeriod,
  groupBy,
  topN,
  safeDivide,
  safeRatePercent,
  average,
  averageDurationDays,
} from "./reportHelpers";

/** Filters shared by every report page's filter bar. Not every report honors every field —
 * each domain function below documents which ones it applies and to which date field. */
export interface ReportFilters {
  warehouseId: string;
  vendorId: string;
  productCode: string;
  status: string;
}

export const EMPTY_FILTERS: ReportFilters = {
  warehouseId: ALL,
  vendorId: ALL,
  productCode: ALL,
  status: ALL,
};

const matchWarehouse = (id: string | undefined, f: ReportFilters) =>
  f.warehouseId === ALL || id === f.warehouseId;
const matchVendor = (id: string | undefined, f: ReportFilters) =>
  f.vendorId === ALL || id === f.vendorId;
const matchProduct = (code: string | undefined, f: ReportFilters) =>
  f.productCode === ALL || code === f.productCode;
const matchStatus = (status: string | undefined, f: ReportFilters) =>
  f.status === ALL || status === f.status;
/** For documents that hold a product only inside a line-items array (POs, GRNs,
 * fulfillments, returns) — true when the product filter is off, or at least one line
 * matches it. */
const matchProductInItems = <T extends { productCode?: string }>(
  items: T[],
  f: ReportFilters,
) =>
  f.productCode === ALL || items.some((i) => i.productCode === f.productCode);

function vendorName(
  vendors: Vendor[],
  id: string | undefined,
  fallback?: string,
): string {
  return (
    fallback ||
    vendors.find((v) => v.id === id)?.companyName ||
    id ||
    "Unknown supplier"
  );
}

function warehouseName(
  warehouses: Warehouse[],
  id: string | undefined,
): string {
  return warehouses.find((w) => w.id === id)?.name || id || "Unknown warehouse";
}

export interface Series {
  key: string;
  label: string;
  value: number;
}
export interface TimePoint {
  period: string;
  label: string;
  value: number;
}

// ===========================================================================
// PROCUREMENT — spec #7, #8
// ===========================================================================

export interface ProcurementReportData {
  kpis: {
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
  };
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

const OPEN_PO_STATUSES = new Set<string>([
  "APPROVED",
  "SENT",
  "PARTIALLY_RECEIVED",
]);
const VALUED_PO_STATUSES = new Set<string>([
  "APPROVED",
  "SENT",
  "PARTIALLY_RECEIVED",
  "RECEIVED",
  "CLOSED",
]);

export function computeProcurementReport(
  input: {
    requisitions: PurchaseRequisition[];
    rfqs: Rfq[];
    quotations: SupplierQuotation[];
    purchaseOrders: ScmPurchaseOrder[];
    grns: GoodsReceipt[];
    vendors: Vendor[];
  },
  range: DateRange,
  filters: ReportFilters,
): ProcurementReportData {
  const { requisitions, rfqs, quotations, purchaseOrders, grns, vendors } =
    input;
  const granularity = pickGranularity(range);

  const prs = requisitions.filter(
    (r) =>
      inRange(r.requestDate || r.createdAt, range) &&
      matchWarehouse(r.warehouseId, filters),
  );
  const rfqList = rfqs.filter(
    (r) =>
      inRange(r.issueDate || r.createdAt, range) &&
      matchWarehouse(r.warehouseId, filters),
  );
  const quoList = quotations.filter(
    (q) =>
      inRange(q.quotationDate || q.createdAt, range) &&
      matchVendor(q.vendorId, filters),
  );
  const pos = purchaseOrders.filter(
    (p) =>
      inRange(p.poDate || p.createdAt, range) &&
      matchWarehouse(p.warehouseId, filters) &&
      matchVendor(p.vendorId, filters) &&
      matchStatus(p.status, filters) &&
      matchProductInItems(p.items, filters),
  );
  const grnList = grns.filter(
    (g) =>
      inRange(g.receiptDate || g.createdAt, range) &&
      matchWarehouse(g.warehouseId, filters) &&
      matchVendor(g.vendorId, filters) &&
      matchProductInItems(g.items, filters),
  );

  const poValue = pos.reduce((s, p) => s + (p.total || 0), 0);
  const approvedPoValue = pos
    .filter((p) => VALUED_PO_STATUSES.has(p.status))
    .reduce((s, p) => s + (p.total || 0), 0);
  const pendingPoCount = pos.filter(
    (p) => p.status === "PENDING_APPROVAL",
  ).length;
  const receivedQty = grnList.reduce(
    (s, g) => s + g.items.reduce((si, i) => si + (i.acceptedQuantity || 0), 0),
    0,
  );
  const pendingReceiptQty = pos
    .filter((p) => OPEN_PO_STATUSES.has(p.status))
    .reduce(
      (s, p) =>
        s +
        p.items.reduce(
          (si, i) =>
            si + Math.max(0, (i.quantity || 0) - (i.receivedQuantity || 0)),
          0,
        ),
      0,
    );

  const prById = new Map(requisitions.map((r) => [r.id, r]));
  const poByIdAll = new Map(purchaseOrders.map((p) => [p.id, p]));
  const avgPrToPoDays = averageDurationDays(
    pos
      .filter((p) => p.sourceRequisitionId)
      .map((p) => ({
        from: prById.get(p.sourceRequisitionId!)?.createdAt,
        to: p.createdAt,
      })),
  );
  const avgPoToGrnDays = averageDurationDays(
    grnList.map((g) => ({
      from: poByIdAll.get(g.purchaseOrderId)?.createdAt,
      to: g.createdAt,
    })),
  );

  const pendingReceipts = pos
    .filter((p) => OPEN_PO_STATUSES.has(p.status))
    .map((p) => ({
      id: p.id,
      poNumber: p.poNumber,
      vendorName: vendorName(vendors, p.vendorId, p.vendorNameSnapshot),
      pendingQty: p.items.reduce(
        (si, i) =>
          si + Math.max(0, (i.quantity || 0) - (i.receivedQuantity || 0)),
        0,
      ),
      expectedDeliveryDate: p.expectedDeliveryDate,
    }))
    .filter((r) => r.pendingQty > 0)
    .sort((a, b) => b.pendingQty - a.pendingQty)
    .slice(0, 25);

  return {
    kpis: {
      prCount: prs.length,
      rfqCount: rfqList.length,
      quotationCount: quoList.length,
      poCount: pos.length,
      poValue,
      approvedPoValue,
      pendingPoCount,
      grnCount: grnList.length,
      receivedQty,
      pendingReceiptQty,
      avgPrToPoDays,
      avgPoToGrnDays,
    },
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
    statusDistribution: groupBy(pos, (p) => p.status).map((g) => ({
      ...g,
      label: g.key.replace(/_/g, " "),
    })),
    topSuppliersByValue: topN(
      pos,
      (p) => p.vendorId,
      (p) => vendorName(vendors, p.vendorId, p.vendorNameSnapshot),
      (p) => p.total || 0,
    ),
    pendingReceipts,
    recentPOs: [...pos]
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
      .slice(0, 20),
  };
}

// ===========================================================================
// INVENTORY — spec #9, #10, #11
// ===========================================================================

export interface InventoryReportRow {
  productCode: string;
  productName: string;
  category?: string;
  warehouseId: string;
  warehouseName: string;
  onHand: number;
  reserved: number;
  available: number;
  incoming: number;
  damaged: number;
  reorderLevel?: number;
  costPrice?: number;
}

export interface InventoryReportData {
  kpis: {
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
  };
  valueByWarehouse: Series[] | null;
  stockByCategory: Series[];
  movementTrend: Array<{
    period: string;
    label: string;
    Inbound: number;
    Outbound: number;
    Transfers: number;
    Returns: number;
    Adjustments: number;
    Damage: number;
    Quarantine: number;
  }>;
  reservationVsAvailable: Series[];
  lowStockItems: InventoryReportRow[];
  topStockedProducts: InventoryReportRow[];
}

export function computeInventoryReport(
  input: {
    stockBalances: StockBalance[];
    products: SellableProduct[];
    warehouses: Warehouse[];
    inventorySettings: InventorySettings[];
    stockLedger: StockLedgerEntry[];
  },
  range: DateRange,
  filters: ReportFilters,
): InventoryReportData {
  const {
    stockBalances,
    products,
    warehouses,
    inventorySettings,
    stockLedger,
  } = input;
  const settingsByCode = new Map(
    inventorySettings.map((s) => [s.productCode, s]),
  );
  const productByCode = new Map(products.map((p) => [p.productCode, p]));

  const allRows: InventoryReportRow[] = stockBalances
    .filter(
      (b) =>
        matchWarehouse(b.warehouseId, filters) &&
        matchProduct(b.productCode, filters),
    )
    .map((b) => {
      const product = productByCode.get(b.productCode);
      const setting = settingsByCode.get(b.productCode);
      return {
        productCode: b.productCode,
        productName: product?.name || b.productName || b.productCode,
        category: product?.category,
        warehouseId: b.warehouseId,
        warehouseName: warehouseName(warehouses, b.warehouseId),
        onHand: b.onHand || 0,
        reserved: b.reserved || 0,
        available: b.available ?? (b.onHand || 0) - (b.reserved || 0),
        incoming: b.incoming || 0,
        damaged: b.damaged || 0,
        reorderLevel: setting?.reorderLevel,
        costPrice: setting?.costPrice,
      };
    });

  // Same status rule Phase 3's Stock Overview uses (`computeStockStatus` +
  // `hasLedgerHistory`), so Low/Out-of-Stock counts here always agree with that screen.
  const statusOf = (r: InventoryReportRow) =>
    computeStockStatus({
      productCode: r.productCode,
      productName: r.productName,
      uom: "",
      warehouseId: r.warehouseId,
      warehouseName: r.warehouseName,
      onHand: r.onHand,
      reserved: r.reserved,
      available: r.available,
      incoming: r.incoming,
      damaged: r.damaged,
      reorderLevel: r.reorderLevel,
      costPrice: r.costPrice,
      hasLedgerHistory: true,
    });
  // Status filter (Healthy/Low Stock/Out of Stock/Overstock) applies after computing status
  // per row, since status is itself derived from onHand/available/reorderLevel.
  const rows =
    filters.status === ALL
      ? allRows
      : allRows.filter((r) => statusOf(r) === filters.status);
  const lowStockRows = rows.filter((r) => statusOf(r) === "Low Stock");
  const outOfStockRows = rows.filter((r) => statusOf(r) === "Out of Stock");

  const costedRows = rows.filter((r) => r.costPrice != null);
  const inventoryValue =
    costedRows.length > 0
      ? costedRows.reduce((s, r) => s + r.onHand * (r.costPrice || 0), 0)
      : null;

  const valueByWarehouse =
    costedRows.length > 0
      ? groupBy(
          costedRows,
          (r) => r.warehouseName,
          (r) => r.onHand * (r.costPrice || 0),
        ).map((g) => ({ ...g, label: g.key }))
      : null;

  const skuKey = new Set(rows.map((r) => r.productCode));

  const ledger = stockLedger.filter(
    (e) =>
      inRange(e.transactionDate, range) &&
      matchWarehouse(e.warehouseId, filters) &&
      matchProduct(e.productCode, filters),
  );
  const granularity = pickGranularity(range);
  const movementTrend = bucketMovementTrend(ledger, granularity);

  return {
    kpis: {
      totalSKUs: skuKey.size,
      totalUnits: rows.reduce((s, r) => s + r.onHand, 0),
      inventoryValue,
      valuedSkuCount: costedRows.length,
      totalSkuCount: rows.length,
      available: rows.reduce((s, r) => s + r.available, 0),
      reserved: rows.reduce((s, r) => s + r.reserved, 0),
      incoming: rows.reduce((s, r) => s + r.incoming, 0),
      damaged: rows.reduce((s, r) => s + r.damaged, 0),
      lowStockCount: lowStockRows.length,
      outOfStockCount: outOfStockRows.length,
    },
    valueByWarehouse,
    stockByCategory: groupBy(
      rows,
      (r) => r.category || "Uncategorized",
      (r) => r.onHand,
    ).map((g) => ({ ...g, label: g.key })),
    movementTrend,
    reservationVsAvailable: [
      {
        key: "available",
        label: "Available",
        value: Math.max(
          0,
          rows.reduce((s, r) => s + r.available, 0),
        ),
      },
      {
        key: "reserved",
        label: "Reserved",
        value: rows.reduce((s, r) => s + r.reserved, 0),
      },
    ],
    lowStockItems: [...lowStockRows]
      .sort((a, b) => a.available - b.available)
      .slice(0, 25),
    topStockedProducts: [...rows]
      .sort((a, b) => b.onHand - a.onHand)
      .slice(0, 10),
  };
}

const INBOUND_TYPES = new Set([
  "PURCHASE_RECEIPT",
  "OPENING_BALANCE",
  "QC_RELEASE",
]);
const ADJUST_TYPES = new Set(["ADJUSTMENT_IN", "ADJUSTMENT_OUT"]);

function bucketMovementTrend(
  ledger: StockLedgerEntry[],
  granularity: ReturnType<typeof pickGranularity>,
) {
  const buckets = new Map<
    string,
    {
      label: string;
      sortMs: number;
      Inbound: number;
      Outbound: number;
      Transfers: number;
      Returns: number;
      Adjustments: number;
      Damage: number;
      Quarantine: number;
    }
  >();
  for (const e of ledger) {
    const ms = e.transactionDate;
    if (!Number.isFinite(ms)) continue;
    const d = new Date(ms);
    let key: string;
    let label: string;
    if (granularity === "day") {
      key = d.toISOString().split("T")[0];
      label = d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
    } else if (granularity === "week") {
      const wd = new Date(d);
      wd.setDate(wd.getDate() - wd.getDay());
      key = wd.toISOString().split("T")[0];
      label = `Wk of ${wd.toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}`;
    } else {
      key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      label = d.toLocaleDateString("en-IN", {
        month: "short",
        year: "2-digit",
      });
    }

    if (!buckets.has(key))
      buckets.set(key, {
        label,
        sortMs: ms,
        Inbound: 0,
        Outbound: 0,
        Transfers: 0,
        Returns: 0,
        Adjustments: 0,
        Damage: 0,
        Quarantine: 0,
      });
    const b = buckets.get(key)!;
    const t = e.transactionType;
    if (INBOUND_TYPES.has(t)) b.Inbound += e.quantityIn || 0;
    else if (t === "SALES_ISSUE") b.Outbound += e.quantityOut || 0;
    else if (t === "TRANSFER_IN" || t === "TRANSFER_OUT")
      b.Transfers += (e.quantityIn || 0) + (e.quantityOut || 0);
    else if (t === "SALES_RETURN") b.Returns += e.quantityIn || 0;
    else if (t === "PURCHASE_RETURN") b.Returns += e.quantityOut || 0;
    else if (ADJUST_TYPES.has(t))
      b.Adjustments += (e.quantityIn || 0) + (e.quantityOut || 0);
    else if (t === "DAMAGE") b.Damage += e.quantityOut || 0;
    else if (t === "QUARANTINE" || t === "QC_REJECT")
      b.Quarantine += e.quantityOut || 0;
  }
  return Array.from(buckets.entries())
    .sort((a, b) => a[1].sortMs - b[1].sortMs)
    .map(([period, v]) => ({
      period,
      label: v.label,
      Inbound: v.Inbound,
      Outbound: v.Outbound,
      Transfers: v.Transfers,
      Returns: v.Returns,
      Adjustments: v.Adjustments,
      Damage: v.Damage,
      Quarantine: v.Quarantine,
    }));
}

// ===========================================================================
// WAREHOUSE — spec #12
// ===========================================================================

export interface WarehouseReportData {
  kpis: {
    warehouseCount: number;
    activeWarehouseCount: number;
    locationCount: number;
    putawayCount: number;
    movementCount: number;
    pickingCount: number;
    packingCount: number;
  };
  operationsVolume: Array<{
    period: string;
    label: string;
    Putaway: number;
    Movement: number;
    Picking: number;
    Packing: number;
  }>;
  stockByWarehouse: Series[];
  locationUtilization: {
    rated: Array<{
      key: string;
      label: string;
      occupied: number;
      capacity: number;
      percent: number;
    }>;
    unratedCount: number;
  } | null;
}

export function computeWarehouseReport(
  input: {
    warehouses: Warehouse[];
    locations: WarehouseLocation[];
    putaways: WarehousePutaway[];
    movements: WarehouseMovement[];
    pickings: WarehousePicking[];
    packings: WarehousePacking[];
    stockBalances: StockBalance[];
  },
  range: DateRange,
  filters: ReportFilters,
): WarehouseReportData {
  const {
    warehouses,
    locations,
    putaways,
    movements,
    pickings,
    packings,
    stockBalances,
  } = input;
  const granularity = pickGranularity(range);

  const wLocations = locations.filter((l) =>
    matchWarehouse(l.warehouseId, filters),
  );
  const pu = putaways.filter(
    (p) =>
      inRange(p.createdAt, range) && matchWarehouse(p.warehouseId, filters),
  );
  const mv = movements.filter(
    (m) =>
      inRange(m.createdAt, range) && matchWarehouse(m.warehouseId, filters),
  );
  const pk = pickings.filter(
    (p) =>
      inRange(p.createdAt, range) && matchWarehouse(p.warehouseId, filters),
  );
  const pc = packings.filter(
    (p) =>
      inRange(p.createdAt, range) && matchWarehouse(p.warehouseId, filters),
  );

  const seriesMap = new Map<
    string,
    {
      label: string;
      sortMs: number;
      Putaway: number;
      Movement: number;
      Picking: number;
      Packing: number;
    }
  >();
  const bump = (
    ms: number | undefined,
    field: "Putaway" | "Movement" | "Picking" | "Packing",
  ) => {
    if (!Number.isFinite(ms)) return;
    const d = new Date(ms as number);
    let key: string;
    let label: string;
    if (granularity === "day") {
      key = d.toISOString().split("T")[0];
      label = d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
    } else if (granularity === "week") {
      const wd = new Date(d);
      wd.setDate(wd.getDate() - wd.getDay());
      key = wd.toISOString().split("T")[0];
      label = `Wk of ${wd.toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}`;
    } else {
      key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      label = d.toLocaleDateString("en-IN", {
        month: "short",
        year: "2-digit",
      });
    }
    if (!seriesMap.has(key))
      seriesMap.set(key, {
        label,
        sortMs: ms as number,
        Putaway: 0,
        Movement: 0,
        Picking: 0,
        Packing: 0,
      });
    seriesMap.get(key)![field] += 1;
  };
  pu.forEach((p) => bump(p.createdAt, "Putaway"));
  mv.forEach((m) => bump(m.createdAt, "Movement"));
  pk.forEach((p) => bump(p.createdAt, "Picking"));
  pc.forEach((p) => bump(p.createdAt, "Packing"));
  const operationsVolume = Array.from(seriesMap.entries())
    .sort((a, b) => a[1].sortMs - b[1].sortMs)
    .map(([period, v]) => ({
      period,
      label: v.label,
      Putaway: v.Putaway,
      Movement: v.Movement,
      Picking: v.Picking,
      Packing: v.Packing,
    }));

  const stockByWarehouse = groupBy(
    stockBalances.filter((b) => matchWarehouse(b.warehouseId, filters)),
    (b) => warehouseName(warehouses, b.warehouseId),
    (b) => b.onHand || 0,
  ).map((g) => ({ ...g, label: g.key }));

  const occupancy = computeLocationStock(putaways, movements, pickings);
  const occupiedByLocation = new Map<string, number>();
  for (const [key, qty] of occupancy.entries()) {
    const locId = key.split("__")[2];
    occupiedByLocation.set(
      locId,
      (occupiedByLocation.get(locId) || 0) + Math.max(0, qty),
    );
  }
  const rated = wLocations
    .filter((l) => l.capacity != null && l.capacity > 0)
    .map((l) => {
      const occupied = occupiedByLocation.get(l.id) || 0;
      return {
        key: l.id,
        label: l.locationCode || l.binCode || l.locationName || l.id,
        occupied,
        capacity: l.capacity as number,
        percent: (occupied / (l.capacity as number)) * 100,
      };
    });
  const unratedCount = wLocations.length - rated.length;

  return {
    kpis: {
      warehouseCount: warehouses.length,
      activeWarehouseCount: warehouses.filter((w) => w.status === "Active")
        .length,
      locationCount: wLocations.length,
      putawayCount: pu.length,
      movementCount: mv.length,
      pickingCount: pk.length,
      packingCount: pc.length,
    },
    operationsVolume,
    stockByWarehouse,
    locationUtilization: wLocations.length > 0 ? { rated, unratedCount } : null,
  };
}

// ===========================================================================
// FULFILLMENT — spec #13
// ===========================================================================

/** Exact same shortage rule `ScmBackorders.tsx` uses (`orders/ScmBackorders.tsx`) — a
 * fulfillment is backordered when it's still open and at least one line has unreserved
 * demand. Kept here as one function so Reports and the live Backorders page can never
 * silently drift apart. */
export function isBackorderedFulfillment(f: OrderFulfillment): boolean {
  return (
    f.status !== "CANCELLED" &&
    f.status !== "FULFILLED" &&
    f.items.some((i) => i.orderedQty - i.reservedQty > 0)
  );
}

export interface FulfillmentReportData {
  kpis: {
    salesOrderCount: number;
    fulfillmentCount: number;
    allocatedQty: number;
    issuedQty: number;
    orderedQty: number;
    completedCount: number;
    backorderCount: number;
    completionRatePercent: number | null;
  };
  statusDistribution: Series[];
  volumeOverTime: TimePoint[];
  backorderTrend: TimePoint[];
  topProductsByFulfilledQty: Series[];
}

export function computeFulfillmentReport(
  input: {
    fulfillments: OrderFulfillment[];
    salesOrders: OrderAcknowledgement[];
    warehouses: Warehouse[];
  },
  range: DateRange,
  filters: ReportFilters,
): FulfillmentReportData {
  const { fulfillments, salesOrders } = input;
  const granularity = pickGranularity(range);

  const ff = fulfillments.filter(
    (f) =>
      inRange(f.createdAt, range) &&
      matchWarehouse(f.warehouseId, filters) &&
      matchStatus(f.status, filters) &&
      (filters.productCode === ALL ||
        f.items.some((i) => i.itemCode === filters.productCode)),
  );
  const so = salesOrders.filter((s) => inRange(s.soDate || s.createdAt, range));

  const orderedQty = ff.reduce(
    (s, f) => s + f.items.reduce((si, i) => si + (i.orderedQty || 0), 0),
    0,
  );
  const issuedQty = ff.reduce(
    (s, f) => s + f.items.reduce((si, i) => si + (i.issuedQty || 0), 0),
    0,
  );
  const allocatedQty = ff.reduce(
    (s, f) => s + f.items.reduce((si, i) => si + (i.reservedQty || 0), 0),
    0,
  );
  const backordered = ff.filter(isBackorderedFulfillment);

  const productLabels = new Map<string, string>();
  const flatItems = ff.flatMap((f) =>
    f.items.map((i) => {
      productLabels.set(i.itemCode, i.itemDescription);
      return i;
    }),
  );

  return {
    kpis: {
      salesOrderCount: so.length,
      fulfillmentCount: ff.length,
      allocatedQty,
      issuedQty,
      orderedQty,
      completedCount: ff.filter((f) => f.status === "FULFILLED").length,
      backorderCount: backordered.length,
      completionRatePercent: safeRatePercent(issuedQty, orderedQty),
    },
    statusDistribution: groupBy(ff, (f) => f.status).map((g) => ({
      ...g,
      label: g.key.replace(/_/g, " "),
    })),
    volumeOverTime: bucketByPeriod(ff, (f) => f.createdAt, granularity),
    backorderTrend: bucketByPeriod(
      backordered,
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

// ===========================================================================
// LOGISTICS — spec #14, #15
// ===========================================================================

const IN_TRANSIT_STATUSES = new Set(["IN_TRANSIT", "OUT_FOR_DELIVERY"]);
const PENDING_SHIPMENT_STATUSES = new Set(["DRAFT", "READY_TO_SHIP"]);

export interface LogisticsReportData {
  kpis: {
    shipmentCount: number;
    pendingCount: number;
    dispatchedCount: number;
    inTransitCount: number;
    deliveredCount: number;
    cancelledCount: number;
    exceptionCount: number;
    avgDeliveryDays: number | null;
  };
  statusDistribution: Series[];
  shipmentsOverTime: TimePoint[];
  carrierVolume: Series[];
  exceptionTrend: TimePoint[];
  recentShipments: ScmShipment[];
  openExceptions: ShipmentException[];
}

export function computeLogisticsReport(
  input: {
    shipments: ScmShipment[];
    exceptions: ShipmentException[];
    warehouses: Warehouse[];
  },
  range: DateRange,
  filters: ReportFilters,
): LogisticsReportData {
  const { shipments, exceptions } = input;
  const granularity = pickGranularity(range);

  const sh = shipments.filter(
    (s) =>
      inRange(s.shipmentDate || s.createdAt, range) &&
      matchWarehouse(s.warehouseId, filters) &&
      matchStatus(s.status, filters),
  );
  const shById = new Set(sh.map((s) => s.id));
  const ex = exceptions.filter(
    (e) => inRange(e.occurredAt, range) && shById.has(e.shipmentId),
  );

  const avgDeliveryDays = averageDurationDays(
    sh.map((s) => ({ from: s.dispatchedAt, to: s.deliveredAt })),
  );

  return {
    kpis: {
      shipmentCount: sh.length,
      pendingCount: sh.filter((s) => PENDING_SHIPMENT_STATUSES.has(s.status))
        .length,
      dispatchedCount: sh.filter((s) => s.status === "DISPATCHED").length,
      inTransitCount: sh.filter((s) => IN_TRANSIT_STATUSES.has(s.status))
        .length,
      deliveredCount: sh.filter((s) => s.status === "DELIVERED").length,
      cancelledCount: sh.filter((s) => s.status === "CANCELLED").length,
      exceptionCount: ex.length,
      avgDeliveryDays,
    },
    statusDistribution: groupBy(sh, (s) => s.status).map((g) => ({
      ...g,
      label: g.key.replace(/_/g, " "),
    })),
    shipmentsOverTime: bucketByPeriod(
      sh,
      (s) => s.shipmentDate || s.createdAt,
      granularity,
    ),
    carrierVolume: topN(
      sh,
      (s) => s.carrierId || s.carrierNameSnapshot,
      (s) => s.carrierNameSnapshot || "Unassigned",
      () => 1,
    ),
    exceptionTrend: bucketByPeriod(ex, (e) => e.occurredAt, granularity),
    recentShipments: [...sh]
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
      .slice(0, 20),
    openExceptions: [...ex]
      .filter((e) => !e.resolvedAt)
      .sort((a, b) => (b.occurredAt || 0) - (a.occurredAt || 0))
      .slice(0, 20),
  };
}

// ===========================================================================
// RETURNS — spec #16
// ===========================================================================

const PENDING_APPROVAL_RETURN = new Set(["REQUESTED", "PENDING_APPROVAL"]);
const IN_TRANSIT_RETURN = new Set(["IN_TRANSIT", "SHIPPED"]);
const RECEIVED_RETURN = new Set(["RECEIVED", "VENDOR_RECEIVED"]);

export interface ReturnsReportData {
  kpis: {
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
  };
  returnsOverTime: TimePoint[];
  reasonDistribution: Series[];
  customerVsVendor: Series[];
  dispositionDistribution: Series[];
  topReturnedProducts: Series[];
}

export function computeReturnsReport(
  input: {
    returns: ScmReturn[];
    returnDispositions: ScmReturnDispositionRecord[];
    fulfillments: OrderFulfillment[];
    grns: GoodsReceipt[];
  },
  range: DateRange,
  filters: ReportFilters,
): ReturnsReportData {
  const { returns, returnDispositions, fulfillments, grns } = input;
  const granularity = pickGranularity(range);

  const rets = returns.filter(
    (r) =>
      inRange(r.requestedDate, range) &&
      matchWarehouse(r.warehouseId, filters) &&
      matchVendor(r.vendorId, filters) &&
      matchStatus(r.status, filters) &&
      matchProductInItems(r.items, filters),
  );
  const retIds = new Set(rets.map((r) => r.id));
  const disp = returnDispositions.filter((d) => retIds.has(d.returnId));

  const sumByDisposition = (code: string) =>
    disp
      .filter((d) => d.disposition === code)
      .reduce((s, d) => s + (d.quantity || 0), 0);

  const customerRets = rets.filter((r) => r.returnType === "CUSTOMER_RETURN");
  const vendorRets = rets.filter((r) => r.returnType === "VENDOR_RETURN");
  const completedCustomerQty = customerRets
    .filter((r) => r.status === "COMPLETED")
    .reduce(
      (s, r) =>
        s + r.items.reduce((si, i) => si + (i.requestedQuantity || 0), 0),
      0,
    );
  const completedVendorQty = vendorRets
    .filter((r) => r.status === "COMPLETED")
    .reduce(
      (s, r) =>
        s + r.items.reduce((si, i) => si + (i.requestedQuantity || 0), 0),
      0,
    );

  // Denominator: fulfilled quantity issued in the same window (customer side) / accepted
  // GRN quantity received in the same window (vendor side) — the most defensible base
  // available from existing data, per spec #16's explicit formula guidance.
  const fulfilledQtyInRange = fulfillments
    .filter((f) => inRange(f.createdAt, range))
    .reduce(
      (s, f) => s + f.items.reduce((si, i) => si + (i.issuedQty || 0), 0),
      0,
    );
  const receivedQtyInRange = grns
    .filter((g) => inRange(g.receiptDate || g.createdAt, range))
    .reduce(
      (s, g) =>
        s + g.items.reduce((si, i) => si + (i.acceptedQuantity || 0), 0),
      0,
    );

  const flatItems = rets.flatMap((r) => r.items.map((i) => ({ ...i })));

  return {
    kpis: {
      customerReturnCount: customerRets.length,
      vendorReturnCount: vendorRets.length,
      pendingApprovalCount: rets.filter((r) =>
        PENDING_APPROVAL_RETURN.has(r.status),
      ).length,
      inTransitCount: rets.filter((r) => IN_TRANSIT_RETURN.has(r.status))
        .length,
      receivedCount: rets.filter((r) => RECEIVED_RETURN.has(r.status)).length,
      completedCount: rets.filter((r) => r.status === "COMPLETED").length,
      rejectedCount: rets.filter((r) => r.status === "REJECTED").length,
      restockedQty: sumByDisposition("RESTOCK"),
      quarantinedQty: sumByDisposition("QUARANTINE"),
      damagedQty: sumByDisposition("DAMAGED"),
      scrapQty: sumByDisposition("SCRAP"),
      customerReturnRatePercent: safeRatePercent(
        completedCustomerQty,
        fulfilledQtyInRange,
      ),
      vendorReturnRatePercent: safeRatePercent(
        completedVendorQty,
        receivedQtyInRange,
      ),
    },
    returnsOverTime: bucketByPeriod(rets, (r) => r.requestedDate, granularity),
    reasonDistribution: groupBy(rets, (r) => r.reasonCode).map((g) => ({
      ...g,
      label: g.key.replace(/_/g, " "),
    })),
    customerVsVendor: [
      {
        key: "CUSTOMER_RETURN",
        label: "Customer Returns",
        value: customerRets.length,
      },
      {
        key: "VENDOR_RETURN",
        label: "Vendor Returns",
        value: vendorRets.length,
      },
    ],
    dispositionDistribution: groupBy(
      disp,
      (d) => d.disposition,
      (d) => d.quantity || 0,
    ).map((g) => ({ ...g, label: g.key.replace(/_/g, " ") })),
    topReturnedProducts: topN(
      flatItems,
      (i) => i.productCode,
      (i) => i.productNameSnapshot,
      (i) => i.requestedQuantity || 0,
    ),
  };
}

// ===========================================================================
// QUALITY — spec #17
// ===========================================================================

export interface QualityReportData {
  kpis: {
    inspectionCount: number;
    passedCount: number;
    partiallyPassedCount: number;
    failedCount: number;
    onHoldCount: number;
    quarantinedCount: number;
    criticalDefectCount: number;
  };
  resultDistribution: Series[];
  defectSeverity: Series[];
  defectCategory: Series[];
  trendOverTime: TimePoint[];
  quarantineTrend: TimePoint[];
  recentFailures: ScmQualityInspection[];
  quarantinedItems: ScmQualityQuarantineRecord[];
}

export function computeQualityReport(
  input: {
    qualityInspections: ScmQualityInspection[];
    qualityDefects: ScmQualityDefect[];
    qualityQuarantine: ScmQualityQuarantineRecord[];
  },
  range: DateRange,
  filters: ReportFilters,
): QualityReportData {
  const {
    qualityInspections: inspections,
    qualityDefects: defects,
    qualityQuarantine: quarantine,
  } = input;
  const granularity = pickGranularity(range);
  const defectByCode = new Map(defects.map((d) => [d.defectCode, d]));

  const insp = inspections.filter(
    (i) =>
      inRange(i.completedAt || i.inspectionDate || i.createdAt, range) &&
      matchWarehouse(i.warehouseId, filters) &&
      matchVendor(i.supplierId, filters) &&
      matchStatus(i.result || i.status, filters) &&
      matchProductInItems(i.items, filters),
  );
  const qtn = quarantine.filter(
    (q) =>
      inRange(q.quarantineDate, range) &&
      matchWarehouse(q.warehouseId, filters),
  );

  const failItems = insp.flatMap((i) =>
    i.items.filter(
      (it) =>
        it.inspectionResult === "FAIL" ||
        it.inspectionResult === "PARTIAL_PASS",
    ),
  );
  const criticalDefectCount = failItems.filter(
    (it) =>
      it.defectCode && defectByCode.get(it.defectCode)?.severity === "CRITICAL",
  ).length;

  return {
    kpis: {
      inspectionCount: insp.length,
      passedCount: insp.filter((i) => i.result === "PASSED").length,
      partiallyPassedCount: insp.filter((i) => i.result === "PARTIALLY_PASSED")
        .length,
      failedCount: insp.filter((i) => i.result === "FAILED").length,
      onHoldCount: insp.filter((i) => i.result === "ON_HOLD").length,
      quarantinedCount: qtn.filter((q) => q.status === "QUARANTINED").length,
      criticalDefectCount,
    },
    resultDistribution: groupBy(
      insp.filter((i) => i.result),
      (i) => i.result as string,
    ).map((g) => ({ ...g, label: g.key.replace(/_/g, " ") })),
    defectSeverity: groupBy(
      failItems.filter((it) => it.defectCode),
      (it) => defectByCode.get(it.defectCode!)?.severity || "UNKNOWN",
    ).map((g) => ({ ...g, label: g.key })),
    defectCategory: groupBy(
      failItems.filter((it) => it.defectCode),
      (it) => defectByCode.get(it.defectCode!)?.category || "UNKNOWN",
    ).map((g) => ({ ...g, label: g.key.replace(/_/g, " ") })),
    trendOverTime: bucketByPeriod(
      insp,
      (i) => i.completedAt || i.inspectionDate || i.createdAt,
      granularity,
    ),
    quarantineTrend: bucketByPeriod(qtn, (q) => q.quarantineDate, granularity),
    recentFailures: [...insp]
      .filter((i) => i.result === "FAILED")
      .sort(
        (a, b) =>
          (b.completedAt || b.createdAt || 0) -
          (a.completedAt || a.createdAt || 0),
      )
      .slice(0, 20),
    quarantinedItems: [...qtn]
      .filter((q) => q.status === "QUARANTINED")
      .sort((a, b) => (b.quarantineDate || 0) - (a.quarantineDate || 0))
      .slice(0, 20),
  };
}

// ===========================================================================
// SUPPLIERS — spec #18 (descriptive only, no scoring/ranking)
// ===========================================================================

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

export function computeSupplierReport(
  input: {
    vendors: Vendor[];
    purchaseOrders: ScmPurchaseOrder[];
    grns: GoodsReceipt[];
    returns: ScmReturn[];
    qualityInspections: ScmQualityInspection[];
  },
  range: DateRange,
  filters: ReportFilters,
): {
  kpis: { activeSupplierCount: number; totalPoValue: number };
  rows: SupplierReportRow[];
} {
  const { vendors, purchaseOrders, grns, returns, qualityInspections } = input;

  const pos = purchaseOrders.filter(
    (p) =>
      inRange(p.poDate || p.createdAt, range) &&
      matchVendor(p.vendorId, filters),
  );
  const grnList = grns.filter(
    (g) =>
      inRange(g.receiptDate || g.createdAt, range) &&
      matchVendor(g.vendorId, filters),
  );
  const vendorReturns = returns.filter(
    (r) =>
      r.returnType === "VENDOR_RETURN" &&
      inRange(r.requestedDate, range) &&
      matchVendor(r.vendorId, filters),
  );
  const qcIncoming = qualityInspections.filter(
    (i) =>
      i.sourceType === "GRN" &&
      inRange(i.completedAt || i.inspectionDate || i.createdAt, range),
  );

  const grnBySupplierId = new Map<string, GoodsReceipt[]>();
  for (const g of grnList) {
    const arr = grnBySupplierId.get(g.vendorId) || [];
    arr.push(g);
    grnBySupplierId.set(g.vendorId, arr);
  }

  const relevantVendors = vendors.filter(
    (v) =>
      (filters.vendorId === ALL || v.id === filters.vendorId) &&
      matchStatus(getSupplierStatus(v), filters),
  );

  const rows: SupplierReportRow[] = relevantVendors
    .map((v) => {
      const vPos = pos.filter((p) => p.vendorId === v.id);
      const vGrns = grnBySupplierId.get(v.id) || [];
      const vGrnIds = new Set(vGrns.map((g) => g.id));
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
              s +
              p.items.reduce(
                (si, i) =>
                  si +
                  Math.max(0, (i.quantity || 0) - (i.receivedQuantity || 0)),
                0,
              ),
            0,
          ),
        vendorReturnCount: vendorReturns.filter((r) => r.vendorId === v.id)
          .length,
        qcFailureCount: qcIncoming.filter(
          (i) =>
            vGrnIds.has(i.sourceId) &&
            (i.result === "FAILED" || i.result === "PARTIALLY_PASSED"),
        ).length,
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
      activeSupplierCount: vendors.filter(
        (v) => getSupplierStatus(v) === "Active",
      ).length,
      totalPoValue: rows.reduce((s, r) => s + r.poValue, 0),
    },
    rows,
  };
}

// ===========================================================================
// EXECUTIVE DASHBOARD — spec #6 (reuses the exact same domain functions above so every
// headline number matches what its drill-down report shows — spec #40)
// ===========================================================================

export interface ExecutiveSummary {
  procurement: ProcurementReportData["kpis"];
  inventory: InventoryReportData["kpis"];
  warehouse: WarehouseReportData["kpis"];
  fulfillment: FulfillmentReportData["kpis"];
  logistics: LogisticsReportData["kpis"];
  returns: ReturnsReportData["kpis"];
  quality: QualityReportData["kpis"];
}

export function computeExecutiveSummary(
  data: {
    requisitions: PurchaseRequisition[];
    rfqs: Rfq[];
    quotations: SupplierQuotation[];
    purchaseOrders: ScmPurchaseOrder[];
    grns: GoodsReceipt[];
    vendors: Vendor[];
    stockBalances: StockBalance[];
    products: SellableProduct[];
    warehouses: Warehouse[];
    inventorySettings: InventorySettings[];
    stockLedger: StockLedgerEntry[];
    locations: WarehouseLocation[];
    putaways: WarehousePutaway[];
    movements: WarehouseMovement[];
    pickings: WarehousePicking[];
    packings: WarehousePacking[];
    fulfillments: OrderFulfillment[];
    salesOrders: OrderAcknowledgement[];
    shipments: ScmShipment[];
    exceptions: ShipmentException[];
    returns: ScmReturn[];
    returnDispositions: ScmReturnDispositionRecord[];
    qualityInspections: ScmQualityInspection[];
    qualityDefects: ScmQualityDefect[];
    qualityQuarantine: ScmQualityQuarantineRecord[];
  },
  range: DateRange,
  filters: ReportFilters,
): ExecutiveSummary {
  return {
    procurement: computeProcurementReport(data, range, filters).kpis,
    inventory: computeInventoryReport(data, range, filters).kpis,
    warehouse: computeWarehouseReport(data, range, filters).kpis,
    fulfillment: computeFulfillmentReport(data, range, filters).kpis,
    logistics: computeLogisticsReport(data, range, filters).kpis,
    returns: computeReturnsReport(data, range, filters).kpis,
    quality: computeQualityReport(data, range, filters).kpis,
  };
}
