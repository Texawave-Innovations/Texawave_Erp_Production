import { describe, expect, it } from "vitest";
import {
  agingBucket,
  avgDealSize,
  boardStages,
  buildLeadsTrend,
  buildRevenueTrend,
  buildTeamRows,
  classifyHealth,
  istDayKeyOf,
  lastMonthKeys,
  mergeLeadSources,
  monthLabel,
  stageDurationRows,
  stageWiseRows,
  weekStartKey,
  winRate,
} from "./dashboard.metrics.js";

const stage = (
  id: number,
  order: number,
  over: Partial<{
    isWon: boolean;
    isLost: boolean;
    isOnHold: boolean;
    isActive: boolean;
  }> = {},
) => ({
  id,
  label: `S${id}`,
  order,
  isWon: false,
  isLost: false,
  isOnHold: false,
  isActive: true,
  ...over,
});

describe("win rate / deal size", () => {
  it("rounds won / (won + lost) and is 0 with nothing closed", () => {
    expect(winRate(1, 2)).toBe(33);
    expect(winRate(2, 1)).toBe(67);
    expect(winRate(0, 0)).toBe(0);
    expect(winRate(0, 3)).toBe(0);
    expect(winRate(4, 0)).toBe(100);
  });
  it("average deal size", () => {
    expect(avgDealSize(1000, 3)).toBe(333);
    expect(avgDealSize(0, 0)).toBe(0);
  });
});

describe("deal health", () => {
  it("falls back to 7/14 days without an SLA", () => {
    expect(classifyHealth(6.9, null)).toBe("Healthy");
    expect(classifyHealth(7, null)).toBe("Delayed");
    expect(classifyHealth(14, undefined)).toBe("Critical");
  });
  it("uses sla / 2*sla when the stage has an SLA", () => {
    expect(classifyHealth(2.9, 3)).toBe("Healthy");
    expect(classifyHealth(3, 3)).toBe("Delayed");
    expect(classifyHealth(6, 3)).toBe("Critical");
  });
  it("a 0 SLA keeps legacy semantics (delayed at 0, critical at 14)", () => {
    expect(classifyHealth(0, 0)).toBe("Delayed");
    expect(classifyHealth(13, 0)).toBe("Delayed");
    expect(classifyHealth(14, 0)).toBe("Critical");
  });
  it("deal aging buckets", () => {
    expect(agingBucket(7)).toBe("0-7 days");
    expect(agingBucket(7.1)).toBe("8-14 days");
    expect(agingBucket(14)).toBe("8-14 days");
    expect(agingBucket(30)).toBe("15-30 days");
    expect(agingBucket(31)).toBe("30+ days");
  });
});

describe("revenue trend", () => {
  it("builds the last N IST months, oldest first, across a year boundary", () => {
    expect(lastMonthKeys(new Date("2026-02-10T00:00:00Z"), 6)).toEqual([
      "2025-09",
      "2025-10",
      "2025-11",
      "2025-12",
      "2026-01",
      "2026-02",
    ]);
  });
  it("buckets by IST day (UTC late evening is already next day)", () => {
    expect(istDayKeyOf(new Date("2026-03-31T19:00:00Z"))).toBe("2026-04-01");
    expect(lastMonthKeys(new Date("2026-03-31T19:00:00Z"), 1)).toEqual([
      "2026-04",
    ]);
  });
  it("labels months like legacy 'MMM yy'", () => {
    expect(monthLabel("2026-10")).toBe("Oct 26");
  });
  it("sums created / won / target per month and computes attainment", () => {
    const t = buildRevenueTrend(
      ["2026-08", "2026-09", "2026-10"],
      new Map([
        ["2026-08", 100],
        ["2026-10", 300],
      ]),
      new Map([
        ["2026-09", 50],
        ["2026-10", 150],
      ]),
      new Map([
        ["2026-09", 100],
        ["2026-10", 100],
      ]),
    );
    expect(t.months.map((m) => m.pipelineCreated)).toEqual([100, 0, 300]);
    expect(t.months.map((m) => m.wonRevenue)).toEqual([0, 50, 150]);
    expect(t.months.map((m) => m.target)).toEqual([0, 100, 100]);
    expect(t.totals).toEqual({
      pipelineCreated: 400,
      wonRevenue: 200,
      target: 200,
      attainmentPct: 100,
    });
  });
  it("attainment is 0 when there is no target", () => {
    const t = buildRevenueTrend(
      ["2026-10"],
      new Map(),
      new Map([["2026-10", 5]]),
      new Map(),
    );
    expect(t.totals.attainmentPct).toBe(0);
  });
});

