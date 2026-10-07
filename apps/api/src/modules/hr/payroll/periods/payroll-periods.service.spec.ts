import { ForbiddenException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import {
  BusinessRuleViolationException,
  ResourceConflictException,
  ResourceNotFoundException,
} from "../../../../common/exceptions/business.exception.js";
import { PayrollPeriodsService } from "./payroll-periods.service.js";

const SCOPE = { organizationId: 1 };
const USER_ID = 42;

function makeService(overrides?: {
  existingPeriod?: unknown;
  currentPeriod?: unknown;
  finalized?: unknown;
  level?: "own" | "team" | "all";
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
      .mockImplementation((_scope: unknown, id: number, userId: number) =>
        overrides && "finalized" in overrides
          ? overrides.finalized
          : {
              id,
              year: 2026,
              month: 4,
              status: "FINALIZED",
              finalizedAt: new Date(),
              finalizedById: userId,
            },
      ),
  };

  const tenantContext = {
    getOrgScope: vi.fn().mockReturnValue(SCOPE),
    getUserId: vi.fn().mockReturnValue(USER_ID),
  };

  const teamContext = {
    resolveScope: vi.fn().mockResolvedValue({
      level: overrides?.level ?? "all",
      userId: USER_ID,
      organizationId: 1,
      teamIds: overrides?.level === "team" ? [3] : [],
    }),
  };

  const service = new PayrollPeriodsService(
    repository as never,
    tenantContext as never,
    teamContext as never,
  );

  return { service, repository, teamContext };
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

  it("rejects period management without an organization-wide grant", async () => {
    const { service, repository } = makeService({ level: "team" });
    await expect(
      service.create({ year: 2026, month: 4 }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("rejects finalization without an organization-wide finalize grant", async () => {
    const { service, repository, teamContext } = makeService({
      level: "team",
    });
    await expect(service.finalize(1)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(teamContext.resolveScope).toHaveBeenCalledWith(
      "hr.payroll.finalize",
    );
    expect(repository.finalize).not.toHaveBeenCalled();
  });

  it("reports an unknown (or other organization's) period as not found", async () => {
    const { service } = makeService({ finalized: null });
    await expect(service.finalize(999)).rejects.toBeInstanceOf(
      ResourceNotFoundException,
    );
  });

  it("finalizes through the locked repository transaction", async () => {
    const { service, repository } = makeService();

    const result = await service.finalize(1);

    expect(result.status).toBe("FINALIZED");
    expect(repository.finalize).toHaveBeenCalledWith(SCOPE, 1, USER_ID);
  });
});
