import { describe, expect, it } from "vitest";
import {
  buildReply,
  detectIntent,
  SUGGESTED_PROMPTS,
  type AssistantIntent,
} from "./assistant.intents.js";

describe("detectIntent", () => {
  it.each<[string, AssistantIntent]>([
    ["Show SCM summary", "scm_summary"],
    ["Which suppliers do we have?", "suppliers"],
    ["Show pending purchase orders", "pending_purchase_orders"],
    ["Which products are low in stock?", "low_stock_inventory"],
    ["Show inventory status", "inventory_status"],
    ["Show warehouse status", "warehouse_status"],
    ["Show pending/backordered orders", "fulfillment_status"],
    ["Show shipment status", "logistics_shipments"],
    ["Show returns", "returns_status"],
    ["Show quality issues", "quality_status"],
    ["Show supplier performance", "supplier_performance"],
    ["Show overdue supplier bills", "supplier_bills"],
    ["Open Control Tower", "advanced_scm"],
    ["what can you do", "help"],
  ])("maps %j to %s", (question, expected) => {
    expect(detectIntent(question)).toBe(expected);
  });

  it("prefers the more specific domain when two are mentioned", () => {
    expect(detectIntent("show supplier purchase orders")).toBe(
      "pending_purchase_orders",
    );
    expect(detectIntent("how much do we owe suppliers")).toBe("supplier_bills");
  });

  it("falls back to unknown for unrelated text", () => {
    expect(detectIntent("what is the weather today")).toBe("unknown");
  });

  it("every suggested prompt resolves to a real intent", () => {
    for (const prompt of SUGGESTED_PROMPTS) {
      expect(detectIntent(prompt)).not.toBe("unknown");
    }
  });
});

describe("buildReply", () => {
  it("says so honestly when a source is empty", () => {
    expect(
      buildReply("suppliers", { suppliers: { total: 0, byStatus: {} } }).answer,
    ).toBe("No suppliers have been added yet.");
    expect(
      buildReply("returns_status", {
        returns: { total: 0, open: 0, customer: 0, vendor: 0 },
      }).answer,
    ).toMatch(/No returns/);
  });

  it("states the figures it was given, with deep links", () => {
    const reply = buildReply("pending_purchase_orders", {
      purchaseOrders: { open: 5, overdue: 2, total: 12 },
    });
    expect(reply.answer).toContain("5 pending purchase orders");
    expect(reply.answer).toContain("2 orders past the expected delivery date");
    expect(reply.navActions[0]?.path).toBe("/scm/procurement/purchase-orders");
  });

  it("reports overdue supplier bills", () => {
    const reply = buildReply("supplier_bills", {
      bills: {
        open: 3,
        outstanding: 250000,
        overdue: 1,
        overdueAmount: 100000,
        paidThisMonth: 50000,
      },
    });
    expect(reply.answer).toContain("Open supplier bills: 3");
    expect(reply.answer).toContain("Overdue: 1 bill(s)");
  });

  it("answers help and unknown without needing data", () => {
    expect(buildReply("help", {}).answer).toContain("Texa SCM Copilot");
    expect(buildReply("unknown", {}).intent).toBe("unknown");
  });
});
