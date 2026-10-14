import {
  canTransition,
  countLeaveDays,
  covers,
  type DayPortion,
  eachDate,
  type BalanceFacts,
  type BalancePolicy,
  requestsConflict,
  spansYears,
  yearBalance,
} from "./leave-domain.js";

const noFacts: BalanceFacts = { usedByYear: new Map(), pendingInYear: 0 };
const policy = (over: Partial<BalancePolicy> = {}): BalancePolicy => ({
  annualEntitlement: 12,
  carryForwardLimit: 5,
  typeFirstYear: 2025,
  joiningDate: "2025-01-01",
  exitDate: null,
  overrides: new Map(),
  ...over,
});

describe("leave lifecycle", () => {
  it.each([
    ["PENDING", "APPROVED", true],
    ["PENDING", "REJECTED", true],
    ["PENDING", "CANCELLED", true],
    ["APPROVED", "CANCELLED", true],
    ["REJECTED", "PENDING", true],
    ["CANCELLED", "PENDING", true],
    ["APPROVED", "REJECTED", false],
    ["APPROVED", "PENDING", false],
    ["REJECTED", "APPROVED", false],
    ["REJECTED", "CANCELLED", false],
    ["CANCELLED", "APPROVED", false],
    ["CANCELLED", "CANCELLED", false],
  ] as const)("%s -> %s allowed=%s", (from, to, allowed) => {
    expect(canTransition(from, to)).toBe(allowed);
  });
});

describe("overlap", () => {
  const span = (start: string, end: string, portion: DayPortion = "FULL") => ({
    start,
    end,
    portion,
  });

  it("two full days sharing a date conflict", () => {
    expect(
      requestsConflict(
        span("2027-01-04", "2027-01-06"),
        span("2027-01-06", "2027-01-08"),
      ),
    ).toBe(true);
  });

  it("adjacent full days do not conflict", () => {
    expect(
      requestsConflict(
        span("2027-01-04", "2027-01-05"),
        span("2027-01-06", "2027-01-07"),
      ),
    ).toBe(false);
  });

  it("a half-day conflicts with a full day that covers it", () => {
    expect(
      requestsConflict(
        span("2027-01-04", "2027-01-04", "FIRST_HALF"),
        span("2027-01-03", "2027-01-05"),
      ),
    ).toBe(true);
  });

  it("first and second half of the same date do not conflict", () => {
    expect(
      requestsConflict(
        span("2027-01-04", "2027-01-04", "FIRST_HALF"),
        span("2027-01-04", "2027-01-04", "SECOND_HALF"),
      ),
    ).toBe(false);
  });

  it("two halves of the same portion on the same date conflict", () => {
    expect(
      requestsConflict(
        span("2027-01-04", "2027-01-04", "FIRST_HALF"),
        span("2027-01-04", "2027-01-04", "FIRST_HALF"),
      ),
    ).toBe(true);
  });
});

describe("dates and working days", () => {
  it("eachDate is inclusive and empty when reversed", () => {
    expect(eachDate("2027-02-27", "2027-03-01")).toEqual([
      "2027-02-27",
      "2027-02-28",
      "2027-03-01",
    ]);
    expect(eachDate("2027-03-02", "2027-03-01")).toEqual([]);
  });

  it("a request crossing New Year spans two years", () => {
    expect(spansYears("2026-12-31", "2027-01-01")).toBe(true);
    expect(spansYears("2027-01-02", "2027-01-05")).toBe(false);
  });

  it("counts only working dates in a full-day range", () => {
    // Sat 2027-01-09 and Sun 2027-01-10 are weekly offs; 2027-01-07 is a holiday.
    const off = new Set(["2027-01-07", "2027-01-09", "2027-01-10"]);
    const days = countLeaveDays(
      { start: "2027-01-06", end: "2027-01-11", portion: "FULL" },
      (d) => !off.has(d),
    );
    expect(days).toBe(3); // Wed 6, Thu 7 is off, Fri 8, Sat/Sun off, Mon 11
  });

  it("a half-day on a working date counts 0.5", () => {
    expect(
      countLeaveDays(
        { start: "2027-01-06", end: "2027-01-06", portion: "SECOND_HALF" },
        () => true,
      ),
    ).toBe(0.5);
  });

  it("a half-day on a non-working date counts 0 (the request is then refused)", () => {
    expect(
      countLeaveDays(
        { start: "2027-01-10", end: "2027-01-10", portion: "FIRST_HALF" },
        () => false,
      ),
    ).toBe(0);
  });

  it("a half-day must name a single date", () => {
    expect(() =>
      countLeaveDays(
        { start: "2027-01-06", end: "2027-01-07", portion: "FIRST_HALF" },
        () => true,
      ),
    ).toThrow("single date");
  });
});

describe("balance", () => {
  it("accrues one twelfth per credited month, up to the requested month", () => {
    const b = yearBalance(policy({ typeFirstYear: 2026 }), noFacts, 2026, 3);
    expect(b).toMatchObject({
      opening: 0,
      entitlement: 12,
      accrued: 3,
      available: 3,
    });
  });

  it("a mid-month joiner is credited from their joining month", () => {
    const b = yearBalance(
      policy({ joiningDate: "2026-03-15" }),
      noFacts,
      2026,
      12,
    );
    // March..December = 10 credited months.
    expect(b.accrued).toBe(10);
  });

  it("an employee who exits mid-year stops accruing after their exit month", () => {
    const b = yearBalance(
      policy({ exitDate: "2026-06-10" }),
      noFacts,
      2026,
      12,
    );
    // January..June = 6 credited months.
    expect(b.accrued).toBe(6);
  });

  it("carries unused days forward up to the cap and forfeits the rest", () => {
    // 2025: 12 accrued, 2 used -> closing 10, capped at 5 into 2026.
    const facts: BalanceFacts = {
      usedByYear: new Map([[2025, 2]]),
      pendingInYear: 0,
    };
    const b = yearBalance(policy(), facts, 2026, 3);
    expect(b).toMatchObject({ opening: 5, accrued: 3, available: 8 });
  });

  it("carries nothing forward from a negative closing balance", () => {
    const facts: BalanceFacts = {
      usedByYear: new Map([[2025, 15]]),
      pendingInYear: 0,
    };
    expect(yearBalance(policy(), facts, 2026, 1).opening).toBe(0);
  });

  it("an employee override replaces the default entitlement for its year only", () => {
    const p = policy({ overrides: new Map([[2026, 24]]) });
    expect(yearBalance(p, noFacts, 2026, 12).entitlement).toBe(24);
    expect(yearBalance(p, noFacts, 2026, 12).accrued).toBe(24);
    expect(yearBalance(p, noFacts, 2025, 12).entitlement).toBe(12);
  });

  it("pending requests are held against the available balance", () => {
    const facts: BalanceFacts = { usedByYear: new Map(), pendingInYear: 4 };
    const b = yearBalance(policy(), facts, 2026, 6);
    // 5 carried in (full 2025, capped) + 6 accrued - 4 pending.
    expect(b.available).toBe(7);
    expect(covers(b, 7)).toBe(true);
    expect(covers(b, 7.5)).toBe(false);
  });

  it("no balance exists before the leave type came into force", () => {
    expect(
      yearBalance(policy({ typeFirstYear: 2026 }), noFacts, 2025, 12).available,
    ).toBe(0);
  });
});
