import { describe, expect, it } from "vitest";
import { bucketMovements, istDayStart, trendDates } from "./movement-trend.js";

describe("SCM movement trend", () => {
  it("builds the window oldest first, ending today", () => {
    expect(trendDates("2026-03-02", 3)).toEqual([
      "2026-02-28",
      "2026-03-01",
      "2026-03-02",
    ]);
  });

  it("starts the window at IST midnight", () => {
    expect(istDayStart("2026-03-02").toISOString()).toBe(
      "2026-03-01T18:30:00.000Z",
    );
  });

  it("buckets by IST business day and keeps empty days as zero", () => {
    const dates = trendDates("2026-03-02", 3);
    const rows = [
      // 23:00 UTC on 1 Mar is 04:30 IST on 2 Mar.
      {
        transactionDate: new Date("2026-03-01T23:00:00Z"),
        quantityIn: "5.5",
        quantityOut: "0",
      },
      {
        transactionDate: new Date("2026-03-02T05:00:00Z"),
        quantityIn: 0,
        quantityOut: 2,
      },
      {
        transactionDate: new Date("2026-02-28T10:00:00Z"),
        quantityIn: 1,
        quantityOut: 0.1,
      },
      // Before the window: ignored.
      {
        transactionDate: new Date("2026-02-20T10:00:00Z"),
        quantityIn: 99,
        quantityOut: 99,
      },
    ];
    expect(bucketMovements(rows, dates)).toEqual([
      { date: "2026-02-28", inbound: 1, outbound: 0.1 },
      { date: "2026-03-01", inbound: 0, outbound: 0 },
      { date: "2026-03-02", inbound: 5.5, outbound: 2 },
    ]);
  });
});
