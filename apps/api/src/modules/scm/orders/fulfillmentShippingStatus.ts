import { updateRecord, getRecordsWhere } from "@/services/firebase";
import { ORDER_PATHS } from "./orderPaths";
import { LOGISTICS_PATHS } from "../logistics/logisticsPaths";
import { SCM_CROSS_MODULE_PATHS } from "@/modules/scm/shared/crossModulePaths";
import type {
  FulfillmentDeliveryStatus,
  ScmShipment,
  ShipmentStatus,
} from "@/types";
import { loadFulfillment, loadSalesOrder } from "./fulfillmentStore";

const DISPATCHED_SHIPMENT_STATUSES = new Set<ShipmentStatus>([
  "DISPATCHED",
  "IN_TRANSIT",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "DELIVERY_EXCEPTION",
  "FAILED_DELIVERY",
]);

function packagedQtyByProduct(shipments: ScmShipment[]): Map<string, number> {
  const qty = new Map<string, number>();
  for (const s of shipments)
    for (const pkg of s.packages || [])
      for (const it of pkg.items || []) {
        qty.set(
          it.productCode,
          (qty.get(it.productCode) || 0) + (it.quantity || 0),
        );
      }
  return qty;
}

/** Rolls every dispatched shipment of a sales order into the legacy `shippedStatus` field
 * ('Not Shipped' | 'Partially Shipped' | 'Shipped'). Called on dispatch — goods count as shipped
 * when they leave with the carrier, not when stock is issued. Errors propagate. */
export async function updateSalesOrderShippedStatus(
  salesOrderId: string,
): Promise<void> {
  const order = await loadSalesOrder(salesOrderId);
  const shipments = await getRecordsWhere<ScmShipment>(
    LOGISTICS_PATHS.shipments,
    "salesOrderId",
    salesOrderId,
  );
  const shipped = packagedQtyByProduct(
    shipments.filter((s) => DISPATCHED_SHIPMENT_STATUSES.has(s.status)),
  );

  const ordered = new Map<string, number>();
  for (const li of order.lineItems || [])
    if (li.itemCode)
      ordered.set(
        li.itemCode,
        (ordered.get(li.itemCode) || 0) + (li.salesQty || 0),
      );
  let totalOrdered = 0,
    totalShipped = 0;
  for (const [code, qty] of ordered) {
    totalOrdered += qty;
    totalShipped += Math.min(qty, shipped.get(code) || 0);
  }
  const shippedStatus =
    totalShipped <= 0
      ? "Not Shipped"
      : totalShipped >= totalOrdered
        ? "Shipped"
        : "Partially Shipped";
  await updateRecord(SCM_CROSS_MODULE_PATHS.salesOrders, salesOrderId, {
    shippedStatus,
  });
}

/** Rolls a fulfillment's delivered shipments up into `deliveryStatus`/`deliveredAt`. */
export async function updateFulfillmentDeliveryStatus(
  fulfillmentId: string,
): Promise<void> {
  const f = await loadFulfillment(fulfillmentId);
  const shipments = await getRecordsWhere<ScmShipment>(
    LOGISTICS_PATHS.shipments,
    "fulfillmentId",
    fulfillmentId,
  );
  const delivered = packagedQtyByProduct(
    shipments.filter((s) => s.status === "DELIVERED"),
  );
  const issued = new Map<string, number>();
  for (const it of f.items)
    issued.set(
      it.itemCode,
      (issued.get(it.itemCode) || 0) + (it.issuedQty || 0),
    );

  let anyDelivered = false,
    allDelivered = issued.size > 0;
  for (const [code, qty] of issued) {
    if (qty <= 0) continue;
    const d = delivered.get(code) || 0;
    if (d > 0) anyDelivered = true;
    if (d < qty) allDelivered = false;
  }
  const deliveryStatus: FulfillmentDeliveryStatus = allDelivered
    ? "DELIVERED"
    : anyDelivered
      ? "PARTIALLY_DELIVERED"
      : "NOT_DELIVERED";
  await updateRecord(ORDER_PATHS.fulfillments, fulfillmentId, {
    deliveryStatus,
    deliveredAt: allDelivered ? Date.now() : null,
  });
}
