// Shared types for the SCM AI Copilot widget. This module is purely additive — it defines
// only chat/UI/intent shapes and never a competing SCM data or business-logic type (those
// stay owned by their existing domain files under `scm/*`).

export type ScmAiRole = "user" | "bot";

export interface ScmAiNavAction {
  label: string;
  path: string;
}

export interface ScmAiMessage {
  id: string;
  role: ScmAiRole;
  text: string;
  navActions?: ScmAiNavAction[];
  timestamp: number;
}

/** One id per question category the Copilot understands (spec section 5/7). `unknown` and
 * `help` are the two catch-alls: `help` for an explicit "what can you do" style ask,
 * `unknown` for anything that matches no keyword rule. */
export type ScmAiIntentId =
  | "suppliers"
  | "supplier_performance"
  | "pending_purchase_orders"
  | "purchase_requisitions"
  | "rfqs_quotations"
  | "low_stock_inventory"
  | "inventory_status"
  | "warehouse_status"
  | "fulfillment_status"
  | "logistics_shipments"
  | "returns_status"
  | "quality_status"
  | "advanced_scm"
  | "scm_summary"
  | "help"
  | "unknown";

export interface ScmAiAnswer {
  text: string;
  navActions?: ScmAiNavAction[];
}
