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

const EMPLOYEE = { id: 7, teamId: 3, userId: 70 };

function makeService(overrides?: {
  level?: "own" | "team" | "all";
  teamIds?: number[];
  employee?: unknown;
  period?: unknown;
  bonus?: unknown;
}) {
  const repository = {
    create: vi
      .fn()
      .mockImplementation(
        (_scope: unknown, dto: Record<string, unknown>, userId: number) => ({
          id: 1,
          ...dto,
          status: "PENDING",
          createdBy: userId,
        }),
      ),
    findMany: vi.fn().mockResolvedValue({ items: [{ id: 1 }], total: 31 }),
    findById: vi
      .fn()
      .mockResolvedValue(
        overrides && "bonus" in overrides ? overrides.bonus : null,
      ),
    decide: vi
      .fn()
      .mockImplementation(
        (_scope: unknown, id: number, decision: string, userId: number) => ({
          id,
          status: decision,
          decidedBy: userId,
        }),
      ),
  };

  const tenantContext = {
    getOrgScope: vi.fn().mockReturnValue(SCOPE),
    getUserId: vi.fn().mockReturnValue(USER_ID),
  };

  const teamScope = {
    level: overrides?.level ?? "all",
    userId: USER_ID,
    organizationId: 1,
    teamIds: overrides?.teamIds ?? [],
  };
  const teamContext = {
    resolveScope: vi.fn().mockResolvedValue(teamScope),
  };

  const prisma = {
    employee: {
      findFirst: vi
        .fn()
        .mockResolvedValue(
          overrides && "employee" in overrides ? overrides.employee : EMPLOYEE,
        ),
    },
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
    tenantContext as never,
    teamContext as never,
    prisma as never,
  );

  return { service, repository, teamContext, prisma, teamScope };
}

const CREATE_DTO: CreateBonusDto = {
  employeeId: 7,
  bonusType: "FESTIVAL",
  amount: 5000,
};

