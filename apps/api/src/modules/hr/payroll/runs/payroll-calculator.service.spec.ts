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
    employeeSalary?: unknown;
  }) {
    const prisma = {
      payrollPeriod: {
        findUniqueOrThrow: vi.fn().mockResolvedValue(period),
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
        findMany: vi
          .fn()
          .mockResolvedValue(
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
    };

    return new PayrollCalculatorService(prisma as never);
  }

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
    expect(result.loanRepayments[0]?.amount).toBe(3000);
    expect(result.bonusIds).toEqual([7]);
  });
});
