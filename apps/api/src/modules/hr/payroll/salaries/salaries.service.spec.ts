import { afterEach, describe, expect, it, vi } from "vitest";
import { PaginatedResponseDto } from "../../../../common/dto/paginated-response.dto.js";
import {
  BusinessRuleConflictException,
  BusinessRuleViolationException,
  ResourceNotFoundException,
} from "../../../../common/exceptions/business.exception.js";
import { SalariesService } from "./salaries.service.js";

const ORG_SCOPE = { organizationId: 1 };
const USER_ID = 42;
const EMPLOYEE = { id: 7, teamId: 3, userId: 70 };

const CURRENT = {
  id: 20,
  employeeId: 7,
  employee: EMPLOYEE,
  effectiveFrom: new Date("2026-04-01T00:00:00.000Z"),
  effectiveTo: null as Date | null,
  basic: "20000.00",
  hra: "8000.00",
  conveyance: "1600.00",
  otherAllowance: "400.00",
  specialAllowance: "0.00",
};

function errorCode(err: unknown): unknown {
  return (err as { errorCode?: string }).errorCode;
}

function makeService(opts?: {
  level?: "own" | "team" | "all";
  teamIds?: number[];
  employee?: unknown;
  clash?: unknown;
  current?: unknown;
}) {
  const level = opts?.level ?? "all";
  const teamScope = {
    level,
    userId: USER_ID,
    organizationId: 1,
    teamIds: opts?.teamIds ?? (level === "team" ? [3] : []),
  };
  const repository = {
    findOverlapping: vi.fn().mockResolvedValue(opts?.clash ?? null),
    create: vi.fn().mockResolvedValue({ id: 1 }),
    findMany: vi.fn().mockResolvedValue({ items: [{ id: 1 }], total: 1 }),
    findById: vi
      .fn()
      .mockResolvedValue(
        opts && "current" in opts ? opts.current : { ...CURRENT },
      ),
    findApplicableOn: vi.fn().mockResolvedValue({ id: 20 }),
    update: vi.fn().mockResolvedValue({ id: 20 }),
  };
  const tenantContext = {
    getOrgScope: vi.fn().mockReturnValue(ORG_SCOPE),
    getUserId: vi.fn().mockReturnValue(USER_ID),
  };
  const teamContext = { resolveScope: vi.fn().mockResolvedValue(teamScope) };
  const prisma = {
    employee: {
      findFirst: vi
        .fn()
        .mockResolvedValue(
          opts && "employee" in opts ? opts.employee : EMPLOYEE,
        ),
    },
  };
  const service = new SalariesService(
    repository as never,
    tenantContext as never,
    teamContext as never,
    prisma as never,
  );
  return { service, repository, teamContext, teamScope, prisma };
}

const BASE_DTO = {
  employeeId: 7,
  effectiveFrom: "2026-04-01",
  basic: 20000,
  hra: 8000,
};

