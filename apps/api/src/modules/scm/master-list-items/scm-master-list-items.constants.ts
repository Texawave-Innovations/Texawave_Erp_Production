/** Shared enums for the SCM Master foundation. */

/** `ScmMasterListItem.category` — SCM Master page cards. */
export const SCM_MASTER_LIST_CATEGORIES = [
  "supplier_type",
  "package_type",
  "warehouse_type",
  "stock_adjustment_reason",
  "shipment_service_type",
  "shipment_exception_reason",
  "return_reason",
  "quality_defect_category",
  "requisition_priority",
  "supplier_document_type",
  "quality_defect_severity",
  "quality_inspection_priority",
] as const;
export type ScmMasterListCategory = (typeof SCM_MASTER_LIST_CATEGORIES)[number];
