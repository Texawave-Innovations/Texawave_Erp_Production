// Deterministic SCM exception evaluation — the "Alert & Exception Engine". Every rule reads only
// existing SCM records (`ScmReportsRawData`, the shared loader) and applies a fixed, documented
// threshold. Re-running `evaluateExceptions` on the same data yields the same exceptions with the
// same ids (`exceptionKey`), which is what lets `scmAutomationService.ts` reconcile idempotently.
import { stripUndefined } from "@/services/firebase";
import {
  EMPTY_FILTERS,
  buildInventoryRows,
  computeOccupancyByLocation,
  computeSupplierReport,
  isBackorderedFulfillment,
  warehouseName as lookupWarehouseName,
} from "../reports/calculations";
import { presetRange } from "../reports/reportHelpers";
import type { ScmReportsRawData } from "../reports/reportService";
import {
  IN_TRANSIT_SHIPMENT_STATUSES,
  OPEN_PO_STATUSES,
  PENDING_APPROVAL_RETURN_STATUSES,
  PROBLEM_SHIPMENT_STATUSES,
  isSupplierActive,
  pendingReceiptQty,
} from "../shared/businessRules";
import {
  daysBetween,
  formatStatusLabel,
  parseLocalDate,
} from "../shared/format";
import { exceptionKey } from "./advancedPaths";
import type { ScmException } from "./advancedTypes";
import { daysSince } from "./advancedHelpers";

// Tunable thresholds — the only place rule behavior is configured.
const PO_DELAY_HIGH_DAYS = 3;
const PO_DELAY_CRITICAL_DAYS = 14;
const GRN_DRAFT_STALE_DAYS = 3;
const PICK_PACK_STALE_DAYS = 2;
const WAREHOUSE_CAPACITY_WARN_PERCENT = 90;
const WAREHOUSE_CAPACITY_FULL_PERCENT = 100;
const SHIPMENT_DELAY_HIGH_DAYS = 1;
const SHIPMENT_DELAY_CRITICAL_DAYS = 5;
const RETURN_PENDING_STALE_DAYS = 5;
const QC_PENDING_STALE_DAYS = 2;
const QUARANTINE_ESCALATE_DAYS = 7;
/** A supplier is flagged once vendor returns + QC failures over the trailing 90 days reach this. */
const SUPPLIER_RISK_INCIDENT_THRESHOLD = 2;

/** Shipments that should still arrive — with the carrier, or stuck with a delivery problem. */
const UNDELIVERED_SHIPMENT_STATUSES = new Set<string>([
  ...IN_TRANSIT_SHIPMENT_STATUSES,
  ...PROBLEM_SHIPMENT_STATUSES,
]);

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

interface EvalContext {
  data: ScmReportsRawData;
  today: Date;
  now: number;
  warehouseName: (id: string | undefined) => string | undefined;
}

/** Calendar days a `YYYY-MM-DD` due date is overdue (0 or less = not overdue; due today is not late). */
function daysOverdue(dueDate: string, today: Date): number {
  return daysBetween(parseLocalDate(dueDate), today);
}

// LOW_STOCK / OUT_OF_STOCK — the inventory domain's `computeStockStatus` (via `buildInventoryRows`),
// so counts match the Stock Overview and Inventory Report.
function evalStockExceptions({ data }: EvalContext): ScmException[] {
  const out: ScmException[] = [];
  for (const row of buildInventoryRows(data)) {
    if (row.status !== "Out of Stock" && row.status !== "Low Stock") continue;
    const sourceId = `${row.productCode}__${row.warehouseId}`;
    const outOfStock = row.status === "Out of Stock";
    const type = outOfStock ? "OUT_OF_STOCK" : "LOW_STOCK";
    out.push({
      id: exceptionKey(type, sourceId),
      type,
      severity: outOfStock ? "Critical" : "High",
      title: `${row.productName} is ${outOfStock ? "out of stock" : "low on stock"} at ${row.warehouseName}`,
      description: outOfStock
        ? `Available stock is ${row.available} at ${row.warehouseName}.`
        : `Available stock (${row.available}) is at or below the reorder level (${row.reorderLevel}) at ${row.warehouseName}.`,
      source: "Inventory",
      sourceId,
      warehouseId: row.warehouseId,
      warehouseName: row.warehouseName,
      navigationPath: `/scm/inventory/overview/${encodeURIComponent(row.productCode)}`,
    });
  }
  return out;
}

