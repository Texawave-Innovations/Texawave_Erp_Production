// The SCM Copilot's "brain", ported from the legacy
// TexaWave_ERP_old/src/modules/scm/ai (scmAiIntent.ts + scmAiService.ts).
//
// It is deliberately NOT a hosted LLM: a local, deterministic, scored intent
// classifier picks one of a closed set of question categories, and a pure
// builder turns the live figures for that category into a short ERP-style
// answer with deep links. Every number comes from the organization's own data
// (see assistant.repository.ts); when a source is empty the answer says so
// instead of inventing data. No network call, no API key.

export type AssistantIntent =
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
  | "supplier_bills"
  | "advanced_scm"
  | "scm_summary"
  | "help"
  | "unknown";

export interface NavAction {
  label: string;
  path: string;
}

export interface AssistantReply {
  intent: AssistantIntent;
  answer: string;
  navActions: NavAction[];
}

interface Phrase {
  text: string;
  weight: number;
}
interface IntentRule {
  id: AssistantIntent;
  phrases: Phrase[];
}

const p = (text: string, weight: number): Phrase => ({ text, weight });

/** Weight guide: 1 = generic single word, 2-3 = a fairly specific word or
 * short phrase, 4 = an unambiguous multi-word phrase. Scored (not
 * first-match) so a question with words from two domains resolves to the more
 * specific one, e.g. "supplier purchase orders" -> purchase orders. Plain
 * case-insensitive substring matching, so inflections are listed explicitly. */
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
      p("overdue po", 3),
      p("overdue pos", 3),
      p("late po", 3),
      p("late delivery", 2),
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
      p("low on stock", 4),
      p("what is low on stock", 4),
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
      p("restock", 2),
      p("what should we reorder", 4),
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
      p("in transit", 3),
    ],
  },
  {
    id: "returns_status",
    phrases: [
      p("return", 1),
      p("returns", 1),
      p("disposition", 2),
      p("restock", 1),
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
      p("qc", 1),
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
    id: "supplier_bills",
    phrases: [
      p("bill", 2),
      p("bills", 2),
      p("payable", 3),
      p("payables", 3),
      p("accounts payable", 4),
      p("supplier bill", 4),
      p("supplier bills", 4),
      p("vendor bill", 4),
      p("vendor bills", 4),
      p("overdue bill", 4),
      p("overdue bills", 4),
      p("unpaid bill", 4),
      p("unpaid bills", 4),
      p("supplier payment", 3),
      p("supplier payments", 3),
      p("payments made", 3),
      p("how much do we owe", 4),
      p("outstanding amount", 3),
      p("amount due", 3),
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
      p("open issues", 3),
      p("any problems", 3),
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

export function detectIntent(input: string): AssistantIntent {
  const text = input.toLowerCase();
  let bestId: AssistantIntent = "unknown";
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

// ---- live figures per intent ---------------------------------------------------

export interface AssistantFacts {
  suppliers?: { total: number; byStatus: Record<string, number> };
  supplierPerformance?: Array<{
    name: string;
    poCount: number;
    poValue: number;
    returnCount: number;
    qcFailureCount: number;
  }>;
  purchaseOrders?: { open: number; overdue: number; total: number };
  requisitions?: { total: number; open: number };
  rfqs?: { rfqs: number; quotations: number };
  lowStock?: Array<{
    productName: string;
    productCode: string;
    warehouse: string;
    available: number;
    recommendedQty: number;
  }>;
  inventory?: {
    skus: number;
    onHand: number;
    available: number;
    reserved: number;
    incoming: number;
    value: number | null;
    lowStock: number;
    outOfStock: number;
  };
  warehouse?: {
    warehouses: number;
    active: number;
    locations: number;
    putaways: number;
    movements: number;
    picks: number;
    packs: number;
  };
  fulfillment?: {
    salesOrders: number;
    fulfillments: number;
    open: number;
    backorders: number;
    completionRate: number;
  };
  logistics?: {
    shipments: number;
    pending: number;
    inTransit: number;
    delivered: number;
    exceptions: number;
    recent: Array<{ number: string; status: string }>;
  };
  returns?: { total: number; open: number; customer: number; vendor: number };
  quality?: {
    inspections: number;
    passed: number;
    failed: number;
    onHold: number;
    quarantined: number;
    critical: number;
  };
  bills?: {
    open: number;
    outstanding: number;
    overdue: number;
    overdueAmount: number;
    paidThisMonth: number;
  };
  controlTower?: Array<{ title: string; severity: string }>;
}

const fmtNum = (n: number) =>
  new Intl.NumberFormat("en-IN").format(Math.round(n * 100) / 100);
const fmtMoney = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);
const fmtPct = (n: number) => `${(Math.round(n * 10) / 10).toFixed(1)}%`;
const plural = (n: number, word: string) =>
  `${fmtNum(n)} ${word}${n === 1 ? "" : "s"}`;
const nav = (label: string, path: string): NavAction => ({ label, path });

export const WELCOME =
  "Hi! I'm Texa SCM Copilot. I can help you understand suppliers, procurement, inventory, warehouse operations, fulfillment, logistics, returns, quality, supplier bills and SCM reports.";

export const SUGGESTED_PROMPTS = [
  "Show SCM summary",
  "Which suppliers do we have?",
  "Show pending purchase orders",
  "Which products are low in stock?",
  "Show inventory status",
  "Show warehouse status",
  "Show pending/backordered orders",
  "Show shipment status",
  "Show returns",
  "Show quality issues",
  "Show supplier performance",
  "Show overdue supplier bills",
  "Open Control Tower",
];

type Builder = (f: AssistantFacts) => Omit<AssistantReply, "intent">;

const BUILDERS: Partial<Record<AssistantIntent, Builder>> = {
  suppliers: (f) => {
    const s = f.suppliers;
    if (!s || s.total === 0) {
      return {
        answer: "No suppliers have been added yet.",
        navActions: [nav("Open Suppliers", "/scm/suppliers")],
      };
    }
    const lines = [`Currently, ${plural(s.total, "supplier")} on record.`, ""];
    lines.push(`Active: ${fmtNum(s.byStatus["Active"] ?? 0)}`);
    lines.push(`Inactive: ${fmtNum(s.byStatus["Inactive"] ?? 0)}`);
    if (s.byStatus["Pending Approval"])
      lines.push(`Pending Approval: ${fmtNum(s.byStatus["Pending Approval"])}`);
    if (s.byStatus["Blocked"])
      lines.push(`Blocked: ${fmtNum(s.byStatus["Blocked"])}`);
    return {
      answer: lines.join("\n"),
      navActions: [nav("Open Suppliers", "/scm/suppliers")],
    };
  },

  supplier_performance: (f) => {
    const rows = f.supplierPerformance ?? [];
    if (rows.length === 0) {
      return {
        answer: "No supplier performance data is currently available.",
        navActions: [nav("Open Supplier Report", "/scm/reports/suppliers")],
      };
    }
    const top = rows
      .slice(0, 5)
      .map(
        (r) =>
          `• ${r.name} — ${plural(r.poCount, "PO")}, ${fmtMoney(r.poValue)}, ${plural(r.returnCount, "return")}, ${plural(r.qcFailureCount, "QC failure")}`,
      );
    return {
      answer: `Supplier Performance (top ${top.length} by PO value)\n\n${top.join("\n")}`,
      navActions: [
        nav("Open Supplier Report", "/scm/reports/suppliers"),
        nav("Open Suppliers", "/scm/suppliers"),
      ],
    };
  },

  pending_purchase_orders: (f) => {
    const po = f.purchaseOrders ?? { open: 0, overdue: 0, total: 0 };
    const lines = [
      `SCM currently has ${plural(po.open, "pending purchase order")}.`,
    ];
    if (po.overdue > 0)
      lines.push(
        `${plural(po.overdue, "order")} past the expected delivery date.`,
      );
    lines.push("", "Source: SCM Procurement Purchase Orders.");
    return {
      answer: lines.join("\n"),
      navActions: [
        nav("Open Purchase Orders", "/scm/procurement/purchase-orders"),
      ],
    };
  },

  purchase_requisitions: (f) => {
    const r = f.requisitions ?? { total: 0, open: 0 };
    if (r.total === 0) {
      return {
        answer: "No material requisitions have been raised yet.",
        navActions: [
          nav("Open Material Requisitions", "/scm/procurement/requisitions"),
        ],
      };
    }
    return {
      answer: `${plural(r.total, "material requisition")} on record — ${fmtNum(r.open)} open, ${fmtNum(r.total - r.open)} closed (rejected/cancelled/converted).`,
      navActions: [
        nav("Open Material Requisitions", "/scm/procurement/requisitions"),
      ],
    };
  },

  rfqs_quotations: (f) => {
    const r = f.rfqs ?? { rfqs: 0, quotations: 0 };
    if (r.rfqs === 0 && r.quotations === 0) {
      return {
        answer: "No RFQs or supplier quotations have been recorded yet.",
        navActions: [nav("Open RFQs", "/scm/procurement/rfqs")],
      };
    }
    return {
      answer: `${plural(r.rfqs, "RFQ")} sent, ${plural(r.quotations, "supplier quotation")} received.`,
      navActions: [
        nav("Open RFQs", "/scm/procurement/rfqs"),
        nav("Open Supplier Quotations", "/scm/procurement/quotations"),
      ],
    };
  },

  low_stock_inventory: (f) => {
    const rows = f.lowStock ?? [];
    if (rows.length === 0) {
      return {
        answer:
          "No products are currently below their reorder level. Stock levels look healthy.",
        navActions: [nav("Open Stock Overview", "/scm/inventory/overview")],
      };
    }
    const lines = rows
      .slice(0, 8)
      .map(
        (r) =>
          `• ${r.productName} (${r.warehouse}) — ${fmtNum(r.available)} available, reorder ${fmtNum(r.recommendedQty)}`,
      );
    return {
      answer: `${plural(rows.length, "product")} below reorder level:\n\n${lines.join("\n")}`,
      navActions: [
        nav("Open Replenishment", "/scm/advanced/replenishment"),
        nav("Open Stock Overview", "/scm/inventory/overview"),
      ],
    };
  },

  inventory_status: (f) => {
    const k = f.inventory;
    if (!k || k.skus === 0) {
      return {
        answer: "No inventory transaction data is currently available.",
        navActions: [nav("Open Stock Overview", "/scm/inventory/overview")],
      };
    }
    const lines = [
      `Total SKUs: ${fmtNum(k.skus)}`,
      `Units on hand: ${fmtNum(k.onHand)}`,
      `Available: ${fmtNum(k.available)}`,
      `Reserved: ${fmtNum(k.reserved)}`,
      `Incoming: ${fmtNum(k.incoming)}`,
      `Inventory value: ${k.value == null ? "N/A (no costed items)" : fmtMoney(k.value)}`,
      `Low stock items: ${fmtNum(k.lowStock)}`,
      `Out of stock items: ${fmtNum(k.outOfStock)}`,
    ];
    return {
      answer: lines.join("\n"),
      navActions: [nav("Open Stock Overview", "/scm/inventory/overview")],
    };
  },

  warehouse_status: (f) => {
    const k = f.warehouse;
    if (!k || k.warehouses === 0) {
      return {
        answer: "No warehouses have been set up yet.",
        navActions: [nav("Open Warehouses", "/scm/warehouses")],
      };
    }
    const lines = [
      `Warehouses: ${fmtNum(k.warehouses)} (${fmtNum(k.active)} active)`,
      `Locations: ${fmtNum(k.locations)}`,
      `Put-aways: ${fmtNum(k.putaways)}`,
      `Internal movements: ${fmtNum(k.movements)}`,
      `Picks: ${fmtNum(k.picks)}`,
      `Packs: ${fmtNum(k.packs)}`,
    ];
    return {
      answer: lines.join("\n"),
      navActions: [nav("Open Warehouse Dashboard", "/scm/warehouse")],
    };
  },

  fulfillment_status: (f) => {
    const k = f.fulfillment;
    if (!k || k.fulfillments === 0) {
      return {
        answer: "No order fulfillments have been recorded yet.",
        navActions: [nav("Open Fulfillment", "/scm/orders/fulfillment")],
      };
    }
    const lines = [
      `Sales orders: ${fmtNum(k.salesOrders)}`,
      `Fulfillment orders: ${fmtNum(k.fulfillments)} (${fmtNum(k.open)} open)`,
      `Backorders: ${fmtNum(k.backorders)}`,
      `Completion rate: ${fmtPct(k.completionRate)}`,
    ];
    return {
      answer: lines.join("\n"),
      navActions: [
        nav("Open Fulfillment", "/scm/orders/fulfillment"),
        nav("Open Backorders", "/scm/orders/backorders"),
      ],
    };
  },

  logistics_shipments: (f) => {
    const k = f.logistics;
    if (!k || k.shipments === 0) {
      return {
        answer: "No shipments have been recorded yet.",
        navActions: [nav("Open Shipments", "/scm/logistics/shipments")],
      };
    }
    const lines = [
      `Shipments: ${fmtNum(k.shipments)}`,
      `Pending: ${fmtNum(k.pending)}  |  In transit: ${fmtNum(k.inTransit)}  |  Delivered: ${fmtNum(k.delivered)}`,
      `Exceptions: ${fmtNum(k.exceptions)}`,
    ];
    if (k.recent.length > 0) {
      lines.push("", "Most recent:");
      for (const s of k.recent.slice(0, 5))
        lines.push(`• ${s.number} — ${s.status.replace(/_/g, " ")}`);
    }
    return {
      answer: lines.join("\n"),
      navActions: [
        nav("Open Shipments", "/scm/logistics/shipments"),
        nav("Open Tracking", "/scm/logistics/tracking"),
      ],
    };
  },

  returns_status: (f) => {
    const k = f.returns;
    if (!k || k.total === 0) {
      return {
        answer: "No returns have been recorded — nothing open right now.",
        navActions: [nav("Open Returns", "/scm/returns")],
      };
    }
    const lines = [
      `Open returns: ${fmtNum(k.open)} of ${fmtNum(k.total)} total.`,
      `Customer returns: ${fmtNum(k.customer)}  |  Vendor returns: ${fmtNum(k.vendor)}`,
    ];
    return {
      answer: lines.join("\n"),
      navActions: [
        nav("Open Returns", "/scm/returns"),
        nav("Open All Returns", "/scm/returns/all"),
      ],
    };
  },

  quality_status: (f) => {
    const k = f.quality;
    if (!k || k.inspections === 0) {
      return {
        answer: "No quality inspections have been recorded yet.",
        navActions: [nav("Open Quality Overview", "/scm/quality")],
      };
    }
    const lines = [
      `Inspections: ${fmtNum(k.inspections)}`,
      `Passed: ${fmtNum(k.passed)}  |  Failed: ${fmtNum(k.failed)}  |  On hold: ${fmtNum(k.onHold)}`,
      `Quarantined items: ${fmtNum(k.quarantined)}`,
      `Critical defects: ${fmtNum(k.critical)}`,
    ];
    return {
      answer: lines.join("\n"),
      navActions: [
        nav("Open Quality Overview", "/scm/quality"),
        nav("Open Quarantine", "/scm/quality/quarantine"),
      ],
    };
  },

  supplier_bills: (f) => {
    const b = f.bills;
    if (!b || (b.open === 0 && b.paidThisMonth === 0)) {
      return {
        answer:
          "No open supplier bills right now. Bills are recorded on each supplier's Bills tab.",
        navActions: [nav("Open Suppliers", "/scm/suppliers")],
      };
    }
    const lines = [
      `Open supplier bills: ${fmtNum(b.open)} — ${fmtMoney(b.outstanding)} outstanding.`,
      b.overdue > 0
        ? `Overdue: ${fmtNum(b.overdue)} bill(s), ${fmtMoney(b.overdueAmount)}.`
        : "Nothing is overdue.",
      `Paid to suppliers this month: ${fmtMoney(b.paidThisMonth)}.`,
    ];
    return {
      answer: lines.join("\n"),
      navActions: [nav("Open Suppliers", "/scm/suppliers")],
    };
  },

  advanced_scm: (f) => {
    const rows = f.controlTower ?? [];
    const intro =
      rows.length === 0
        ? "No open exceptions on the Control Tower right now."
        : `${plural(rows.length, "open exception")}:\n\n${rows
            .slice(0, 6)
            .map((e) => `• [${e.severity}] ${e.title}`)
            .join("\n")}`;
    return {
      answer: [
        intro,
        "",
        "Advanced SCM also covers:",
        "• Control Tower — live operational exceptions across every SCM area",
        "• Replenishment — deterministic reorder recommendations",
      ].join("\n"),
      navActions: [
        nav("Open Control Tower", "/scm/advanced/control-tower"),
        nav("Open Replenishment", "/scm/advanced/replenishment"),
      ],
    };
  },

  scm_summary: (f) => {
    const inv = f.inventory;
    const inventoryLine =
      !inv || inv.skus === 0
        ? "No transaction data available"
        : `${fmtNum(inv.onHand)} units on hand, ${fmtNum(inv.lowStock)} low stock`;
    const lines = [
      "SCM Summary",
      "",
      `Suppliers: ${fmtNum(f.suppliers?.total ?? 0)}`,
      `Pending POs: ${fmtNum(f.purchaseOrders?.open ?? 0)}`,
      `Inventory: ${inventoryLine}`,
      `Shipments: ${fmtNum(f.logistics?.shipments ?? 0)}`,
      `Returns: ${fmtNum(f.returns?.total ?? 0)}`,
      `QC inspections: ${fmtNum(f.quality?.inspections ?? 0)}`,
      `Open supplier bills: ${fmtNum(f.bills?.open ?? 0)}`,
      "",
      "You can ask me about any SCM area for more details.",
    ];
    return {
      answer: lines.join("\n"),
      navActions: [
        nav("Open SCM Reports", "/scm/reports"),
        nav("Open SCM Overview", "/scm/overview"),
      ],
    };
  },
};

export function buildReply(
  intent: AssistantIntent,
  facts: AssistantFacts,
): AssistantReply {
  if (intent === "help") {
    return {
      intent,
      answer: `${WELCOME}\n\nTry one of the suggestions below, or ask about suppliers, procurement, inventory, warehouse, fulfillment, logistics, returns, quality, supplier bills or reports.`,
      navActions: [],
    };
  }
  const builder = BUILDERS[intent];
  if (!builder) {
    return {
      intent: "unknown",
      answer:
        "I didn't quite catch that. I can help with suppliers, procurement, inventory, warehouse operations, fulfillment, logistics, returns, quality, supplier bills, or an overall SCM summary — try rephrasing, or pick a suggestion below.",
      navActions: [],
    };
  }
  return { intent, ...builder(facts) };
}
