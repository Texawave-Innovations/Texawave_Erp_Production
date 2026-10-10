import { describe, expect, it, vi } from "vitest";
import { Prisma } from "@texawave-erp/database";
import { PayrollCalculatorService } from "./payroll-calculator.service.js";

describe("PayrollCalculatorService", () => {
  const period = {
    id: 1,
    organizationId: 1,
    year: 2026,
    month: 4, // April 2026 has 30 days
    periodStart: new Date("2026-04-01T00:00:00.000Z"),
    periodEnd: new Date("2026-04-30T00:00:00.000Z"),
  };

  const employee = {
    id: 10,
    teamId: 2,
    workLocationId: 3,
    dateOfJoining: new Date("2025-01-01T00:00:00.000Z"),
    dateOfExit: null,
  };

  const salary = {
    id: 1,
    employeeId: 10,
    grossMonthly: new Prisma.Decimal(50000),
    basic: new Prisma.Decimal(25000),
    hra: new Prisma.Decimal(15000),
    conveyance: new Prisma.Decimal(2000),
    otherAllowance: new Prisma.Decimal(3000),
    specialAllowance: new Prisma.Decimal(5000),
    arrearsSalary: new Prisma.Decimal(0),
    arrearsPaidPeriodId: null as number | null,
    effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
    effectiveTo: null,
  };

  function createService(overrides?: {
    holidays?: unknown[];
    weeklyOffRules?: unknown[];
    leaves?: unknown[];
    pfProfile?: unknown;
    esiProfile?: unknown;
    loans?: unknown[];
    skipRequests?: unknown[];
    bonuses?: unknown[];
    bonusEarningsElsewhere?: unknown[];
    employeeSalary?: unknown;
  }) {
    const prisma = {
      payrollPeriod: {
        findFirstOrThrow: vi.fn().mockResolvedValue(period),
      },
      employee: {
        findFirst: vi.fn().mockImplementation(() =>
          Promise.resolve({
            ...employee,
            pfProfile:
              overrides?.pfProfile !== undefined
                ? overrides.pfProfile
                : {
                    pfApplicable: true,
                    uan: "100000000001",
                    pfNumber: "PF123",
                  },
            esiProfile:
              overrides?.esiProfile !== undefined
                ? overrides.esiProfile
                : { esiApplicable: true, insuranceNumber: "ESI123" },
          }),
        ),
        findFirstOrThrow: vi.fn().mockResolvedValue(employee),
      },
      holiday: {
        findMany: vi.fn().mockResolvedValue(overrides?.holidays ?? []),
      },
      weeklyOffRule: {
        findMany: vi.fn().mockResolvedValue(
          overrides?.weeklyOffRules ?? [
            {
              daysOfWeek: [6, 7],
              effectiveFrom: new Date("2025-01-01"),
              effectiveTo: null,
            },
          ],
        ),
      },
      leaveRequest: {
        findMany: vi.fn().mockResolvedValue(overrides?.leaves ?? []),
      },
      employeeSalary: {
        findFirst: vi
          .fn()
          .mockResolvedValue(
            overrides?.employeeSalary !== undefined
              ? overrides.employeeSalary
              : salary,
          ),
      },
      employeePfProfile: {
        findFirst: vi
          .fn()
          .mockResolvedValue(
            overrides?.pfProfile !== undefined
              ? overrides.pfProfile
              : { pfApplicable: true, uan: "100000000001", pfNumber: "PF123" },
          ),
      },
      employeeEsiProfile: {
        findFirst: vi
          .fn()
          .mockResolvedValue(
            overrides?.esiProfile !== undefined
              ? overrides.esiProfile
              : { esiApplicable: true, insuranceNumber: "ESI123" },
          ),
      },
      employeeLoan: {
        findMany: vi.fn().mockResolvedValue(overrides?.loans ?? []),
      },
      loanSkipRequest: {
        findMany: vi.fn().mockResolvedValue(overrides?.skipRequests ?? []),
      },
      employeeBonus: {
        findMany: vi.fn().mockResolvedValue(overrides?.bonuses ?? []),
      },
      payrollEarning: {
        findMany: vi
          .fn()
          .mockResolvedValue(overrides?.bonusEarningsElsewhere ?? []),
      },
    };

    lastPrisma = prisma;
    return new PayrollCalculatorService(prisma as never);
  }
  let lastPrisma: {
    employeeLoan: { findMany: ReturnType<typeof vi.fn> };
    payrollEarning: { findMany: ReturnType<typeof vi.fn> };
  };

  it("calculates standard full month payroll with PF deduction", async () => {
    const service = createService();
    const result = (await service.calculateForEmployee(1, period.id, 10))!;

    expect(result.totalCalendarDays).toBe(30);
    expect(result.payableDays).toBe(30);
    expect(result.earningRatio).toBe(1);
    expect(result.monthlyGross).toBe(50000);
    expect(result.baseEarnings).toBe(40000); // Basic (25000) + HRA (15000)
    expect(result.totalGrossEarnings).toBe(50000);

    // PF ceiling is 15000, 12% is 1800
    expect(result.pf).toBeDefined();
    expect(result.pf?.pfWage).toBe(15000);
    expect(result.pf?.employeeContribution).toBe(1800);
    expect(result.pf?.employerContribution).toBe(1800);

    // ESI should not be included because gross > 21000
    expect(result.esi).toBeUndefined();

    // Deductions should contain PF
    expect(result.totalDeductions).toBe(1800);
    expect(result.netPayable).toBe(50000 - 1800);
  });

  it("calculates prorated payroll with LOP leave days", async () => {
    const service = createService({
      leaves: [
        {
          startDate: new Date("2026-04-10T00:00:00.000Z"),
          endDate: new Date("2026-04-15T00:00:00.000Z"), // 6 days
          leaveType: { code: "LOP" },
        },
      ],
    });

    const result = (await service.calculateForEmployee(1, period.id, 10))!;

    expect(result.totalCalendarDays).toBe(30);
    expect(result.lopDays).toBe(6);
    expect(result.payableDays).toBe(24);
    expect(result.earningRatio).toBe(0.8);
    expect(result.baseEarnings).toBe(32000); // 40000 * 0.8
    expect(result.totalGrossEarnings).toBe(40000); // 50000 * 0.8
  });

  it("calculates ESI when gross is within statutory threshold (<= 21000)", async () => {
    const lowSalary = {
      ...salary,
      grossMonthly: new Prisma.Decimal(20000),
      basic: new Prisma.Decimal(10000),
      hra: new Prisma.Decimal(5000),
      conveyance: new Prisma.Decimal(2000),
      otherAllowance: new Prisma.Decimal(3000),
      specialAllowance: new Prisma.Decimal(0),
    };

    const service = createService({
      employeeSalary: lowSalary,
      pfProfile: null,
      esiProfile: { esiApplicable: true, insuranceNumber: "ESI123" },
    });

    const result = (await service.calculateForEmployee(1, period.id, 10))!;

    expect(result.esi).toBeDefined();
    expect(result.esi?.esiWage).toBe(20000);
    // Employee contribution: 0.75% of 20000 = 150
    expect(result.esi?.employeeContribution).toBe(150);
    // Employer contribution: 3.25% of 20000 = 650
    expect(result.esi?.employerContribution).toBe(650);

    expect(result.totalDeductions).toBe(150);
    expect(result.netPayable).toBe(20000 - 150);
  });

  it("deducts active loan EMI and includes approved bonus", async () => {
    const service = createService({
      pfProfile: null,
      esiProfile: null,
      loans: [
        {
          id: 5,
          loanNumber: "LN-2026-001",
          emiAmount: new Prisma.Decimal(3000),
          status: "ACTIVE",
          skipRequests: [],
          repayments: [{ id: 51, amount: new Prisma.Decimal(3000) }],
        },
      ],
      bonuses: [
        {
          id: 7,
          bonusType: "PERFORMANCE",
          amount: new Prisma.Decimal(5000),
          status: "APPROVED",
        },
      ],
    });

    const result = (await service.calculateForEmployee(1, period.id, 10))!;

    expect(result.totalGrossEarnings).toBe(55000); // 50000 base + 5000 bonus
    expect(result.totalDeductions).toBe(3000); // 3000 loan EMI
    expect(result.netPayable).toBe(52000);
    expect(result.loanRepayments).toHaveLength(1);
    expect(result.loanRepayments[0]).toEqual({
      loanId: 5,
      repaymentId: 51,
      amount: 3000,
    });
    expect(result.bonusIds).toEqual([7]);
    expect(result.earnings.find((e) => e.code === "BONUS")).toMatchObject({
      sourceType: "BONUS",
      sourceId: 7,
    });
  });

  it("skips a bonus another open period's live run already pays", async () => {
    const service = createService({
      pfProfile: null,
      esiProfile: null,
      bonuses: [
        { id: 7, bonusType: "PERFORMANCE", amount: new Prisma.Decimal(5000) },
        { id: 8, bonusType: "FESTIVAL", amount: new Prisma.Decimal(2000) },
      ],
      bonusEarningsElsewhere: [{ sourceId: 7 }],
    });

    const result = (await service.calculateForEmployee(1, period.id, 10))!;

    expect(result.bonusIds).toEqual([8]);
    expect(result.totalGrossEarnings).toBe(52000);
    expect(lastPrisma.payrollEarning.findMany).toHaveBeenCalledWith({
      where: {
        organizationId: 1,
        sourceType: "BONUS",
        sourceId: { in: [7, 8] },
        deletedAt: null,
        payrollEntry: {
          status: { not: "CANCELLED" },
          payrollRun: { payrollPeriodId: { not: period.id } },
        },
      },
      select: { sourceId: true },
    });
  });

  it("only considers loan installments not claimed by another period's live run", async () => {
    const service = createService({ pfProfile: null, esiProfile: null });

    await service.calculateForEmployee(1, period.id, 10);

    const [args] = lastPrisma.employeeLoan.findMany.mock.calls[0] as [
      { include: { repayments: { where: { OR: unknown } } } },
    ];
    expect(args.include.repayments.where.OR).toEqual([
      { payrollEntryId: null },
      { payrollEntry: { status: "CANCELLED" } },
      { payrollEntry: { payrollRun: { payrollPeriodId: period.id } } },
    ]);
  });

  const loan = (overrides: Record<string, unknown> = {}) => ({
    id: 5,
    loanNumber: "LN-2026-001",
    emiAmount: new Prisma.Decimal(3000),
    status: "ACTIVE",
    skipRequests: [],
    repayments: [{ id: 51, amount: new Prisma.Decimal(3000) }],
    ...overrides,
  });

  it("deducts nothing for a loan with no installment due by the period end", async () => {
    // The query only returns PENDING installments due by periodEnd, so a
    // loan before its first due date (or fully repaid) comes back with none.
    const service = createService({
      pfProfile: null,
      esiProfile: null,
      loans: [loan({ repayments: [] })],
    });

    const result = (await service.calculateForEmployee(1, period.id, 10))!;

    expect(result.totalDeductions).toBe(0);
    expect(result.loanRepayments).toEqual([]);
  });

  it("deducts nothing for a loan with an approved skip for the period", async () => {
    const service = createService({
      pfProfile: null,
      esiProfile: null,
      loans: [loan({ skipRequests: [{ id: 1, status: "APPROVED" }] })],
    });

    const result = (await service.calculateForEmployee(1, period.id, 10))!;

    expect(result.loanRepayments).toEqual([]);
    expect(result.netPayable).toBe(50000);
  });

  it("deducts the scheduled installment amount, not the nominal EMI", async () => {
    const service = createService({
      pfProfile: null,
      esiProfile: null,
      loans: [
        loan({ repayments: [{ id: 60, amount: new Prisma.Decimal(500) }] }),
      ],
    });

    const result = (await service.calculateForEmployee(1, period.id, 10))!;

    expect(result.totalDeductions).toBe(500);
    expect(result.loanRepayments[0]?.repaymentId).toBe(60);
  });

  it("leaves an installment that does not fit in net pay PENDING instead of clamping", async () => {
    const service = createService({
      pfProfile: null,
      esiProfile: null,
      loans: [
        loan({ repayments: [{ id: 70, amount: new Prisma.Decimal(60000) }] }),
      ],
    });

    const result = (await service.calculateForEmployee(1, period.id, 10))!;

    expect(result.loanRepayments).toEqual([]);
    expect(result.totalDeductions).toBe(0);
    expect(result.netPayable).toBe(50000);
  });

  it("pays arrears once: included while unpaid, omitted after a finalized period paid them", async () => {
    const withArrears = { ...salary, arrearsSalary: new Prisma.Decimal(4000) };

    const unpaid = createService({
      pfProfile: null,
      esiProfile: null,
      employeeSalary: withArrears,
    });
    const first = (await unpaid.calculateForEmployee(1, period.id, 10))!;
    expect(
      first.earnings.find((e) => e.code === "ARREARS")?.calculatedAmount,
    ).toBe(4000);
    expect(first.totalGrossEarnings).toBe(54000);

    const paid = createService({
      pfProfile: null,
      esiProfile: null,
      employeeSalary: { ...withArrears, arrearsPaidPeriodId: 99 },
    });
    const later = (await paid.calculateForEmployee(1, period.id, 10))!;
    expect(later.earnings.some((e) => e.code === "ARREARS")).toBe(false);
    expect(later.totalGrossEarnings).toBe(50000);
  });

  it("excludes bonus from the ESI wage and arrears from ESI eligibility", async () => {
    const lowSalary = {
      ...salary,
      // grossMonthly as stored by older rows that still included arrears
      grossMonthly: new Prisma.Decimal(23000),
      basic: new Prisma.Decimal(10000),
      hra: new Prisma.Decimal(5000),
      conveyance: new Prisma.Decimal(2000),
      otherAllowance: new Prisma.Decimal(3000),
      specialAllowance: new Prisma.Decimal(0),
      arrearsSalary: new Prisma.Decimal(3000),
    };
    const service = createService({
      employeeSalary: lowSalary,
      pfProfile: null,
      esiProfile: { esiApplicable: true, insuranceNumber: "ESI123" },
      bonuses: [
        {
          id: 8,
          bonusType: "PERFORMANCE",
          amount: new Prisma.Decimal(10000),
          status: "APPROVED",
        },
      ],
    });

    const result = (await service.calculateForEmployee(1, period.id, 10))!;

    // Eligible: recurring wage is 20000 even though stored gross says 23000.
    expect(result.esi).toBeDefined();
    // Wage = 20000 recurring + 3000 arrears; the 10000 bonus is excluded.
    expect(result.esi?.esiWage).toBe(23000);
    expect(result.esi?.employeeContribution).toBe(172.5);
  });
});
