// HANDWRITTEN — mirrors
// apps/api/src/modules/crm/recycle-bin/ (controller, DTOs, registry). See
// packages/api-types/README.md.

export type CrmRecycleBinEntityType =
  | "account"
  | "lead"
  | "contact"
  | "opportunity"
  | "deal_product"
  | "pipeline_stage"
  | "product"
  | "quotation"
  | "meeting"
  | "follow_up"
  | "activity"
  | "task"
  | "document"
  | "note"
  | "cold_calling"
  | "mining_row"
  | "quota";

export interface CrmRecycleBinItem {
  entityType: CrmRecycleBinEntityType;
  entityTypeLabel: string;
  id: number;
  label: string;
  subtitle: string | null;
  deletedAt: string;
  /** User id of the last editor (the deleter) when the entity records it. */
  deletedBy: number | null;
  deletedByName?: string | null | undefined;
  /** Scalar-field snapshot of the deleted record. */
  data?: Record<string, unknown> | undefined;
  /** Records deleted together with this one (Accounts) — restored with it. */
  relatedCount?: number | undefined;
}

export interface QueryCrmRecycleBinInput {
  page?: number | undefined;
  limit?: number | undefined;
  entityType?: CrmRecycleBinEntityType | undefined;
  search?: string | undefined;
}

export interface CrmRecycleBinSummary {
  total: number;
  types: {
    entityType: CrmRecycleBinEntityType;
    entityTypeLabel: string;
    count: number;
  }[];
}
