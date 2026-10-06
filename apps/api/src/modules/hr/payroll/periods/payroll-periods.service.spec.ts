import { describe, expect, it, vi } from "vitest";
import {
  BusinessRuleViolationException,
  ResourceConflictException,
} from "../../../../common/exceptions/business.exception.js";
import { PayrollPeriodsService } from "./payroll-periods.service.js";

const SCOPE = { organizationId: 1 };
const USER_ID = 42;

function makeService(overrides?: {
  existingPeriod?: unknown;
  currentPeriod?: unknown;
  approvedRunEntries?: unknown[];
}) {
  const repository = {
    findMany: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    findById: vi.fn().mockResolvedValue(overrides?.currentPeriod ?? null),
    findByYearMonth: vi
      .fn()
      .mockResolvedValue(overrides?.existingPeriod ?? null),
    create: vi
      .fn()
      .mockImplementation(
        (
          _scope: unknown,
          dto: Record<string, unknown>,
          dates: Record<string, unknown>,
          userId: number,
        ) => ({
          id: 1,
          ...dto,
          ...dates,
          status: "DRAFT",
          createdBy: userId,
        }),
      ),
    updateStatus: vi
      .fn()
      .mockImplementation(
        (_scope: unknown, id: number, status: string, userId: number) => ({
          id,
          status,
          updatedBy: userId,
        }),
      ),
    finalize: vi
      .fn()
      .mockImplementation((_scope: unknown, id: number, userId: number) => ({
        id,
        year: 2026,
        month: 4,
        status: "FINALIZED",
        finalizedAt: new Date(),
        finalizedById: userId,
      })),
  };

  const tenantContext = {
    getOrgScope: vi.fn().mockReturnValue(SCOPE),
    getUserId: vi.fn().mockReturnValue(USER_ID),
  };

  const prisma = {
    $transaction: vi
      .fn()
      .mockImplementation(
        async (cb: (tx: Record<string, unknown>) => Promise<unknown>) => {
          const tx = {
            payslip: {
              count: vi.fn().mockResolvedValue(0),
              upsert: vi.fn().mockResolvedValue({ id: 101 }),
            },
            payrollEntry: {
              findMany: vi
                .fn()
                .mockResolvedValue(
                  overrides?.approvedRunEntries ?? [
                    { id: 11, employeeId: 101, netPayable: 45000 },
                  ],
                ),
            },
            loanRepayment: {
              updateMany: vi.fn().mockResolvedValue({ count: 1 }),
            },
            employeeBonus: {
              updateMany: vi.fn().mockResolvedValue({ count: 1 }),
            },
          };
          return cb(tx);
        },
      ),
  };

  const service = new PayrollPeriodsService(
    repository as never,
    tenantContext as never,
    prisma as never,
  );

  return { service, repository, prisma };
}

describe("PayrollPeriodsService", () => {
  it("creates a period successfully", async () => {
    const { service, repository } = makeService();
    const result = await service.create({
      year: 2026,
      month: 4,
      periodStart: "2026-04-01",
      periodEnd: "2026-04-30",
    });

    expect(result.year).toBe(2026);
    expect(result.month).toBe(4);
    expect(repository.create).toHaveBeenCalledOnce();
  });

  it("rejects duplicate period for the same year and month", async () => {
    const { service } = makeService({
      existingPeriod: { id: 1, year: 2026, month: 4 },
    });
    await expect(
      service.create({ year: 2026, month: 4 }),
    ).rejects.toBeInstanceOf(ResourceConflictException);
  });

  it("rejects period with periodEnd preceding periodStart", async () => {
    const { service } = makeService();
    await expect(
      service.create({
        year: 2026,
        month: 4,
        periodStart: "2026-04-30",
        periodEnd: "2026-04-01",
      }),
    ).rejects.toBeInstanceOf(BusinessRuleViolationException);
  });

  it("rejects updating a finalized period", async () => {
    const { service } = makeService({
      currentPeriod: { id: 1, status: "FINALIZED" },
    });

    await expect(
      service.update(1, { status: "CANCELLED" }),
    ).rejects.toBeInstanceOf(BusinessRuleViolationException);
  });

  it("rejects finalization if period is already finalized", async () => {
    const { service } = makeService({
      currentPeriod: { id: 1, status: "FINALIZED" },
    });

    await expect(service.finalize(1)).rejects.toBeInstanceOf(
      BusinessRuleViolationException,
    );
  });

  it("rejects finalization if no approved run exists", async () => {
    const { service } = makeService({
      currentPeriod: {
        id: 1,
        status: "PROCESSING",
        runs: [{ id: 1, status: "PROCESSED" }], // not APPROVED
      },
    });

    await expect(service.finalize(1)).rejects.toBeInstanceOf(
      BusinessRuleViolationException,
    );
  });

  it("finalizes period, locks calculations and generates payslips", async () => {
    const { service, repository } = makeService({
      currentPeriod: {
        id: 1,
        year: 2026,
        month: 4,
        status: "PROCESSING",
        runs: [{ id: 10, status: "APPROVED" }],
      },
      approvedRunEntries: [
        { id: 201, employeeId: 50, netPayable: 60000 },
        { id: 202, employeeId: 51, netPayable: 45000 },
      ],
    });

    const result = await service.finalize(1);
    expect(result.status).toBe("FINALIZED");
    expect(repository.finalize).toHaveBeenCalledOnce();
  });
});
