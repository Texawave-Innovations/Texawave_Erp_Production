// The Copilot's "brain": maps a detected intent + the shared read-only SCM context into a
// short, ERP-style answer. Every number here comes from `useScmAiContext` (itself built on
// the existing Reports data hook/calculations) — this file never invents a number and never
// reads/writes Firebase directly. When a source has no records it says so honestly instead of
// fabricating data (spec section 6/7).
import type { ScmAiIntentId, ScmAiAnswer, ScmAiNavAction } from "./scmAiTypes";
import type { ScmAiContext } from "./scmAiContext";
import {
  formatCurrency,
  formatNumber,
  formatPercent,
} from "../reports/reportHelpers";
import { SCM_AI_WELCOME_MESSAGE } from "./scmAiPrompts";

// Same "still open, not yet fully received" definition `useScmOverviewData.ts` uses for its
// "Pending Purchase Orders" KPI on the SCM Overview home page — kept identical here so the
// Copilot's answer always agrees with what Overview shows.
const OPEN_PO_STATUSES = new Set([
  "DRAFT",
  "PENDING_APPROVAL",
  "APPROVED",
  "SENT",
]);
const CLOSED_REQUISITION_STATUSES = new Set([
  "REJECTED",
  "CANCELLED",
  "CONVERTED",
]);
const OPEN_RETURN_STATUSES = new Set([
  "REQUESTED",
  "PENDING_APPROVAL",
  "IN_TRANSIT",
  "SHIPPED",
  "RECEIVED",
  "VENDOR_RECEIVED",
]);

const nav = (label: string, path: string): ScmAiNavAction => ({ label, path });

function plural(n: number, word: string) {
  return `${formatNumber(n)} ${word}${n === 1 ? "" : "s"}`;
}

function answerSuppliers(ctx: ScmAiContext): ScmAiAnswer {
  const total = ctx.data.vendors.length;
  if (total === 0) {
    return {
      text: "No suppliers have been added yet.",
      navActions: [nav("Open Suppliers", "/scm/suppliers")],
    };
  }
  const c = ctx.supplierStatusCounts;
  const lines = [`Currently, ${plural(total, "supplier")} on record.`, ""];
  lines.push(`Active: ${formatNumber(c["Active"] || 0)}`);
  lines.push(`Inactive: ${formatNumber(c["Inactive"] || 0)}`);
  if (c["Pending Approval"])
    lines.push(`Pending Approval: ${formatNumber(c["Pending Approval"])}`);
  if (c["Blocked"]) lines.push(`Blocked: ${formatNumber(c["Blocked"])}`);
  return {
    text: lines.join("\n"),
    navActions: [nav("Open Suppliers", "/scm/suppliers")],
  };
}

function answerSupplierPerformance(ctx: ScmAiContext): ScmAiAnswer {
  const rows = ctx.computed?.supplierRows ?? [];
  if (rows.length === 0) {
    return {
      text: "No supplier performance data is currently available.",
      navActions: [
        nav("Open Supplier Intelligence", "/scm/suppliers/intelligence"),
      ],
    };
  }
  const top = rows
    .slice(0, 5)
    .map(
      (r) =>
        `• ${r.vendorName} — ${plural(r.poCount, "PO")}, ${formatCurrency(r.poValue)}, ${plural(r.vendorReturnCount, "return")}, ${plural(r.qcFailureCount, "QC failure")}`,
    );
  return {
    text: `Supplier Performance (top ${top.length} by PO value)\n\n${top.join("\n")}`,
    navActions: [
      nav("Open Supplier Intelligence", "/scm/suppliers/intelligence"),
      nav("Open Suppliers", "/scm/suppliers"),
    ],
  };
}

function answerPendingPOs(ctx: ScmAiContext): ScmAiAnswer {
  const pending = ctx.data.purchaseOrders.filter((p) =>
    OPEN_PO_STATUSES.has(p.status),
  );
  return {
    text: `SCM currently has ${plural(pending.length, "pending purchase order")}.\n\nSource: SCM Procurement Purchase Orders.`,
    navActions: [
      nav("Open Purchase Orders", "/scm/procurement/purchase-orders"),
    ],
  };
}

