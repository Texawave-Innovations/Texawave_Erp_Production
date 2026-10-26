// HANDWRITTEN — mirrors apps/api/src/modules/finance-settings/. See
// packages/api-types/README.md. Nothing generates these yet
// (Docs/ARCHITECTURE.md §2) — update by hand if the backend DTOs change.

export const FINANCE_MASTER_LIST_CATEGORIES = [
  "expense_type",
  "payment_mode",
] as const;
export type FinanceMasterListCategory =
  (typeof FINANCE_MASTER_LIST_CATEGORIES)[number];

/** Finance Master page — `finance-settings/master-list-items`, one generic
 * resource behind `category`. */
export interface FinanceMasterListItem {
  id: number;
  organizationId: number;
  category: FinanceMasterListCategory;
  value: string;
  numericValue: number | null;
  customFields: Record<string, unknown>;
  createdBy: number | null;
  updatedBy: number | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface CreateFinanceMasterListItemInput {
  category: FinanceMasterListCategory;
  value: string;
  numericValue?: number | undefined;
  customFields?: Record<string, unknown> | undefined;
}

export type UpdateFinanceMasterListItemInput = Partial<
  Omit<CreateFinanceMasterListItemInput, "category">
>;

export interface QueryFinanceMasterListItemsInput {
  category: FinanceMasterListCategory;
  page?: number | undefined;
  limit?: number | undefined;
  order?: "asc" | "desc" | undefined;
}
