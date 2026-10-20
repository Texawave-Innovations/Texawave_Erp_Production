// Central Firebase Realtime Database path constants for the SCM Warehouse Management
// (Phase 5) domain, mirroring the convention set by `inventory/inventoryPaths.ts` and
// `procurement/procurementPaths.ts`. Phase 3's `scm/warehouses`/`scm/locations` stay put —
// imported from INVENTORY_PATHS wherever this domain needs them, never duplicated here.
export const WAREHOUSE_PATHS = {
  putaways: "scm/warehouse/putaways",
  movements: "scm/warehouse/movements",
  pickings: "scm/warehouse/pickings",
  packings: "scm/warehouse/packings",
} as const;