// PO_DELAY — an open PO past its expected delivery date with quantity still to receive.
// GRN_PENDING — a draft receipt left unfinalized (stock not yet posted to the ledger).
function evalProcurementExceptions({
  data,
  today,
  now,
  warehouseName,
}: EvalContext): ScmException[] {
  const out: ScmException[] = [];
  for (const po of data.purchaseOrders) {
    if (!OPEN_PO_STATUSES.has(po.status) || !po.expectedDeliveryDate) continue;
    const lateDays = daysOverdue(po.expectedDeliveryDate, today);
    if (!Number.isFinite(lateDays) || lateDays <= 0) continue;
    const pendingQty = po.items.reduce((s, i) => s + pendingReceiptQty(i), 0);
    if (pendingQty <= 0) continue;
    const severity =
      lateDays >= PO_DELAY_CRITICAL_DAYS
        ? "Critical"
        : lateDays >= PO_DELAY_HIGH_DAYS
          ? "High"
          : "Medium";
    out.push({
      id: exceptionKey("PO_DELAY", po.id),
      type: "PO_DELAY",
      severity,
      title: `PO ${po.poNumber} is ${plural(lateDays, "day")} overdue`,
      description: `${po.vendorNameSnapshot} — ${pendingQty} unit(s) still pending against an expected delivery date of ${po.expectedDeliveryDate}.`,
      source: "Procurement",
      sourceId: po.id,
      sourceNumber: po.poNumber,
      warehouseId: po.warehouseId,
      warehouseName: warehouseName(po.warehouseId),
      vendorId: po.vendorId,
      vendorName: po.vendorNameSnapshot,
      createdAt: parseLocalDate(po.expectedDeliveryDate).getTime(),
      navigationPath: "/scm/procurement/purchase-orders",
    });
  }

  for (const grn of data.grns) {
    if (grn.status !== "DRAFT") continue;
    const age = daysSince(grn.createdAt, now) ?? 0;
    if (age < GRN_DRAFT_STALE_DAYS) continue;
    out.push({
      id: exceptionKey("GRN_PENDING", grn.id),
      type: "GRN_PENDING",
      severity: age >= GRN_DRAFT_STALE_DAYS * 2 ? "High" : "Medium",
      title: `GRN ${grn.grnNumber} not finalized`,
      description: `Draft goods receipt for PO ${grn.purchaseOrderNumber || grn.purchaseOrderId} has been open for ${plural(age, "day")}.`,
      source: "Procurement",
      sourceId: grn.id,
      sourceNumber: grn.grnNumber,
      warehouseId: grn.warehouseId,
      warehouseName: warehouseName(grn.warehouseId),
      vendorId: grn.vendorId,
      vendorName: grn.vendorNameSnapshot,
      createdAt: grn.createdAt,
      navigationPath: "/scm/procurement/grn",
    });
  }
  return out;
}

