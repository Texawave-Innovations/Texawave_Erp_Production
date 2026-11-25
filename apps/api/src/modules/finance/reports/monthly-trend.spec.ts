import { describe, expect, it } from "vitest";
import { bucketMonthlyPnl, monthEnd, trendMonths } from "./monthly-trend.js";

const line = (
  date: string,
  accountType: string,
  debit: number | string,
  credit: number | string,
) => ({
  debit,
  credit,
  journalEntry: { entryDate: new Date(`${date}T00:00:00Z`) },
  account: { accountType },
});

describe("finance monthly trend", () => {
  it("computes month ends, including leap February", () => {
    expect(monthEnd("2028-02")).toBe("2028-02-29");
    expect(monthEnd("2026-12")).toBe("2026-12-31");
  });

  it("uses the P&L sign rules per month and ignores balance-sheet accounts", () => {
    const months = trendMonths("2026-03-20", 3);
    const result = bucketMonthlyPnl(
      [
        line("2026-01-05", "REVENUE", 0, "1000"),
        line("2026-01-20", "REVENUE", 100, 0), // revenue reversal
        line("2026-01-21", "EXPENSE", "250.10", 0),
        line("2026-03-01", "EXPENSE", 400, 50), // net 350
        line("2026-03-02", "ASSET", 5000, 0), // not P&L
        line("2025-12-31", "REVENUE", 0, 999), // outside window
      ],
      months,
    );
    expect(result).toEqual([
      { month: "2026-01", revenue: 900, expenses: 250.1, netIncome: 649.9 },
      { month: "2026-02", revenue: 0, expenses: 0, netIncome: 0 },
      { month: "2026-03", revenue: 0, expenses: 350, netIncome: -350 },
    ]);
  });
});