function answerRequisitions(ctx: ScmAiContext): ScmAiAnswer {
  const all = ctx.data.requisitions;
  const open = all.filter((r) => !CLOSED_REQUISITION_STATUSES.has(r.status));
  if (all.length === 0) {
    return {
      text: "No purchase requisitions have been raised yet.",
      navActions: [
        nav("Open Purchase Requisitions", "/scm/procurement/requisitions"),
      ],
    };
  }
  return {
    text: `${plural(all.length, "purchase requisition")} on record — ${plural(open.length, "open")}, ${plural(all.length - open.length, "closed")} (rejected/cancelled/converted).`,
    navActions: [
      nav("Open Purchase Requisitions", "/scm/procurement/requisitions"),
    ],
  };
}

function answerRfqsQuotations(ctx: ScmAiContext): ScmAiAnswer {
  const { rfqs, quotations } = ctx.data;
  if (rfqs.length === 0 && quotations.length === 0) {
    return {
      text: "No RFQs or supplier quotations have been recorded yet.",
      navActions: [nav("Open RFQs", "/scm/procurement/rfqs")],
    };
  }
  return {
    text: `${plural(rfqs.length, "RFQ")} sent, ${plural(quotations.length, "supplier quotation")} received.`,
    navActions: [
      nav("Open RFQs", "/scm/procurement/rfqs"),
      nav("Open Supplier Quotations", "/scm/procurement/quotations"),
    ],
  };
}

function answerLowStock(ctx: ScmAiContext): ScmAiAnswer {
  if (ctx.data.stockBalances.length === 0) {
    return {
      text: "No inventory transaction data is currently available.",
      navActions: [nav("Open Stock Overview", "/scm/inventory/overview")],
    };
  }
  const items = ctx.computed?.lowStockItems ?? [];
  if (items.length === 0) {
    return {
      text: "No products are currently below their reorder level. Stock levels look healthy.",
      navActions: [nav("Open Stock Overview", "/scm/inventory/overview")],
    };
  }
  const lines = items
    .slice(0, 8)
    .map(
      (i) =>
        `• ${i.productName} (${i.warehouseName}) — ${formatNumber(i.available)} available`,
    );
  return {
    text: `${plural(items.length, "product")} below reorder level:\n\n${lines.join("\n")}`,
    navActions: [nav("Open Stock Overview", "/scm/inventory/overview")],
  };
}

function answerInventory(ctx: ScmAiContext): ScmAiAnswer {
  if (ctx.data.stockBalances.length === 0) {
    return {
      text: "No inventory transaction data is currently available.",
      navActions: [nav("Open Stock Overview", "/scm/inventory/overview")],
    };
  }
  const k = ctx.computed!.summary.inventory;
  const lines = [
    `Total SKUs: ${formatNumber(k.totalSKUs)}`,
    `Units on hand: ${formatNumber(k.totalUnits)}`,
    `Available: ${formatNumber(k.available)}`,
    `Reserved: ${formatNumber(k.reserved)}`,
    `Incoming: ${formatNumber(k.incoming)}`,
    `Inventory value: ${k.inventoryValue == null ? "N/A (no costed items)" : formatCurrency(k.inventoryValue)}`,
    `Low stock items: ${formatNumber(k.lowStockCount)}`,
    `Out of stock items: ${formatNumber(k.outOfStockCount)}`,
  ];
  return {
    text: lines.join("\n"),
    navActions: [nav("Open Stock Overview", "/scm/inventory/overview")],
  };
}

function answerWarehouse(ctx: ScmAiContext): ScmAiAnswer {
  const k = ctx.computed?.summary.warehouse;
  if (!k || k.warehouseCount === 0) {
    return {
      text: "No warehouses have been set up yet.",
      navActions: [nav("Open Warehouses", "/scm/warehouse/warehouses")],
    };
  }
  const lines = [
    `Warehouses: ${formatNumber(k.warehouseCount)} (${formatNumber(k.activeWarehouseCount)} active)`,
    `Locations: ${formatNumber(k.locationCount)}`,
    `Put-aways: ${formatNumber(k.putawayCount)}`,
    `Internal movements: ${formatNumber(k.movementCount)}`,
    `Picks: ${formatNumber(k.pickingCount)}`,
    `Packs: ${formatNumber(k.packingCount)}`,
  ];
  return {
    text: lines.join("\n"),
    navActions: [nav("Open Warehouse Dashboard", "/scm/warehouse")],
  };
}