// PENDING_PICKING / PENDING_PACKING — a pick/pack list stuck in PENDING beyond the threshold.
// WAREHOUSE_CAPACITY — same occupancy projection as the Warehouse Report's location utilization.
function evalWarehouseOpsExceptions({
  data,
  now,
  warehouseName,
}: EvalContext): ScmException[] {
  const out: ScmException[] = [];
  const stale = [
    ...data.pickings.map((d) => ({
      type: "PENDING_PICKING" as const,
      number: d.pickNumber,
      verb: "Pick",
      noun: "Picking",
      path: "/scm/warehouse/picking",
      id: d.id,
      status: d.status,
      warehouseId: d.warehouseId,
      createdAt: d.createdAt,
    })),
    ...data.packings.map((d) => ({
      type: "PENDING_PACKING" as const,
      number: d.packNumber,
      verb: "Pack",
      noun: "Packing",
      path: "/scm/warehouse/packing",
      id: d.id,
      status: d.status,
      warehouseId: d.warehouseId,
      createdAt: d.createdAt,
    })),
  ];
  for (const doc of stale) {
    if (doc.status !== "PENDING") continue;
    const age = daysSince(doc.createdAt, now) ?? 0;
    if (age < PICK_PACK_STALE_DAYS) continue;
    const whName = warehouseName(doc.warehouseId);
    out.push({
      id: exceptionKey(doc.type, doc.id),
      type: doc.type,
      severity: age >= PICK_PACK_STALE_DAYS * 2 ? "High" : "Medium",
      title: `${doc.verb} list ${doc.number} pending ${plural(age, "day")}`,
      description: `${doc.noun} has not started for ${doc.number} at ${whName || doc.warehouseId}.`,
      source: "Warehouse",
      sourceId: doc.id,
      sourceNumber: doc.number,
      warehouseId: doc.warehouseId,
      warehouseName: whName,
      createdAt: doc.createdAt,
      navigationPath: doc.path,
    });
  }

  const occupiedByLocation = computeOccupancyByLocation(
    data.putaways,
    data.movements,
    data.pickings,
  );
  for (const loc of data.locations) {
    if (!loc.capacity || loc.capacity <= 0) continue;
    const occupied = occupiedByLocation.get(loc.id) || 0;
    const percent = (occupied / loc.capacity) * 100;
    if (percent < WAREHOUSE_CAPACITY_WARN_PERCENT) continue;
    const whName = warehouseName(loc.warehouseId);
    out.push({
      id: exceptionKey("WAREHOUSE_CAPACITY", loc.id),
      type: "WAREHOUSE_CAPACITY",
      severity:
        percent >= WAREHOUSE_CAPACITY_FULL_PERCENT ? "Critical" : "High",
      title: `${loc.locationCode || loc.binCode || loc.id} at ${percent.toFixed(0)}% capacity`,
      description: `${occupied} of ${loc.capacity}${loc.capacityUnit ? ` ${loc.capacityUnit}` : ""} occupied at ${whName || loc.warehouseId}.`,
      source: "Warehouse",
      sourceId: loc.id,
      warehouseId: loc.warehouseId,
      warehouseName: whName,
      navigationPath: "/scm/warehouse/locations",
    });
  }
  return out;
}

// BACKORDER — the same shortage rule as `ScmBackorders.tsx` and the Fulfillment Report.
function evalFulfillmentExceptions({
  data,
  warehouseName,
}: EvalContext): ScmException[] {
  return data.fulfillments.filter(isBackorderedFulfillment).map((f) => {
    const shortfall = f.items.reduce(
      (s, i) => s + Math.max(0, i.orderedQty - i.reservedQty),
      0,
    );
    return {
      id: exceptionKey("BACKORDER", f.id),
      type: "BACKORDER",
      severity: "High",
      title: `${f.fulfillmentNumber} is backordered`,
      description: `${shortfall} unit(s) still unreserved for ${f.customerNameSnapshot} (${f.salesOrderNumberSnapshot}).`,
      source: "Fulfillment",
      sourceId: f.id,
      sourceNumber: f.fulfillmentNumber,
      warehouseId: f.warehouseId,
      warehouseName: warehouseName(f.warehouseId),
      createdAt: f.createdAt,
      navigationPath: "/scm/orders/backorders",
    };
  });
}

