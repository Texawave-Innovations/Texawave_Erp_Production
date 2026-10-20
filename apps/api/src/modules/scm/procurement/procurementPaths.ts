// Central Firebase Realtime Database path constants for the SCM Procurement domain
// (Phase 4), mirroring the convention set by `scm/inventory/inventoryPaths.ts`.
export const PROCUREMENT_PATHS = {
  requisitions: "scm/procurement/requisitions",
  rfqs: "scm/procurement/rfqs",
  quotations: "scm/procurement/quotations",
  comparisons: "scm/procurement/comparisons",
  purchaseOrders: "scm/procurement/purchaseOrders",
  grns: "scm/procurement/grns",
} as const;
