// HANDWRITTEN — mirrors apps/api/src/modules/scm/master-list-items/. See
// packages/api-types/README.md. Nothing generates these yet
// (Docs/ARCHITECTURE.md §2) — update by hand if the backend DTOs change.

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

/** SCM Master page — `scm/master-list-items`, one generic resource behind
 * `category`. */
export interface ScmMasterListItem {
  id: number;
  organizationId: number;
  category: ScmMasterListCategory;
  value: string;
  numericValue: number | null;
  customFields: Record<string, unknown>;
  createdBy: number | null;
  updatedBy: number | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface CreateScmMasterListItemInput {
  category: ScmMasterListCategory;
  value: string;
  numericValue?: number | undefined;
  customFields?: Record<string, unknown> | undefined;
}

export type UpdateScmMasterListItemInput = Partial<
  Omit<CreateScmMasterListItemInput, "category">
>;

export interface QueryScmMasterListItemsInput {
  category: ScmMasterListCategory;
  page?: number | undefined;
  limit?: number | undefined;
  order?: "asc" | "desc" | undefined;
}
