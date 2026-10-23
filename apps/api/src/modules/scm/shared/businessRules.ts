// Single definitions of the SCM business rules that more than one screen depends on. Dashboards,
// reports, the exception engine and the overview must all import from here so the same KPI can
// never be computed with different status sets on different pages.
import type {
  FulfillmentStatus,
  ScmPOStatus,
  ShipmentStatus,
  ScmReturnStatus,
  VendorStatus,
  ScmQualityInspectionStatus,
} from "@/types";
import type { GrnStatus, RequisitionStatus } from "@/types";

/** POs that are committed to the supplier and still expecting goods. */
export const OPEN_PO_STATUSES: ReadonlySet<ScmPOStatus> = new Set<ScmPOStatus>([
  "APPROVED",
  "SENT",
  "PARTIALLY_RECEIVED",
]);

/** POs a GRN may be received against. Approval alone is not enough — the PO must be sent. */
export const RECEIVABLE_PO_STATUSES: ReadonlySet<ScmPOStatus> =
  new Set<ScmPOStatus>(["SENT", "PARTIALLY_RECEIVED"]);

/** Sales-order statuses (legacy Sales module) that may be fulfilled from stock. */
export const FULFILLABLE_SO_STATUSES: ReadonlySet<string> = new Set([
  "Approved",
  "Confirmed",
  "In Production",
  "QC",
  "Ready",
]);

/** Sales-order statuses that still represent open demand (includes not-yet-approved orders). */
export const OPEN_SO_STATUSES: ReadonlySet<string> = new Set([
  "Pending",
  "Draft",
  ...FULFILLABLE_SO_STATUSES,
]);

/** Quality inspections still awaiting or undergoing inspection (not yet completed/cancelled). */
export const OPEN_INSPECTION_STATUSES: ReadonlySet<ScmQualityInspectionStatus> =
  new Set<ScmQualityInspectionStatus>(["PENDING_INSPECTION", "IN_PROGRESS"]);

/** Shipments created but not yet handed to the carrier. */
export const PENDING_SHIPMENT_STATUSES: ReadonlySet<ShipmentStatus> =
  new Set<ShipmentStatus>([
    "DRAFT",
    "READY_TO_SHIP",
    "CARRIER_ASSIGNED",
    "LABEL_CREATED",
  ]);

/** Shipments with the carrier and not yet delivered. */
export const IN_TRANSIT_SHIPMENT_STATUSES: ReadonlySet<ShipmentStatus> =
  new Set<ShipmentStatus>(["DISPATCHED", "IN_TRANSIT", "OUT_FOR_DELIVERY"]);

/** Shipments that need attention. */
export const PROBLEM_SHIPMENT_STATUSES: ReadonlySet<ShipmentStatus> =
  new Set<ShipmentStatus>(["DELIVERY_EXCEPTION", "FAILED_DELIVERY"]);

/** Fulfillments that are finished one way or the other. */
export const CLOSED_FULFILLMENT_STATUSES: ReadonlySet<FulfillmentStatus> =
  new Set<FulfillmentStatus>(["FULFILLED", "CANCELLED"]);

/** Returns waiting for an approval decision. */
export const PENDING_APPROVAL_RETURN_STATUSES: ReadonlySet<ScmReturnStatus> =
  new Set<ScmReturnStatus>(["REQUESTED", "PENDING_APPROVAL"]);

/** Suppliers that may be sent RFQs or POs. Records without a status predate the field and are
 *  treated as active. */
export function isSupplierActive(status: VendorStatus | undefined): boolean {
  return !status || status === "Active";
}

/** Stock is valued at cost, never at selling price. */
export function stockValue(
  onHand: number,
  costPrice: number | undefined,
): number {
  return (onHand || 0) * (costPrice || 0);
}

/** Quantity still to be received on a PO line. */
export function pendingReceiptQty(line: {
  quantity: number;
  receivedQuantity?: number;
}): number {
  return Math.max(0, (line.quantity || 0) - (line.receivedQuantity || 0));
}

/** Multiplier over the reorder level above which stock is flagged as overstock. */
export const OVERSTOCK_MULTIPLE = 5;

/** Requisitions still awaiting a decision or conversion (not rejected, cancelled or converted). */
export const OPEN_REQUISITION_STATUSES: ReadonlySet<RequisitionStatus> =
  new Set<RequisitionStatus>([
    "DRAFT",
    "SUBMITTED",
    "UNDER_REVIEW",
    "APPROVED",
  ]);

/** GRNs whose quantities have actually been received (drafts and cancelled receipts excluded). */
export function isPostedGrn(status: GrnStatus): boolean {
  return status !== "DRAFT" && status !== "CANCELLED";
}
