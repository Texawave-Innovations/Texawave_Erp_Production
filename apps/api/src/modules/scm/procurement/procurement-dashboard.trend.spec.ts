import { describe, expect, it } from "vitest";
import {
  bucketMonthlySpend,
  mergeApprovalQueue,
  trendMonths,
  type ApprovalItem,
} from "./procurement-dashboard.trend.js";

describe("procurement dashboard trend", () => {
  it("lists months oldest first across a year boundary", () => {
    expect(trendMonths("2026-02-15", 4)).toEqual([
      "2025-11",
      "2025-12",
      "2026-01",
      "2026-02",
    ]);
  });

  it("sums committed PO totals per PO-date month, zero-filling gaps", () => {
    const months = trendMonths("2026-03-10", 3);
    const rows = [
      { poDate: new Date("2026-01-31T00:00:00Z"), total: "1000.50" },
      { poDate: new Date("2026-03-01T00:00:00Z"), total: 200 },
      { poDate: new Date("2026-03-09T00:00:00Z"), total: "300.25" },
      { poDate: new Date("2025-12-31T00:00:00Z"), total: 999 }, // outside
    ];
    expect(bucketMonthlySpend(rows, months)).toEqual([
      { month: "2026-01", total: 1000.5, orders: 1 },
      { month: "2026-02", total: 0, orders: 0 },
      { month: "2026-03", total: 500.25, orders: 2 },
    ]);
  });

  it("orders the approval queue by longest waiting and caps it", () => {
    const item = (
      type: ApprovalItem["type"],
      id: number,
      date: string,
    ): ApprovalItem => ({
      type,
      id,
      number: `N${id}`,
      party: "P",
      date,
      total: 1,
    });
    const queue = mergeApprovalQueue(
      [
        item("PURCHASE_ORDER", 1, "2026-03-05"),
        item("REQUISITION", 2, "2026-03-01"),
        item("REQUISITION", 3, "2026-03-05"),
        item("PURCHASE_ORDER", 4, "2026-02-27"),
      ],
      3,
    );
    expect(queue.map((q) => q.id)).toEqual([4, 2, 1]);
  });
});