// SHIPMENT_DELAY — an undelivered shipment (including failed deliveries) past its expected date.
function evalLogisticsExceptions({
  data,
  today,
  warehouseName,
}: EvalContext): ScmException[] {
  const out: ScmException[] = [];
  for (const s of data.shipments) {
    if (!UNDELIVERED_SHIPMENT_STATUSES.has(s.status) || !s.expectedDeliveryDate)
      continue;
    const lateDays = daysOverdue(s.expectedDeliveryDate, today);
    if (!Number.isFinite(lateDays) || lateDays < SHIPMENT_DELAY_HIGH_DAYS)
      continue;
    out.push({
      id: exceptionKey("SHIPMENT_DELAY", s.id),
      type: "SHIPMENT_DELAY",
      severity: lateDays >= SHIPMENT_DELAY_CRITICAL_DAYS ? "Critical" : "High",
      title: `Shipment ${s.shipmentNumber} is ${plural(lateDays, "day")} overdue`,
      description: `${s.customerNameSnapshot} — status ${formatStatusLabel(s.status)}, expected ${s.expectedDeliveryDate}.`,
      source: "Logistics",
      sourceId: s.id,
      sourceNumber: s.shipmentNumber,
      warehouseId: s.warehouseId,
      warehouseName: warehouseName(s.warehouseId),
      createdAt: parseLocalDate(s.expectedDeliveryDate).getTime(),
      navigationPath: "/scm/logistics/shipments",
    });
  }
  return out;
}

// RETURN_PENDING — a return awaiting approval for longer than the threshold.
function evalReturnsExceptions({
  data,
  now,
  warehouseName,
}: EvalContext): ScmException[] {
  const out: ScmException[] = [];
  for (const r of data.returns) {
    if (!PENDING_APPROVAL_RETURN_STATUSES.has(r.status)) continue;
    const age = daysSince(r.requestedDate, now) ?? 0;
    if (age < RETURN_PENDING_STALE_DAYS) continue;
    const isCustomer = r.returnType === "CUSTOMER_RETURN";
    out.push({
      id: exceptionKey("RETURN_PENDING", r.id),
      type: "RETURN_PENDING",
      severity: age >= RETURN_PENDING_STALE_DAYS * 2 ? "High" : "Medium",
      title: `Return ${r.returnNumber} awaiting approval`,
      description: `${isCustomer ? r.customerNameSnapshot : r.vendorNameSnapshot} — pending ${plural(age, "day")}.`,
      source: "Returns",
      sourceId: r.id,
      sourceNumber: r.returnNumber,
      warehouseId: r.warehouseId,
      warehouseName: warehouseName(r.warehouseId),
      vendorId: r.vendorId,
      vendorName: r.vendorNameSnapshot,
      createdAt: r.requestedDate,
      navigationPath: isCustomer
        ? "/scm/returns/customer"
        : "/scm/returns/vendor",
    });
  }
  return out;
}