function answerFulfillment(ctx: ScmAiContext): ScmAiAnswer {
  const k = ctx.computed?.summary.fulfillment;
  if (!k || k.fulfillmentCount === 0) {
    return {
      text: "No order fulfillments have been recorded yet.",
      navActions: [nav("Open Fulfillment", "/scm/orders/fulfillment")],
    };
  }
  const lines = [
    `Sales orders: ${formatNumber(k.salesOrderCount)}`,
    `Fulfillment orders: ${formatNumber(k.fulfillmentCount)}`,
    `Backorders: ${formatNumber(k.backorderCount)}`,
    `Completion rate: ${formatPercent(k.completionRatePercent)}`,
  ];
  return {
    text: lines.join("\n"),
    navActions: [
      nav("Open Fulfillment", "/scm/orders/fulfillment"),
      nav("Open Backorders", "/scm/orders/backorders"),
    ],
  };
}

function answerLogistics(ctx: ScmAiContext): ScmAiAnswer {
  const k = ctx.computed?.summary.logistics;
  if (!k || k.shipmentCount === 0) {
    return {
      text: "No shipments have been recorded yet.",
      navActions: [nav("Open Shipments", "/scm/logistics/shipments")],
    };
  }
  const recent = ctx.computed?.recentShipments ?? [];
  const lines = [
    `Shipments: ${formatNumber(k.shipmentCount)}`,
    `Pending: ${formatNumber(k.pendingCount)}  |  In transit: ${formatNumber(k.inTransitCount)}  |  Delivered: ${formatNumber(k.deliveredCount)}`,
    `Exceptions: ${formatNumber(k.exceptionCount)}`,
  ];
  if (recent.length > 0) {
    lines.push("", "Most recent:");
    recent
      .slice(0, 5)
      .forEach((s) =>
        lines.push(
          `• ${s.shipmentNumber || s.id} — ${s.status.replace(/_/g, " ")}`,
        ),
      );
  }
  return {
    text: lines.join("\n"),
    navActions: [
      nav("Open Shipments", "/scm/logistics/shipments"),
      nav("Open Tracking", "/scm/logistics/tracking"),
    ],
  };
}

function answerReturns(ctx: ScmAiContext): ScmAiAnswer {
  const all = ctx.data.returns;
  if (all.length === 0) {
    return {
      text: "No returns have been recorded — nothing open right now.",
      navActions: [nav("Open Returns", "/scm/returns")],
    };
  }
  const open = all.filter((r) => OPEN_RETURN_STATUSES.has(r.status));
  const k = ctx.computed?.summary.returns;
  const lines = [
    `Open returns: ${formatNumber(open.length)} of ${formatNumber(all.length)} total.`,
    `Customer returns: ${formatNumber(k?.customerReturnCount ?? 0)}  |  Vendor returns: ${formatNumber(k?.vendorReturnCount ?? 0)}`,
  ];
  return {
    text: lines.join("\n"),
    navActions: [
      nav("Open Returns", "/scm/returns"),
      nav("Open All Returns", "/scm/returns/all"),
    ],
  };
}

function answerQuality(ctx: ScmAiContext): ScmAiAnswer {
  const k = ctx.computed?.summary.quality;
  if (!k || k.inspectionCount === 0) {
    return {
      text: "No quality inspections have been recorded yet.",
      navActions: [nav("Open Quality Overview", "/scm/quality")],
    };
  }
  const failures = ctx.computed?.recentFailures ?? [];
  const lines = [
    `Inspections: ${formatNumber(k.inspectionCount)}`,
    `Passed: ${formatNumber(k.passedCount)}  |  Failed: ${formatNumber(k.failedCount)}  |  On hold: ${formatNumber(k.onHoldCount)}`,
    `Quarantined items: ${formatNumber(k.quarantinedCount)}`,
    `Critical defects: ${formatNumber(k.criticalDefectCount)}`,
  ];
  if (failures.length > 0)
    lines.push(
      "",
      `${plural(failures.length, "recent failed inspection")} — see Quality → Inspections for details.`,
    );
  return {
    text: lines.join("\n"),
    navActions: [
      nav("Open Quality Overview", "/scm/quality"),
      nav("Open Quarantine", "/scm/quality/quarantine"),
    ],
  };
}