describe("SalariesService", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  describe("create", () => {
    it("derives gross from recurring components (arrears excluded) and stores it", async () => {
      const { service, repository, prisma, teamContext } = makeService();
      const dto = {
        ...BASE_DTO,
        effectiveTo: "2027-03-31",
        conveyance: 1600,
        otherAllowance: 400,
        specialAllowance: 1000,
        arrearsSalary: 50000,
      };

      await service.create(dto);

      expect(teamContext.resolveScope).toHaveBeenCalledWith("hr.salary.write");
      expect(prisma.employee.findFirst).toHaveBeenCalledWith({
        where: { id: 7, organizationId: 1, deletedAt: null },
      });
      const from = new Date("2026-04-01T00:00:00.000Z");
      const to = new Date("2027-03-31T00:00:00.000Z");
      expect(repository.findOverlapping).toHaveBeenCalledWith(
        ORG_SCOPE,
        7,
        from,
        to,
      );
      expect(repository.create).toHaveBeenCalledWith(
        ORG_SCOPE,
        dto,
        from,
        to,
        31000,
        USER_ID,
      );
    });

    it("treats missing optional allowances as zero and an open end date as null", async () => {
      const { service, repository } = makeService();
      await service.create(BASE_DTO);
      const [, , , to, gross] = repository.create.mock.calls[0] as unknown[];
      expect(to).toBeNull();
      expect(gross).toBe(28000);
    });

    it("uses an explicit grossMonthly when supplied", async () => {
      const { service, repository } = makeService();
      await service.create({ ...BASE_DTO, grossMonthly: 30000 });
      expect(repository.create.mock.calls[0]![4]).toBe(30000);
    });

    it("throws not found for an unknown employee", async () => {
      const { service, repository } = makeService({ employee: null });
      await expect(service.create(BASE_DTO)).rejects.toBeInstanceOf(
        ResourceNotFoundException,
      );
      expect(repository.create).not.toHaveBeenCalled();
    });

    it("allows a .team holder for an employee in their team", async () => {
      const { service, repository } = makeService({ level: "team" });
      await service.create(BASE_DTO);
      expect(repository.create).toHaveBeenCalledOnce();
    });

    it("hides an employee outside the caller's teams as not found", async () => {
      const { service, repository } = makeService({
        level: "team",
        teamIds: [9],
      });
      await expect(service.create(BASE_DTO)).rejects.toBeInstanceOf(
        ResourceNotFoundException,
      );
      expect(repository.create).not.toHaveBeenCalled();
    });

    it("refuses an .own grant (nobody sets their own salary)", async () => {
      const { service, repository } = makeService({ level: "own" });
      await expect(service.create(BASE_DTO)).rejects.toBeInstanceOf(
        ResourceNotFoundException,
      );
      expect(repository.create).not.toHaveBeenCalled();
    });

    it("rejects effectiveTo before effectiveFrom", async () => {
      const { service, repository } = makeService();
      const err = await service
        .create({ ...BASE_DTO, effectiveTo: "2026-03-31" })
        .catch((e: unknown) => e);
      expect(err).toBeInstanceOf(BusinessRuleViolationException);
      expect(errorCode(err)).toBe("SALARY_DATES_INVALID");
      expect(repository.findOverlapping).not.toHaveBeenCalled();
    });

    it("allows a single-day structure (effectiveTo == effectiveFrom)", async () => {
      const { service, repository } = makeService();
      await service.create({ ...BASE_DTO, effectiveTo: "2026-04-01" });
      expect(repository.create).toHaveBeenCalledOnce();
    });

    it("rejects an overlapping salary record", async () => {
      const { service, repository } = makeService({ clash: { id: 3 } });
      const err = await service.create(BASE_DTO).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(BusinessRuleConflictException);
      expect(errorCode(err)).toBe("SALARY_OVERLAP");
      expect(repository.create).not.toHaveBeenCalled();
    });
  });

  describe("findAll / findOne", () => {
    it("lists salaries with the caller's read scope", async () => {
      const { service, repository, teamContext, teamScope } = makeService({
        level: "team",
      });
      const query = { page: 1, limit: 20 };
      const result = await service.findAll(query as never);
      expect(teamContext.resolveScope).toHaveBeenCalledWith("hr.salary.read");
      expect(repository.findMany).toHaveBeenCalledWith(teamScope, query, query);
      expect(result).toBeInstanceOf(PaginatedResponseDto);
      expect(result.items).toEqual([{ id: 1 }]);
    });

    it("returns one salary in scope", async () => {
      const { service, repository, teamScope } = makeService();
      await expect(service.findOne(20)).resolves.toMatchObject({ id: 20 });
      expect(repository.findById).toHaveBeenCalledWith(teamScope, 20);
    });

    it("throws not found when out of scope", async () => {
      const { service } = makeService({ current: null });
      await expect(service.findOne(20)).rejects.toBeInstanceOf(
        ResourceNotFoundException,
      );
    });
  });

  describe("findApplicableOn", () => {
    it("parses the given date-only string", async () => {
      const { service, repository, teamScope } = makeService();
      await service.findApplicableOn(7, "2026-05-15");
      expect(repository.findApplicableOn).toHaveBeenCalledWith(
        teamScope,
        7,
        new Date("2026-05-15T00:00:00.000Z"),
      );
    });

    it("defaults to now when no date is given", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-06-10T08:00:00.000Z"));
      const { service, repository } = makeService();
      await service.findApplicableOn(7);
      expect(repository.findApplicableOn.mock.calls[0]![2]).toEqual(
        new Date("2026-06-10T08:00:00.000Z"),
      );
    });

    it("throws not found when nothing applies", async () => {
      const { service, repository } = makeService();
      repository.findApplicableOn.mockResolvedValue(null);
      await expect(
        service.findApplicableOn(7, "2020-01-01"),
      ).rejects.toBeInstanceOf(ResourceNotFoundException);
    });
  });

  describe("update", () => {
    it("recomputes gross from changed + current components", async () => {
      const { service, repository } = makeService();

      await service.update(20, { basic: 25000 });

      // 25000 + 8000 + 1600 + 400 + 0
      expect(repository.update).toHaveBeenCalledWith(
        ORG_SCOPE,
        20,
        { basic: 25000 },
        undefined,
        35000,
        USER_ID,
      );
      expect(repository.findOverlapping).not.toHaveBeenCalled();
    });

    it("leaves gross and end date untouched when neither is changed", async () => {
      const { service, repository } = makeService();
      await service.update(20, { arrearsSalary: 1000 });
      const [, , , to, gross] = repository.update.mock.calls[0] as unknown[];
      expect(to).toBeUndefined();
      expect(gross).toBeUndefined();
    });

    it("sets a new end date after checking overlaps (excluding itself)", async () => {
      const { service, repository } = makeService();
      await service.update(20, { effectiveTo: "2026-12-31" });
      const to = new Date("2026-12-31T00:00:00.000Z");
      expect(repository.findOverlapping).toHaveBeenCalledWith(
        ORG_SCOPE,
        7,
        CURRENT.effectiveFrom,
        to,
        20,
      );
      expect(repository.update.mock.calls[0]![3]).toEqual(to);
    });

    it("clears the end date when effectiveTo is an empty string", async () => {
      const { service, repository } = makeService({
        current: {
          ...CURRENT,
          effectiveTo: new Date("2026-12-31T00:00:00.000Z"),
        },
      });
      await service.update(20, { effectiveTo: "" });
      expect(repository.findOverlapping.mock.calls[0]![3]).toBeNull();
      expect(repository.update.mock.calls[0]![3]).toBeNull();
    });

    it("rejects an end date before the current start date", async () => {
      const { service, repository } = makeService();
      const err = await service
        .update(20, { effectiveTo: "2026-03-01" })
        .catch((e: unknown) => e);
      expect(errorCode(err)).toBe("SALARY_DATES_INVALID");
      expect(repository.update).not.toHaveBeenCalled();
    });

    it("rejects an end date that would overlap another record", async () => {
      const { service, repository } = makeService({ clash: { id: 21 } });
      const err = await service
        .update(20, { effectiveTo: "2027-12-31" })
        .catch((e: unknown) => e);
      expect(err).toBeInstanceOf(BusinessRuleConflictException);
      expect(errorCode(err)).toBe("SALARY_OVERLAP");
      expect(repository.update).not.toHaveBeenCalled();
    });

    it("throws not found when the salary is not readable", async () => {
      const { service, repository } = makeService({ current: null });
      await expect(service.update(20, { basic: 1 })).rejects.toBeInstanceOf(
        ResourceNotFoundException,
      );
      expect(repository.update).not.toHaveBeenCalled();
    });

    it("checks write scope against the salary's employee", async () => {
      const { service, repository, teamContext } = makeService({
        level: "team",
        teamIds: [9],
      });
      await expect(service.update(20, { basic: 1 })).rejects.toBeInstanceOf(
        ResourceNotFoundException,
      );
      expect(teamContext.resolveScope).toHaveBeenCalledWith("hr.salary.write");
      expect(repository.update).not.toHaveBeenCalled();
    });
  });
});