// QC_HOLD — an inspection whose result is ON_HOLD. QC_PENDING — an inspection still waiting to be
// performed past the threshold (not a hold). QUARANTINE — stock sitting in quarantine.
function evalQualityExceptions({
  data,
  now,
  warehouseName,
}: EvalContext): ScmException[] {
  const out: ScmException[] = [];
  for (const insp of data.qualityInspections) {
    const onHold = insp.result === "ON_HOLD";
    if (!onHold && insp.status !== "PENDING_INSPECTION") continue;
    const since = insp.inspectionDate || insp.createdAt;
    const age = daysSince(since, now) ?? 0;
    if (!onHold && age < QC_PENDING_STALE_DAYS) continue;
    const type = onHold ? "QC_HOLD" : "QC_PENDING";
    const supplier = insp.supplierNameSnapshot
      ? ` — ${insp.supplierNameSnapshot}`
      : "";
    out.push({
      id: exceptionKey(type, insp.id),
      type,
      severity:
        insp.priority === "CRITICAL" || insp.priority === "HIGH"
          ? "High"
          : "Medium",
      title: onHold
        ? `Inspection ${insp.inspectionNumber} on hold`
        : `Inspection ${insp.inspectionNumber} awaiting inspection`,
      description: onHold
        ? `${insp.sourceType} inspection result is on hold (${plural(age, "day")})${supplier}.`
        : `${insp.sourceType} inspection not started for ${plural(age, "day")}${supplier}.`,
      source: "Quality",
      sourceId: insp.id,
      sourceNumber: insp.inspectionNumber,
      warehouseId: insp.warehouseId,
      warehouseName:
        insp.warehouseNameSnapshot || warehouseName(insp.warehouseId),
      vendorId: insp.supplierId,
      vendorName: insp.supplierNameSnapshot,
      createdAt: since,
      navigationPath: `/scm/quality/inspections/${insp.id}`,
    });
  }

  for (const q of data.qualityQuarantine) {
    if (q.status !== "QUARANTINED") continue;
    const age = daysSince(q.quarantineDate, now) ?? 0;
    const whName = q.warehouseNameSnapshot || warehouseName(q.warehouseId);
    out.push({
      id: exceptionKey("QUARANTINE", q.id),
      type: "QUARANTINE",
      severity: age >= QUARANTINE_ESCALATE_DAYS ? "High" : "Medium",
      title: `${q.productNameSnapshot} quarantined (${plural(q.quantity, "unit")})`,
      description: `Held ${plural(age, "day")} at ${whName || q.warehouseId}${q.reason ? ` — ${q.reason}` : ""}.`,
      source: "Quality",
      sourceId: q.id,
      warehouseId: q.warehouseId,
      warehouseName: whName,
      createdAt: q.quarantineDate,
      navigationPath: "/scm/quality/quarantine",
    });
  }
  return out;
}

// SUPPLIER_RISK — trailing-90-day vendor returns + QC failures from `computeSupplierReport`.
function evalSupplierExceptions({ data }: EvalContext): ScmException[] {
  const { rows } = computeSupplierReport(
    data,
    presetRange("90d"),
    EMPTY_FILTERS,
  );
  const out: ScmException[] = [];
  for (const row of rows) {
    const incidents = row.vendorReturnCount + row.qcFailureCount;
    if (incidents < SUPPLIER_RISK_INCIDENT_THRESHOLD) continue;
    const vendor = data.vendors.find((v) => v.id === row.vendorId);
    const statusNote =
      vendor && !isSupplierActive(vendor.status)
        ? ` (status: ${vendor.status})`
        : "";
    out.push({
      id: exceptionKey("SUPPLIER_RISK", row.vendorId),
      type: "SUPPLIER_RISK",
      severity:
        incidents >= SUPPLIER_RISK_INCIDENT_THRESHOLD * 2 ? "High" : "Medium",
      title: `${row.vendorName} has ${plural(incidents, "recent supply issue")}`,
      description: `${row.vendorReturnCount} vendor return(s) and ${row.qcFailureCount} QC failure(s) in the last 90 days${statusNote}.`,
      source: "Suppliers",
      sourceId: row.vendorId,
      vendorId: row.vendorId,
      vendorName: row.vendorName,
      navigationPath: `/scm/suppliers/${row.vendorId}`,
    });
  }
  return out;
}

/** Evaluates every rule against the current data and returns the full, fresh set of open
 * exceptions. Pure — persistence, notification and audit live in `scmAutomationService.ts`.
 * Optional fields a rule has no value for are omitted (never `undefined`). */
export function evaluateExceptions(
  data: ScmReportsRawData,
  now = Date.now(),
): ScmException[] {
  const warehouseById = new Map(data.warehouses.map((w) => [w.id, w]));
  const ctx: EvalContext = {
    data,
    now,
    today: new Date(now),
    warehouseName: (id) => lookupWarehouseName(warehouseById, id),
  };
  return [
    ...evalStockExceptions(ctx),
    ...evalProcurementExceptions(ctx),
    ...evalWarehouseOpsExceptions(ctx),
    ...evalFulfillmentExceptions(ctx),
    ...evalLogisticsExceptions(ctx),
    ...evalReturnsExceptions(ctx),
    ...evalQualityExceptions(ctx),
    ...evalSupplierExceptions(ctx),
  ].map((e) => stripUndefined(e));
}
