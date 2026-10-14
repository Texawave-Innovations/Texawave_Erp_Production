import { ForbiddenException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { PaginatedResponseDto } from "../../../../common/dto/paginated-response.dto.js";
import {
  BusinessRuleViolationException,
  ResourceNotFoundException,
} from "../../../../common/exceptions/business.exception.js";
import { BonusesService } from "./bonuses.service.js";
import { QueryBonusDto, type CreateBonusDto } from "./dto/bonus.dto.js";

const SCOPE = { organizationId: 1 };
const USER_ID = 42;

function errorCode(err: unknown): unknown {
  return (err as { errorCode?: string }).errorCode;
}

const RULES = {
  bonusEligibilityLimit: 21000,
  bonusCalculationCeiling: 7000,
  bonusPercent: 8.33,
  gratuityMinYears: 5,
  gratuityCap: 2000000,
};

function makeService(overrides?: {
  level?: "own" | "team" | "all";
  period?: unknown;
  bonus?: unknown;
  yearEntries?: unknown[];
  raised?: number[];
  gratuityEmployee?: unknown;
}) {
  const repository = {
    create: vi.fn().mockResolvedValue({ id: 1, status: "PENDING" }),
    findMany: vi.fn().mockResolvedValue({ items: [{ id: 1 }], total: 31 }),
    findById: vi
      .fn()
      .mockResolvedValue(
        overrides && "bonus" in overrides ? overrides.bonus : null,
      ),
    decide: vi.fn().mockResolvedValue({ id: 3, status: "APPROVED" }),
    finalizedYearEntries: vi
      .fn()
      .mockResolvedValue(overrides?.yearEntries ?? []),
    statutoryBonusAlreadyRaised: vi
      .fn()
      .mockResolvedValue(new Set(overrides?.raised ?? [])),
    createStatutoryBonuses: vi.fn().mockResolvedValue([501]),
    gratuityInputs: vi
      .fn()
      .mockResolvedValue(
        overrides && "gratuityEmployee" in overrides
          ? overrides.gratuityEmployee
          : null,
      ),
  };
  const teamScope = {
    level: overrides?.level ?? "all",
    userId: USER_ID,
    organizationId: 1,
    teamIds: [3],
  };
  const prisma = {
    payrollPeriod: {
      findFirst: vi
        .fn()
        .mockResolvedValue(
          overrides && "period" in overrides
            ? overrides.period
            : { id: 5, status: "DRAFT" },
        ),
    },
  };
  const service = new BonusesService(
    repository as never,
    {
      getOrgScope: vi.fn().mockReturnValue(SCOPE),
      getUserId: vi.fn().mockReturnValue(USER_ID),
    } as never,
    { resolveScope: vi.fn().mockResolvedValue(teamScope) } as never,
    prisma as never,
    { rules: vi.fn().mockResolvedValue(RULES) } as never,
  );
  return { service, repository, teamScope };
}

const CREATE_DTO: CreateBonusDto = {
  employeeId: 7,
  bonusType: "FESTIVAL",
  amount: 5000,
};

const month = (basic: number, payableDays = 30) => ({
  employeeId: 7,
  payableDays: String(payableDays),
  employee: { id: 7, employeeCode: "EMP-000007", fullName: "Seven" },
  earnings: [
    {
      code: "BASIC",
      baseAmount: String(basic),
      calculatedAmount: String(basic),
    },
  ],
});

describe("BonusesService", () => {
  describe("create", () => {
    it("passes the caller's write scope to the repository (which re-checks the employee)", async () => {
      const { service, repository, teamScope } = makeService();
      await service.create(CREATE_DTO);
      expect(repository.create).toHaveBeenCalledWith(
        teamScope,
        CREATE_DTO,
        USER_ID,
      );
    });

    it("refuses a finalized period", async () => {
      const { service } = makeService({
        period: { id: 5, status: "FINALIZED" },
      });
      await expect(
        service.create({ ...CREATE_DTO, payrollPeriodId: 5 }),
      ).rejects.toBeInstanceOf(BusinessRuleViolationException);
    });

    it("hides another organization's period as not found", async () => {
      const { service } = makeService({ period: null });
      await expect(
        service.create({ ...CREATE_DTO, payrollPeriodId: 99 }),
      ).rejects.toBeInstanceOf(ResourceNotFoundException);
    });
  });

  describe("decide", () => {
    const PENDING = {
      id: 3,
      status: "PENDING",
      createdBy: 11,
      employee: { userId: 70 },
    };

    it("approves a pending bonus raised by someone else", async () => {
      const { service, repository, teamScope } = makeService({
        bonus: PENDING,
      });
      await service.decide(3, { decision: "APPROVED" });
      expect(repository.decide).toHaveBeenCalledWith(
        teamScope,
        3,
        "APPROVED",
        USER_ID,
        undefined,
      );
    });

    it("refuses the person who raised it", async () => {
      const { service } = makeService({
        bonus: { ...PENDING, createdBy: USER_ID },
      });
      await expect(
        service.decide(3, { decision: "APPROVED" }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it("refuses the recipient", async () => {
      const { service } = makeService({
        bonus: { ...PENDING, employee: { userId: USER_ID } },
      });
      await expect(
        service.decide(3, { decision: "APPROVED" }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe("statutory bonus", () => {
    it("is organization-wide only", async () => {
      const { service } = makeService({ level: "team" });
      await expect(
        service.statutory({ financialYear: "2025-26" }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it("previews from finalized months without creating anything", async () => {
      const { service, repository } = makeService({
        yearEntries: Array.from({ length: 12 }, () => month(10000)),
      });
      const res = await service.statutory({ financialYear: "2025-26" });
      // 12 × min(10000, 7000) × 8.33% = 6997
      expect(res.employees[0]).toMatchObject({ eligible: true, amount: 6997 });
      expect(repository.createStatutoryBonuses).not.toHaveBeenCalled();
    });

    it("creates only for eligible employees not already raised", async () => {
      const { service, repository } = makeService({
        yearEntries: Array.from({ length: 12 }, () => month(10000)),
        raised: [7],
      });
      const res = await service.statutory({
        financialYear: "2025-26",
        create: true,
      });
      expect(res.employees[0]?.alreadyRaised).toBe(true);
      expect(repository.createStatutoryBonuses).not.toHaveBeenCalled();
    });

    it("rejects a malformed financial year", async () => {
      const { service } = makeService();
      const err = await service
        .statutory({ financialYear: "2025-27" })
        .catch((e: unknown) => e);
      expect(errorCode(err)).toBe("FINANCIAL_YEAR_INVALID");
    });
  });

  describe("gratuity", () => {
    const EMP = {
      id: 7,
      employeeCode: "EMP-000007",
      fullName: "Seven",
      dateOfJoining: new Date("2018-01-01T00:00:00.000Z"),
      dateOfExit: null,
      salaries: [{ basic: "26000", components: [{ monthlyAmount: "26000" }] }],
    };

    it("calculates 15/26 of Basic + DA per counted year", async () => {
      const { service } = makeService({ gratuityEmployee: EMP });
      const res = await service.gratuityFor(7, "2026-08-01");
      // 8 completed years + 7 months (> 6) = 9 counted years
      expect(res).toMatchObject({
        eligible: true,
        countedYears: 9,
        amount: 135000,
      });
    });

    it("raises nothing for fewer than five years", async () => {
      const { service } = makeService({
        gratuityEmployee: {
          ...EMP,
          dateOfJoining: new Date("2024-01-01T00:00:00.000Z"),
        },
      });
      const err = await service
        .createGratuity({ employeeId: 7, asOf: "2026-08-01" })
        .catch((e: unknown) => e);
      expect(errorCode(err)).toBe("GRATUITY_NOT_ELIGIBLE");
    });
  });

  it("lists bonuses within the read scope", async () => {
    const { service } = makeService();
    const res = await service.findAll(
      Object.assign(new QueryBonusDto(), { page: 1, limit: 10 }),
    );
    expect(res).toBeInstanceOf(PaginatedResponseDto);
  });
});
