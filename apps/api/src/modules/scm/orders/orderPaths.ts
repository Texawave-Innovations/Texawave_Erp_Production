// Central Firebase Realtime Database path constants for the SCM Order Fulfillment domain
// (Phase 6), mirroring the convention set by `inventory/inventoryPaths.ts`,
// `procurement/procurementPaths.ts` and `warehouse/warehousePaths.ts`. The canonical sales
// order source stays `sales/orderAcknowledgements` (from the legacy Sales module) — it is
// read directly wherever this domain needs it, never duplicated here.
export const ORDER_PATHS = {
  fulfillments: "scm/orders/fulfillments",
  /** Short-lived locks that stop two tabs/double clicks from running the same create action. */
} as const;