function answerAdvancedScm(): ScmAiAnswer {
  return {
    text: [
      "Advanced SCM gives you real-time exception tracking and recommendations, beyond what a plain summary can show:",
      "",
      "• Control Tower — live operational exceptions across every SCM area",
      "• Action Center — actionable work items grouped by category",
      "• Inventory Intelligence — stock health and fast/slow/dead-stock analysis",
      "• Replenishment — deterministic reorder recommendations",
      "• Supplier Intelligence — transparent supplier performance metrics",
      "",
      "Open one of these for live figures — I don't compute their numbers separately here.",
    ].join("\n"),
    navActions: [
      nav("Open Control Tower", "/scm/control-tower"),
      nav("Open Action Center", "/scm/action-center"),
      nav("Open Replenishment", "/scm/inventory/replenishment"),
    ],
  };
}

function answerSummary(ctx: ScmAiContext): ScmAiAnswer {
  const s = ctx.computed?.summary;
  const supplierCount = ctx.data.vendors.length;
  const pendingPOs = ctx.data.purchaseOrders.filter((p) =>
    OPEN_PO_STATUSES.has(p.status),
  ).length;
  const inventoryLine =
    ctx.data.stockBalances.length === 0
      ? "No transaction data available"
      : `${formatNumber(s!.inventory.totalUnits)} units on hand, ${formatNumber(s!.inventory.lowStockCount)} low stock`;
  const returnsTotal = ctx.data.returns.length;
  const lines = [
    "SCM Summary",
    "",
    `Suppliers: ${formatNumber(supplierCount)}`,
    `Pending POs: ${formatNumber(pendingPOs)}`,
    `Inventory: ${inventoryLine}`,
    `Shipments: ${formatNumber(s?.logistics.shipmentCount ?? 0)}`,
    `Returns: ${formatNumber(returnsTotal)}`,
    `QC inspections: ${formatNumber(s?.quality.inspectionCount ?? 0)}`,
    "",
    "You can ask me about any SCM area for more details.",
  ];
  return {
    text: lines.join("\n"),
    navActions: [
      nav("Open SCM Reports", "/scm/reports"),
      nav("Open SCM Overview", "/scm/overview"),
    ],
  };
}

function answerHelp(): ScmAiAnswer {
  return {
    text: `${SCM_AI_WELCOME_MESSAGE}\n\nTry one of the suggestions below, or ask about suppliers, procurement, inventory, warehouse, fulfillment, logistics, returns, quality or reports.`,
  };
}

function answerUnknown(): ScmAiAnswer {
  return {
    text: "I didn't quite catch that. I can help with suppliers, procurement, inventory, warehouse operations, fulfillment, logistics, returns, quality, or an overall SCM summary — try rephrasing, or pick a suggestion below.",
  };
}

export function answerIntent(
  intent: ScmAiIntentId,
  ctx: ScmAiContext,
): ScmAiAnswer {
  switch (intent) {
    case "suppliers":
      return answerSuppliers(ctx);
    case "supplier_performance":
      return answerSupplierPerformance(ctx);
    case "pending_purchase_orders":
      return answerPendingPOs(ctx);
    case "purchase_requisitions":
      return answerRequisitions(ctx);
    case "rfqs_quotations":
      return answerRfqsQuotations(ctx);
    case "low_stock_inventory":
      return answerLowStock(ctx);
    case "inventory_status":
      return answerInventory(ctx);
    case "warehouse_status":
      return answerWarehouse(ctx);
    case "fulfillment_status":
      return answerFulfillment(ctx);
    case "logistics_shipments":
      return answerLogistics(ctx);
    case "returns_status":
      return answerReturns(ctx);
    case "quality_status":
      return answerQuality(ctx);
    case "advanced_scm":
      return answerAdvancedScm();
    case "scm_summary":
      return answerSummary(ctx);
    case "help":
      return answerHelp();
    default:
      return answerUnknown();
  }
}
