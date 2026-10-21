/**
 * Client-demo view (Amber Wings): a deliberately narrow SCM — Material
 * Requisitions → Purchase Orders → Goods Receipts → Put-away → Stock, driven
 * by barcode scanning, for a single warehouse. Nothing is deleted: RFQs,
 * quotations, sales orders, quality etc. are only hidden from the navigation
 * and dashboards (their routes still resolve), and one implicit "default"
 * warehouse is used behind the scenes instead of a warehouse picker.
 *
 * Opt in with `NEXT_PUBLIC_SCM_CLIENT_DEMO=true`. It is OFF by default so the
 * full SCM is always available.
 */
export const SCM_CLIENT_DEMO =
  process.env.NEXT_PUBLIC_SCM_CLIENT_DEMO === "true";

/** Menu codes kept in the client-demo navigation (groups with no kept leaf
 * disappear). Anything not listed is only hidden, never removed. */
export const SCM_DEMO_MENU_CODES: ReadonlySet<string> = new Set([
  "scm-overview",
  "scm-suppliers",
  "scm-barcode",
  "scm-procurement",
  "scm-requisitions",
  "scm-purchase-orders",
  "scm-grn",
  "scm-warehouse-dashboard",
  "scm-stock-overview",
  "scm-locations",
  "scm-putaway",
  "scm-movements",
  "scm-stock-ledger",
]);
