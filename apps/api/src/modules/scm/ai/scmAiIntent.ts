import type { ScmAiIntentId } from "./scmAiTypes";

/**
 * Local, deterministic intent classifier — no external AI call, no network request. Every
 * phrase below is scored (not just "first match wins" like the original version) precisely so
 * a question containing words from two domains resolves to the more specific one: e.g. "show
 * supplier purchase orders" must resolve to `pending_purchase_orders`, not `suppliers`, because
 * "purchase order(s)" is a higher-weighted, more specific phrase than the bare word "supplier".
 * Weight guide: 1 = generic/ambiguous single word, 2-3 = a fairly specific word or short
 * phrase, 4 = an unambiguous multi-word phrase for that domain. Matching is plain
 * case-insensitive substring — deliberately not a stemmer/NLP model — so both the singular and
 * plural (and other common inflections, e.g. "backordered") of a word are listed explicitly
 * rather than relied on to generalize.
 */
interface Phrase {
  text: string;
  weight: number;
}
interface IntentRule {
  id: ScmAiIntentId;
  phrases: Phrase[];
}

const p = (text: string, weight: number): Phrase => ({ text, weight });

const RULES: IntentRule[] = [
  {
    id: "suppliers",
    phrases: [
      p("supplier", 1),
      p("suppliers", 1),
      p("vendor", 1),
      p("vendors", 1),
      p("list suppliers", 2),
      p("list vendors", 2),
      p("vendor code", 2),
      p("how many vendors", 2),
      p("how many suppliers", 2),
      p("active vendors", 2),
      p("active suppliers", 2),
      p("vendors are active", 2),
      p("suppliers are active", 2),
      p("tell me about our suppliers", 2),
    ],
  },
  {
    id: "supplier_performance",
    phrases: [
      p("supplier performance", 4),
      p("vendor performance", 4),
      p("supplier metrics", 3),
      p("delivery performance", 3),
      p("delivery issues", 3),
      p("on time rate", 3),
      p("on-time rate", 3),
      p("performing well", 3),
      p("top supplier", 2),
      p("top suppliers", 2),
      p("best supplier", 2),
      p("best suppliers", 2),
      p("supplier delivery", 2),
    ],
  },
  {
    id: "pending_purchase_orders",
    phrases: [
      p("purchase order", 3),
      p("purchase orders", 3),
      p("pending po", 3),
      p("pending pos", 3),
      p("po status", 3),
      p("procurement status", 3),
      p("open po", 2),
      p("open pos", 2),
      p("pos pending", 3),
      p("pos are open", 2),
      p("pos are pending", 2),
      p("any pending pos", 3),
    ],
  },
  {
    id: "purchase_requisitions",
    phrases: [
      p("requisition", 3),
      p("requisitions", 3),
      p("purchase request", 2),
      p("purchase requests", 2),
      p("pr status", 2),
      p("pending pr", 2),
      p("pending prs", 2),
      p("prs pending", 2),
      p("prs are pending", 2),
      p("what prs", 2),
      p("purchase request status", 3),
    ],
  },
  {
    id: "rfqs_quotations",
    phrases: [
      p("rfq", 3),
      p("rfqs", 3),
      p("quotation", 2),
      p("quotations", 2),
      p("request for quotation", 3),
      p("rfq summary", 3),
      p("pending quotation", 2),
      p("pending quotations", 2),
      p("quotation status", 3),
    ],
  },
  {
    id: "low_stock_inventory",
    phrases: [
      p("low stock", 4),
      p("low-stock", 4),
      p("low in stock", 4),
      p("running low", 4),
      p("stock shortage", 4),
      p("any stock shortage", 4),
      p("insufficient inventory", 4),
      p("insufficient stock", 4),
      p("low inventory", 4),
      p("need replenishment", 4),
      p("needs replenishment", 4),
      p("what items need replenishment", 4),
      p("below reorder", 4),
      p("below reorder level", 4),
      p("reorder level", 3),
      p("out of stock", 4),
      p("stock out", 3),
      p("stockout", 3),
      p("products are low", 3),
      p("which products are low", 4),
      p("items are low", 3),
    ],
  },
  {
    id: "inventory_status",
    phrases: [
      p("inventory", 1),
      p("stock status", 3),
      p("inventory status", 3),
      p("stock overview", 3),
      p("inventory summary", 3),
      p("how much stock", 3),
      p("on hand", 1),
      p("on-hand", 1),
      p("available stock", 2),
      p("batch", 1),
      p("serial number", 2),
      p("show inventory", 2),
    ],
  },
  {
    id: "warehouse_status",
    phrases: [
      p("warehouse", 1),
      p("warehouses", 1),
      p("zone", 1),
      p("rack", 1),
      p("shelf", 1),
      p("bin", 1),
      p("putaway", 2),
      p("put-away", 2),
      p("picking", 1),
      p("packing", 1),
      p("warehouse status", 3),
      p("warehouse summary", 3),
      p("inventory by warehouse", 3),
      p("which warehouse has stock", 3),
      p("show warehouses", 2),
    ],
  },
  {
    id: "fulfillment_status",
    phrases: [
      p("fulfillment", 2),
      p("fulfilment", 2),
      p("sales order", 2),
      p("sales orders", 2),
      p("backorder", 3),
      p("backorders", 3),
      p("backordered", 3),
      p("reservation", 1),
      p("allocation", 1),
      p("pending orders", 3),
      p("pending fulfillment", 4),
      p("orders waiting", 3),
      p("what orders are waiting", 3),
      p("show pending orders", 3),
      p("any backorders", 3),
      p("fulfillment status", 4),
    ],
  },
  {
    id: "logistics_shipments",
    phrases: [
      p("shipment", 2),
      p("shipments", 2),
      p("shipping", 1),
      p("carrier", 2),
      p("carriers", 2),
      p("tracking", 2),
      p("delivery status", 3),
      p("dispatch", 1),
      p("logistics", 2),
      p("logistics summary", 4),
      p("shipment status", 4),
      p("delayed shipment", 4),
      p("delayed shipments", 4),
      p("any delayed shipments", 4),
      p("what shipments are pending", 4),
      p("orders waiting to be shipped", 2),
    ],
  },
  {
    id: "returns_status",
    phrases: [
      p("return", 1),
      p("returns", 1),
      p("disposition", 2),
      p("restock", 2),
      p("scrap", 1),
      p("customer return", 2),
      p("customer returns", 2),
      p("vendor return", 2),
      p("vendor returns", 2),
      p("return summary", 4),
      p("return status", 4),
      p("pending returns", 4),
    ],
  },
  {
    id: "quality_status",
    phrases: [
      p("quality", 1),
      p("inspection", 2),
      p("inspections", 2),
      p("defect", 2),
      p("defects", 2),
      p("qc status", 4),
      p("qc summary", 4),
      p("qc issue", 3),
      p("qc issues", 3),
      p("rejected item", 3),
      p("rejected items", 3),
      p("quarantine", 2),
      p("quarantine status", 4),
      p("quality issue", 3),
      p("quality issues", 3),
      p("quality inspection status", 4),
    ],
  },
  {
    id: "advanced_scm",
    phrases: [
      p("control tower", 4),
      p("action center", 4),
      p("exception", 2),
      p("exceptions", 2),
      p("scm exceptions", 4),
      p("replenishment", 2),
      p("inventory intelligence", 4),
      p("supplier intelligence", 4),
    ],
  },
  {
    id: "scm_summary",
    phrases: [
      p("scm summary", 4),
      p("supply chain summary", 4),
      p("overall scm", 4),
      p("overall scm status", 4),
      p("scm dashboard", 4),
      p("scm overview", 3),
      p("how is supply chain doing", 4),
      p("give me a summary", 3),
      p("give me an scm summary", 4),
      p("summary of scm", 4),
      p("today's scm", 4),
      p("todays scm overview", 4),
      p("give me today's scm overview", 4),
    ],
  },
  {
    id: "help",
    phrases: [
      p("help", 2),
      p("what can you do", 4),
      p("who are you", 3),
      p("what are you", 3),
    ],
  },
];

export function detectIntent(input: string): ScmAiIntentId {
  const text = input.toLowerCase();
  let bestId: ScmAiIntentId = "unknown";
  let bestScore = 0;
  for (const rule of RULES) {
    let score = 0;
    for (const phrase of rule.phrases) {
      if (text.includes(phrase.text)) score += phrase.weight;
    }
    if (score > bestScore) {
      bestScore = score;
      bestId = rule.id;
    }
  }
  return bestId;
}
