/** Shared enums for the Finance Master foundation. */

/** `FinanceMasterListItem.category` — Finance Master page cards. */
export const FINANCE_MASTER_LIST_CATEGORIES = [
  "expense_type",
  "payment_mode",
] as const;
export type FinanceMasterListCategory =
  (typeof FINANCE_MASTER_LIST_CATEGORIES)[number];
