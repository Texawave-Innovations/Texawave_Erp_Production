// Central Firebase Realtime Database path constants for the SCM Logistics & Shipping domain
// (Phase 7), mirroring the convention set by `orders/orderPaths.ts` and `warehouse/warehousePaths.ts`.
// Phase 6 fulfillments (`scm/orders/fulfillments`) and Phase 5 packings (`scm/warehouse/packings`)
// stay put — imported from `ORDER_PATHS`/`WAREHOUSE_PATHS` wherever this domain needs them,
// never duplicated here.
export const LOGISTICS_PATHS = {
  shipments: "scm/logistics/shipments",
  carriers: "scm/logistics/carriers",
  trackingEvents: "scm/logistics/trackingEvents",
  exceptions: "scm/logistics/exceptions",
} as const;
