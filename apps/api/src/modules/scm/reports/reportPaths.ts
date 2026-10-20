// Central re-export of every Firebase Realtime Database path the Reports & Analytics
// module reads from. This file does NOT define any new authoritative data path — it only
// re-exports the *_PATHS constants already owned by each Phase 1-9 domain, plus the raw
// cross-module path strings those domains themselves read directly (vendor master, product
// master, sales orders). Reports must never invent a `scm/reports/...` data path for
// anything that already has a home; the module is read-only by construction.
export { INVENTORY_PATHS } from "../inventory/inventoryPaths";
export { PROCUREMENT_PATHS } from "../procurement/procurementPaths";
export { WAREHOUSE_PATHS } from "../warehouse/warehousePaths";
export { ORDER_PATHS } from "../orders/orderPaths";
export { LOGISTICS_PATHS } from "../logistics/logisticsPaths";
export { RETURNS_PATHS } from "../returns/returnsPaths";
export { QUALITY_PATHS } from "../quality/qualityPaths";

/** Cross-module paths read (never written) by Reports. */
export { SCM_CROSS_MODULE_PATHS as CROSS_MODULE_PATHS } from "../shared/crossModulePaths";
