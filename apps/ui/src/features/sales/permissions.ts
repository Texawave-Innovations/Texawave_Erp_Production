/**
 * Sales permission codes, for UI visibility only — the API guards every
 * route and is authoritative. Sales is organization-scoped, so these are
 * exact codes (no `.own/.team/.all`). Catalogue:
 * packages/database/prisma/permissions/catalog.ts.
 */
export const SALES_PERMISSIONS = {
  dashboardRead: "sales.dashboard.read",
  customerRead: "sales.customer.read",
  customerWrite: "sales.customer.write",
  customerDelete: "sales.customer.delete",
  customerBankReveal: "sales.customer_bank.reveal",
  actionItemRead: "sales.action_item.read",
  actionItemWrite: "sales.action_item.write",
} as const;
