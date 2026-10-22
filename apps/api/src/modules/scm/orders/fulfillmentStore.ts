import { getRecordById } from "@/services/firebase";
import { ORDER_PATHS } from "./orderPaths";
import { SCM_CROSS_MODULE_PATHS } from "@/modules/scm/shared/crossModulePaths";
import { normalizeFulfillment } from "./orderHelpers";
import type {
  FulfillmentStatus,
  OrderAcknowledgement,
  OrderFulfillment,
  PurchaseRequisition,
  RequisitionStatus,
} from "@/types";

/** Fulfillment statuses in which reserved stock is being worked on (picked/packed/issued). */
export const IN_PROGRESS_STATUSES: FulfillmentStatus[] = [
  "RESERVED",
  "PICKING",
  "PACKING",
  "READY_TO_SHIP",
];
/** Fulfillment statuses before any stock is reserved. */
export const PRE_RESERVE_STATUSES: FulfillmentStatus[] = [
  "PENDING",
  "STOCK_CHECK",
  "AVAILABLE",
  "PARTIALLY_AVAILABLE",
];
/** Requisition statuses that no longer cover a shortage. */
const CLOSED_REQUISITION_STATUSES = new Set<RequisitionStatus>([
  "REJECTED",
  "CANCELLED",
]);

export function isOpenRequisition(
  r: Pick<PurchaseRequisition, "status">,
): boolean {
  return !CLOSED_REQUISITION_STATUSES.has(r.status);
}

export async function loadFulfillment(id: string): Promise<OrderFulfillment> {
  const f = (await getRecordById(
    ORDER_PATHS.fulfillments,
    id,
  )) as OrderFulfillment | null;
  if (!f) throw new Error("Fulfillment not found. Refresh and try again.");
  return normalizeFulfillment(f);
}

export async function loadSalesOrder(
  id: string,
): Promise<OrderAcknowledgement> {
  const so = (await getRecordById(
    SCM_CROSS_MODULE_PATHS.salesOrders,
    id,
  )) as OrderAcknowledgement | null;
  if (!so) throw new Error("Sales order not found");
  return so;
}

export async function loadByIds<T>(path: string, ids: string[]): Promise<T[]> {
  const rows = await Promise.all(
    ids.map((id) => getRecordById(path, id) as Promise<T | null>),
  );
  return rows.filter((r): r is Awaited<T> & T => r !== null);
}
