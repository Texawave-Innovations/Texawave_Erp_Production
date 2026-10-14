import { describe, expect, it } from "vitest";
import {
  ageOn,
  attendanceAbsence,
  earningRatio,
  esiContributionPeriodStart,
  financialYearOf,
  monthsLeftInFinancialYear,
  overtimePay,
  payDaysDivisor,
  pfBreakup,
  professionalTax,
  workingDaysBetween,
} from "./payroll-engine.rules.js";

const d = (s: string) => new Date(`${s}T00:00:00.000Z`);
const PF_RULES = {
  pfWageCeiling: 15000,
  pfCapAtCeiling: true,
  pfEmployeeRate: 12,
  pfEmployerRate: 12,
  epsRate: 8.33,
  epsWageCeiling: 15000,
  edliRate: 0.5,
  edliWageCeiling: 15000,
  pfAdminRate: 0.5,
};

describe("payroll engine rules", () => {
  it("counts working days without weekly offs or holidays", () => {
    // April 2026: 30 days, Sat/Sun off = 8, one holiday on a Wednesday.
    expect(
      workingDaysBetween(
        d("2026-04-01"),
        d("2026-04-30"),
        new Set([6, 7]),
        new Set(["2026-04-15"]),
      ),
    ).toBe(21);
  });

  it.each([
    ["CALENDAR", 30],
    ["FIXED_30", 30],
    ["FIXED_26", 26],
    ["WORKING_DAYS", 22],
  ] as const)("pay-days divisor %s → %d", (mode, expected) => {
    expect(payDaysDivisor(mode, 30, 22)).toBe(expected);
  });

  it("never divides by zero working days", () => {
    expect(payDaysDivisor("WORKING_DAYS", 30, 0)).toBe(1);
  });

  it("deducts each LOP day once at gross ÷ divisor, and prorates joining", () => {
    expect(
      earningRatio({
        calendarDays: 30,
        employedDays: 30,
        absenceLopDays: 3,
        divisor: 30,
      }),
    ).toBe(0.9);
    expect(
      earningRatio({
        calendarDays: 30,
        employedDays: 30,
        absenceLopDays: 2,
        divisor: 26,
      }),
    ).toBe(0.9231);
    expect(
      earningRatio({
        calendarDays: 30,
        employedDays: 15,
        absenceLopDays: 0,
        divisor: 26,
      }),
    ).toBe(0.5);
    expect(
      earningRatio({
        calendarDays: 30,
        employedDays: 5,
        absenceLopDays: 30,
        divisor: 30,
      }),
    ).toBe(0);
  });

  it("does not count a half-day leave as absence", () => {
    const counts = {
      PRESENT: 20,
      ABSENT: 1,
      HALF_DAY: 3,
      HOLIDAY: 0,
      WEEKLY_OFF: 8,
      ON_LEAVE: 0,
      NOT_MARKED: 2,
    };
    expect(attendanceAbsence(counts, 1, true).absentDays).toBe(4); // 1 + 2 + 2×0.5
    expect(attendanceAbsence(counts, 1, false).absentDays).toBe(2);
  });

  it("pays overtime at the fixed rate or hourly wage × multiplier", () => {
    expect(
      overtimePay({
        minutes: 90,
        grossMonthly: 26000,
        divisor: 26,
        standardHoursPerDay: 8,
        multiplier: 2,
        fixedRatePerHour: 70,
      }).amount,
    ).toBe(105);
    // hourly 26000/26/8 = 125 × 2 = 250 per hour
    expect(
      overtimePay({
        minutes: 120,
        grossMonthly: 26000,
        divisor: 26,
        standardHoursPerDay: 8,
        multiplier: 2,
        fixedRatePerHour: null,
      }).amount,
    ).toBe(500);
  });

  it("splits the employer PF share into EPS and EPF", () => {
    const pf = pfBreakup(20000, PF_RULES, true);
    expect(pf).toMatchObject({
      pfWage: 15000,
      employeeContribution: 1800,
      employerContribution: 1800,
      epsWage: 15000,
      epsContribution: 1249.5,
      epfEmployerContribution: 550.5,
      edliContribution: 75,
      adminCharges: 75,
    });
    expect(
      pfBreakup(20000, { ...PF_RULES, pfCapAtCeiling: false }, true).pfWage,
    ).toBe(20000);
    expect(pfBreakup(10000, PF_RULES, false).epsContribution).toBe(0);
  });

  it("works out age on a date", () => {
    expect(ageOn(d("1968-05-10"), d("2026-05-09"))).toBe(57);
    expect(ageOn(d("1968-05-10"), d("2026-05-10"))).toBe(58);
  });

  it.each([
    ["2026-04-15", "2026-04-01"],
    ["2026-09-30", "2026-04-01"],
    ["2026-10-01", "2026-10-01"],
    ["2027-03-31", "2026-10-01"],
  ])("ESI contribution period of %s starts %s", (date, start) => {
    expect(esiContributionPeriodStart(d(date)).toISOString().slice(0, 10)).toBe(
      start,
    );
  });

  it("applies the matching PT slab, special month and applicable months", () => {
    const slabs = [
      {
        minMonthlyWage: 0,
        maxMonthlyWage: 9999,
        monthlyAmount: 0,
        specialMonth: null,
        specialAmount: null,
        applicableMonths: [],
      },
      {
        minMonthlyWage: 10000,
        maxMonthlyWage: null,
        monthlyAmount: 200,
        specialMonth: 2,
        specialAmount: 300,
        applicableMonths: [],
      },
    ];
    expect(professionalTax(slabs, 5, 25000)).toBe(200);
    expect(professionalTax(slabs, 2, 25000)).toBe(300);
    expect(professionalTax(slabs, 5, 5000)).toBe(0);
    expect(
      professionalTax([{ ...slabs[1]!, applicableMonths: [9, 3] }], 5, 25000),
    ).toBe(0);
  });

  it("knows the financial year and the months left in it", () => {
    expect(financialYearOf(2026, 4)).toBe("2026-27");
    expect(financialYearOf(2027, 3)).toBe("2026-27");
    expect(financialYearOf(2099, 12)).toBe("2099-00");
    expect(monthsLeftInFinancialYear(4)).toBe(11);
    expect(monthsLeftInFinancialYear(3)).toBe(0);
    expect(monthsLeftInFinancialYear(1)).toBe(2);
  });
});
