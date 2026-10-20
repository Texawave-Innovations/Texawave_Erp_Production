// Central Firebase Realtime Database path constants for the SCM Quality Control domain
// (Phase 9), mirroring the convention set by `returns/returnsPaths.ts`, `logistics/logisticsPaths.ts`,
// `orders/orderPaths.ts` and `procurement/procurementPaths.ts`. Quality is the centralized
// inspection engine for Incoming (GRN), Customer Return, Inventory and Pre-Dispatch QC — source
// documents (GoodsReceipt / ScmReturn / OrderFulfillment) are referenced by id, never
// duplicated here.
export const QUALITY_PATHS = {
  inspections: "scm/quality/inspections",
  templates: "scm/quality/templates",
  defects: "scm/quality/defects",
  quarantine: "scm/quality/quarantine",
} as const;
