// Phase 12b — SCM Master Data. Types only. This layer aggregates EXISTING ERP master records —
// no new master collection is introduced anywhere in this domain. See `useScmMasterData.ts` for
// exactly which Firebase paths back each entity, and why categories/brands/UOM/payment-terms/
// GST/employees are deliberately NOT included here (no standalone master collection backs them —
// see the `/master/sales` and `/hr/employees` link-out cards on `ScmMasterData.tsx` instead).
export type ScmMasterEntityType =
  | "PRODUCT"
  | "VENDOR"
  | "CUSTOMER"
  | "WAREHOUSE"
  | "LOCATION"
  | "BATCH"
  | "SERIAL"
  | "CARRIER";

export const MASTER_ENTITY_LABEL: Record<ScmMasterEntityType, string> = {
  PRODUCT: "Product",
  VENDOR: "Vendor",
  CUSTOMER: "Customer",
  WAREHOUSE: "Warehouse",
  LOCATION: "Location",
  BATCH: "Batch",
  SERIAL: "Serial Number",
  CARRIER: "Carrier",
};
