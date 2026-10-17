import {
  computeQuotaAttainment,
  computeQuotaLiveSummary,
  currentMonthKey,
  currentQuarterKey,
  daysRemainingInPeriod,
  getPeriodBounds,
  type OpportunityForAttainment,
  type QuotaForAttainment,
} from "./quota-attainment.js";

const won = (
  owner: string | null,
  wonAt: Date | null,
  closing: number | null,
  est: number | null = 0,
  status = "WON",
): OpportunityForAttainment => ({
  status,
  ownerName: owner,
  wonAt,
  closingAmount: closing,
  estimatedValue: est,
});

const monthly = (
  over: Partial<QuotaForAttainment> = {},
): QuotaForAttainment => ({
  repName: "Asha Rao",
  period: "monthly",
  periodKey: "2026-03",
  targetAmount: 1000,
  metric: "closedWonValue",
  ...over,
});

describe("quota period helpers", () => {
  it("builds month and quarter keys", () => {
    expect(currentMonthKey(new Date(2026, 2, 15))).toBe("2026-03");
    expect(currentQuarterKey(new Date(2026, 3, 1))).toBe("2026-Q2");
  });

  it("derives bounds and rejects invalid keys", () => {
    const m = getPeriodBounds("monthly", "2026-02");
    expect(m?.start.getDate()).toBe(1);
    expect(m?.end.getDate()).toBe(28);
    const q = getPeriodBounds("quarterly", "2026-Q4");
    expect(q?.start.getMonth()).toBe(9);
    expect(q?.end.getMonth()).toBe(11);
    expect(getPeriodBounds("monthly", "nope")).toBeNull();
    expect(getPeriodBounds("monthly", "2026-13")).toBeNull();
    expect(getPeriodBounds("quarterly", "2026-Q5")).toBeNull();
  });

  it("counts days remaining, floored at 0", () => {
    expect(
      daysRemainingInPeriod("monthly", "2026-03", new Date(2026, 2, 30)),
    ).toBe(2);
    expect(
      daysRemainingInPeriod("monthly", "2026-03", new Date(2026, 4, 1)),
    ).toBe(0);
    expect(daysRemainingInPeriod("monthly", "bad")).toBe(0);
  });
});

describe("computeQuotaAttainment", () => {
  const d = new Date(2026, 2, 10);
  it("sums WON deals for the rep (trim/case-insensitive) in period", () => {
    const opps = [
      won("  asha RAO ", d, 300),
      won("Asha Rao", d, null, 200),
      won("Asha Rao", new Date(2026, 3, 2), 999),
      won("Other", d, 500),
      won("Asha Rao", d, 700, 0, "OPEN"),
      won("Asha Rao", null, 700),
      won(null, d, 700),
    ];
    expect(computeQuotaAttainment(monthly(), opps)).toBe(500);
  });

  it("counts deals for dealsWon and honours quarters", () => {
    const opps = [
      won("Asha Rao", d, 10),
      won("Asha Rao", new Date(2026, 0, 5), 10),
    ];
    expect(computeQuotaAttainment(monthly({ metric: "dealsWon" }), opps)).toBe(
      1,
    );
    expect(
      computeQuotaAttainment(
        monthly({
          period: "quarterly",
          periodKey: "2026-Q1",
          metric: "dealsWon",
        }),
        opps,
      ),
    ).toBe(2);
  });
});

describe("computeQuotaLiveSummary", () => {
  const opps = (amount: number) => [
    won("Asha Rao", new Date(2026, 2, 5), amount),
  ];

  it("is Achieved when target met", () => {
    const s = computeQuotaLiveSummary(
      monthly(),
      opps(1000),
      new Date(2026, 2, 10),
    );
    expect(s.status).toBe("Achieved");
    expect(s.remaining).toBe(0);
    expect(s.attainmentPct).toBe(100);
  });

  it("computes pace, forecast and On Track mid-period", () => {
    const now = new Date(2026, 2, 16, 12);
    const s = computeQuotaLiveSummary(monthly(), opps(600), now);
    expect(s.totalDays).toBe(32); // legacy quirk: end-of-day bound + 1
    expect(s.daysRemaining).toBe(16);
    expect(s.daysElapsed).toBe(16);
    expect(s.forecast).toBeCloseTo((600 / 16) * 32);
    expect(s.requiredDailyRunRate).toBeCloseTo(400 / 16);
    expect(s.status).toBe("On Track");
  });

  it("flags At Risk and Behind", () => {
    const now = new Date(2026, 2, 16, 12);
    expect(computeQuotaLiveSummary(monthly(), opps(400), now).status).toBe(
      "At Risk",
    );
    expect(computeQuotaLiveSummary(monthly(), opps(100), now).status).toBe(
      "Behind",
    );
  });

  it("is Behind once over and unmet; On Track for zero target", () => {
    const after = new Date(2026, 4, 1);
    expect(computeQuotaLiveSummary(monthly(), opps(10), after).status).toBe(
      "Behind",
    );
    expect(
      computeQuotaLiveSummary(monthly({ targetAmount: 0 }), [], after).status,
    ).toBe("On Track");
  });

  it("returns zeros for an invalid period key", () => {
    const s = computeQuotaLiveSummary(
      monthly({ periodKey: "x" }),
      [],
      new Date(),
    );
    expect(s.totalDays).toBe(0);
    expect(s.forecast).toBe(0);
  });
});