describe("stage-wise value / count / duration", () => {
  const stages = [
    stage(3, 3),
    stage(1, 1),
    stage(2, 2),
    stage(9, 9, { isWon: true }),
    stage(8, 8, { isLost: true }),
    stage(7, 7, { isOnHold: true }),
    stage(6, 6, { isActive: false }),
  ];
  it("board stages are active non-terminal stages in order", () => {
    expect(boardStages(stages).map((s) => s.id)).toEqual([1, 2, 3]);
  });
  it("zero-fills stages without open deals", () => {
    const rows = stageWiseRows(
      stages,
      new Map([
        [1, { count: 2, value: 500 }],
        [3, { count: 1, value: 40 }],
      ]),
    );
    expect(rows).toEqual([
      { stageId: 1, label: "S1", count: 2, value: 500 },
      { stageId: 2, label: "S2", count: 0, value: 0 },
      { stageId: 3, label: "S3", count: 1, value: 40 },
    ]);
  });
  it("average time in stage: days to 1 decimal, zero stages dropped", () => {
    const rows = stageDurationRows(
      stages,
      new Map([
        [1, 86400000 * 2.26],
        [3, 0],
      ]),
    );
    expect(rows).toEqual([{ stageId: 1, label: "S1", avgDays: 2.3 }]);
  });
});

describe("team performance", () => {
  const groups = [
    { ownerName: "Asha", status: "WON", count: 2, value: 600 },
    { ownerName: "Asha", status: "OPEN", count: 1, value: 10 },
    { ownerName: "Asha", status: "LOST", count: 2, value: 0 },
    { ownerName: "Ravi", status: "WON", count: 1, value: 900 },
    { ownerName: "Zed", status: "OPEN", count: 4, value: 0 },
  ];
  it("groups per rep, win rate, sorted by won value, quota match is case/space insensitive", () => {
    const rows = buildTeamRows(groups, [
      { repName: "  asha ", targetAmount: 1000 },
      { repName: "ASHA", targetAmount: 5 },
    ]);
    expect(rows.map((r) => r.repName)).toEqual(["Ravi", "Asha", "Zed"]);
    const asha = rows[1]!;
    expect(asha).toMatchObject({
      won: 2,
      wonValue: 600,
      open: 1,
      lost: 2,
      winRate: 50,
      target: 1000, // first quota wins, like legacy `.find`
      attainmentPct: 60,
    });
    expect(rows[0]).toMatchObject({ target: null, attainmentPct: null });
    expect(rows[2]).toMatchObject({ winRate: 0, open: 4 });
  });
  it("no attainment for a zero target", () => {
    const [r] = buildTeamRows(groups.slice(3, 4), [
      { repName: "Ravi", targetAmount: 0 },
    ]);
    expect(r!.attainmentPct).toBeNull();
  });
});

describe("lead sources and trend", () => {
  it("trims, drops blank, merges and sorts by total", () => {
    expect(
      mergeLeadSources([
        { source: " Web ", total: 2, converted: 1 },
        { source: "Web", total: 1, converted: 0 },
        { source: "Referral", total: 5, converted: 2 },
        { source: "  ", total: 9, converted: 9 },
        { source: null, total: 9, converted: 9 },
      ]),
    ).toEqual([
      { source: "Referral", total: 5, converted: 2 },
      { source: "Web", total: 3, converted: 1 },
    ]);
  });
  it("week start is Monday", () => {
    expect(weekStartKey("2026-10-16")).toBe("2026-10-12"); // Friday
    expect(weekStartKey("2026-10-18")).toBe("2026-10-12"); // Sunday
    expect(weekStartKey("2026-10-12")).toBe("2026-10-12");
  });
  it("needs at least two distinct days", () => {
    expect(buildLeadsTrend("2026-10-01", "2026-10-01", 1, new Map())).toEqual({
      granularity: null,
      points: [],
    });
  });
  it("daily, zero-filled, for spans up to 31 days", () => {
    const t = buildLeadsTrend(
      "2026-10-01",
      "2026-10-03",
      2,
      new Map([
        ["2026-10-01", { total: 2, converted: 1 }],
        ["2026-10-03", { total: 1, converted: 0 }],
      ]),
    );
    expect(t.granularity).toBe("Daily");
    expect(t.points).toEqual([
      { label: "01 Oct", total: 2, converted: 1 },
      { label: "02 Oct", total: 0, converted: 0 },
      { label: "03 Oct", total: 1, converted: 0 },
    ]);
  });
  it("weekly up to 180 days, monthly beyond", () => {
    expect(
      buildLeadsTrend("2026-08-01", "2026-10-01", 5, new Map()).granularity,
    ).toBe("Weekly");
    const m = buildLeadsTrend("2026-01-15", "2026-10-01", 5, new Map());
    expect(m.granularity).toBe("Monthly");
    expect(m.points.map((p) => p.label)).toEqual([
      "Jan 26",
      "Feb 26",
      "Mar 26",
      "Apr 26",
      "May 26",
      "Jun 26",
      "Jul 26",
      "Aug 26",
      "Sep 26",
      "Oct 26",
    ]);
  });
});