describe("BonusesService", () => {
  describe("create", () => {
    it("creates a bonus without a period for an org-wide writer", async () => {
      const { service, repository, prisma, teamContext } = makeService();

      const result = await service.create(CREATE_DTO);

      expect(teamContext.resolveScope).toHaveBeenCalledWith("hr.bonus.write");
      expect(prisma.employee.findFirst).toHaveBeenCalledWith({
        where: { id: 7, organizationId: 1, deletedAt: null },
      });
      expect(prisma.payrollPeriod.findFirst).not.toHaveBeenCalled();
      expect(repository.create).toHaveBeenCalledWith(
        SCOPE,
        CREATE_DTO,
        USER_ID,
      );
      expect(result).toMatchObject({ status: "PENDING", createdBy: USER_ID });
    });

    it("rejects an unknown employee as not found", async () => {
      const { service, repository } = makeService({ employee: null });

      await expect(service.create(CREATE_DTO)).rejects.toBeInstanceOf(
        ResourceNotFoundException,
      );
      expect(repository.create).not.toHaveBeenCalled();
    });

    it("hides an employee outside the caller's teams as not found", async () => {
      const { service, repository } = makeService({
        level: "team",
        teamIds: [99],
      });

      await expect(service.create(CREATE_DTO)).rejects.toBeInstanceOf(
        ResourceNotFoundException,
      );
      expect(repository.create).not.toHaveBeenCalled();
    });

    it("allows a team-scoped writer for an employee in their team", async () => {
      const { service, repository } = makeService({
        level: "team",
        teamIds: [3],
      });

      await service.create(CREATE_DTO);

      expect(repository.create).toHaveBeenCalledOnce();
    });

    it("never lets an own-scoped caller write bonuses", async () => {
      const { service, repository } = makeService({ level: "own" });

      await expect(service.create(CREATE_DTO)).rejects.toBeInstanceOf(
        ResourceNotFoundException,
      );
      expect(repository.create).not.toHaveBeenCalled();
    });

    it("validates the payroll period when one is given", async () => {
      const { service, repository, prisma } = makeService();

      await service.create({ ...CREATE_DTO, payrollPeriodId: 5 });

      expect(prisma.payrollPeriod.findFirst).toHaveBeenCalledWith({
        where: { id: 5, organizationId: 1, deletedAt: null },
      });
      expect(repository.create).toHaveBeenCalledOnce();
    });

    it("rejects an unknown payroll period", async () => {
      const { service, repository } = makeService({ period: null });

      await expect(
        service.create({ ...CREATE_DTO, payrollPeriodId: 5 }),
      ).rejects.toBeInstanceOf(ResourceNotFoundException);
      expect(repository.create).not.toHaveBeenCalled();
    });

    it("rejects assigning a bonus to a finalized period", async () => {
      const { service, repository } = makeService({
        period: { id: 5, status: "FINALIZED" },
      });

      const error = await service
        .create({ ...CREATE_DTO, payrollPeriodId: 5 })
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(BusinessRuleViolationException);
      expect((error as BusinessRuleViolationException).errorCode).toBe(
        "PERIOD_FINALIZED",
      );
      expect(repository.create).not.toHaveBeenCalled();
    });
  });

  describe("findAll / findOne", () => {
    it("returns a paginated list under the read scope", async () => {
      const { service, repository, teamContext, teamScope } = makeService();
      const query = Object.assign(new QueryBonusDto(), { page: 2, limit: 10 });

      const result = await service.findAll(query);

      expect(teamContext.resolveScope).toHaveBeenCalledWith("hr.bonus.read");
      expect(repository.findMany).toHaveBeenCalledWith(teamScope, query, query);
      expect(result).toBeInstanceOf(PaginatedResponseDto);
      expect(result.items).toEqual([{ id: 1 }]);
      expect(result.total).toBe(31);
      expect(result.page).toBe(2);
      expect(result.limit).toBe(10);
      expect(result.totalPages).toBe(4);
    });

    it("returns a single bonus in scope", async () => {
      const { service, repository, teamScope } = makeService({
        bonus: { id: 9, status: "PENDING" },
      });

      await expect(service.findOne(9)).resolves.toEqual({
        id: 9,
        status: "PENDING",
      });
      expect(repository.findById).toHaveBeenCalledWith(teamScope, 9);
    });

    it("reports a bonus outside scope as not found", async () => {
      const { service } = makeService({ bonus: null });

      await expect(service.findOne(9)).rejects.toBeInstanceOf(
        ResourceNotFoundException,
      );
    });
  });

  describe("decide", () => {
    const pending = {
      id: 9,
      status: "PENDING",
      createdBy: 11,
      employee: { userId: 70 },
    };

    it("approves a pending bonus raised by someone else", async () => {
      const { service, repository, teamContext } = makeService({
        bonus: pending,
      });

      const result = await service.decide(9, { decision: "APPROVED" });

      expect(teamContext.resolveScope).toHaveBeenCalledWith("hr.bonus.approve");
      expect(repository.decide).toHaveBeenCalledWith(
        SCOPE,
        9,
        "APPROVED",
        USER_ID,
      );
      expect(result).toEqual({ id: 9, status: "APPROVED", decidedBy: USER_ID });
    });

    it("rejects deciding an unknown bonus", async () => {
      const { service, repository } = makeService({ bonus: null });

      await expect(
        service.decide(9, { decision: "APPROVED" }),
      ).rejects.toBeInstanceOf(ResourceNotFoundException);
      expect(repository.decide).not.toHaveBeenCalled();
    });

    it("blocks the maker from approving their own bonus", async () => {
      const { service, repository } = makeService({
        bonus: { ...pending, createdBy: USER_ID },
      });

      await expect(
        service.decide(9, { decision: "APPROVED" }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(repository.decide).not.toHaveBeenCalled();
    });

    it("blocks the recipient from approving their own bonus", async () => {
      const { service, repository } = makeService({
        bonus: { ...pending, employee: { userId: USER_ID } },
      });

      await expect(
        service.decide(9, { decision: "REJECTED" }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(repository.decide).not.toHaveBeenCalled();
    });

    it("rejects re-deciding an already decided bonus", async () => {
      const { service, repository } = makeService({
        bonus: { ...pending, status: "APPROVED" },
      });

      const error = await service
        .decide(9, { decision: "REJECTED" })
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(BusinessRuleViolationException);
      expect((error as BusinessRuleViolationException).errorCode).toBe(
        "ALREADY_DECIDED",
      );
      expect(repository.decide).not.toHaveBeenCalled();
    });
  });
});
