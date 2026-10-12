import { ForbiddenException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { PaginatedResponseDto } from "../../../../common/dto/paginated-response.dto.js";
import {
  BusinessRuleViolationException,
  ResourceConflictException,
  ResourceNotFoundException,
} from "../../../../common/exceptions/business.exception.js";
import { QueryLoanDto, type CreateLoanDto } from "./dto/loan.dto.js";
import { LoansService } from "./loans.service.js";

const SCOPE = { organizationId: 1 };
const USER_ID = 42;
const EMPLOYEE = { id: 7, teamId: 3, userId: 70 };

function makeService(overrides?: {
  level?: "own" | "team" | "all";
  teamIds?: number[];
  employee?: unknown;
  loan?: unknown;
  period?: unknown;
  existingSkip?: unknown;
  skipRequest?: unknown;
  decided?: unknown;
  mine?: unknown;
}) {
  const repository = {
    create: vi
      .fn()
      .mockImplementation(
        (
          _scope: unknown,
          dto: Record<string, unknown>,
          disbursedDate: Date,
          userId: number,
        ) => ({
          id: 1,
          ...dto,
          disbursedDate,
          status: "ACTIVE",
          createdBy: userId,
        }),
      ),
    findMany: vi.fn().mockResolvedValue({ items: [{ id: 1 }], total: 1 }),
    findById: vi
      .fn()
      .mockResolvedValue(
        overrides && "loan" in overrides
          ? overrides.loan
          : { id: 1, status: "ACTIVE" },
      ),
    createSkipRequest: vi.fn().mockResolvedValue({ id: 20, status: "PENDING" }),
    findSkipRequestById: vi
      .fn()
      .mockResolvedValue(overrides?.skipRequest ?? null),
    decideSkipRequest: vi
      .fn()
      .mockImplementation(
        (_scope: unknown, id: number, decision: string, userId: number) =>
          overrides && "decided" in overrides
            ? overrides.decided
            : { id, status: decision, decidedById: userId },
      ),
    findMine: vi.fn().mockResolvedValue({ items: [{ id: 1 }], total: 1 }),
    findMineById: vi.fn().mockResolvedValue(overrides?.mine ?? null),
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
    loanSkipRequest: {
      findFirst: vi.fn().mockResolvedValue(overrides?.existingSkip ?? null),
    },
  };

  const employeeQuery = {
    getCurrentEmployee: vi.fn().mockResolvedValue({ id: 70 }),
  };

  const service = new LoansService(
    repository as never,
    tenantContext as never,
    teamContext as never,
    prisma as never,
    employeeQuery as never,
  );

  return { service, repository, teamContext, prisma, teamScope };
}

const CREATE_DTO: CreateLoanDto = {
  employeeId: 7,
  principalAmount: 10000,
  emiAmount: 1000,
  emiMonths: 10,
  disbursedDate: "2026-04-15",
};

const PENDING_SKIP = {
  id: 20,
  status: "PENDING",
  requestedById: 11,
  loan: { employee: { userId: 70 } },
  payrollPeriod: { status: "DRAFT" },
};

describe("LoansService", () => {
  describe("create", () => {
    it("creates a loan with the disbursed date parsed as a UTC date", async () => {
      const { service, repository, teamContext, prisma } = makeService();

      const result = await service.create(CREATE_DTO);

      expect(teamContext.resolveScope).toHaveBeenCalledWith("hr.loan.write");
      expect(prisma.employee.findFirst).toHaveBeenCalledWith({
        where: { id: 7, organizationId: 1, deletedAt: null },
      });
      expect(repository.create).toHaveBeenCalledWith(
        SCOPE,
        CREATE_DTO,
        new Date("2026-04-15T00:00:00.000Z"),
        USER_ID,
      );
      expect(result).toMatchObject({ status: "ACTIVE", createdBy: USER_ID });
    });

    it("accepts a schedule whose last installment is a smaller remainder", async () => {
      const { service, repository } = makeService();

      await service.create({
        ...CREATE_DTO,
        principalAmount: 9500.5,
        emiAmount: 1000,
        emiMonths: 10,
      });

      expect(repository.create).toHaveBeenCalledOnce();
    });

    it("rejects a schedule that overshoots the principal", async () => {
      const { service, repository } = makeService();

      const error = await service
        .create({ ...CREATE_DTO, emiMonths: 11 })
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(BusinessRuleViolationException);
      expect((error as BusinessRuleViolationException).errorCode).toBe(
        "LOAN_SCHEDULE_INVALID",
      );
      expect((error as Error).message).toContain(
        "the last installment would be 0",
      );
      expect(repository.create).not.toHaveBeenCalled();
    });

    it("rejects a schedule that leaves more than one EMI for the last month", async () => {
      const { service, repository } = makeService();

      const error = await service
        .create({ ...CREATE_DTO, principalAmount: 10500 })
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(BusinessRuleViolationException);
      expect((error as Error).message).toContain(
        "the last installment would be 1500",
      );
      expect(repository.create).not.toHaveBeenCalled();
    });

    it("rejects an unknown employee", async () => {
      const { service, repository } = makeService({ employee: null });

      await expect(service.create(CREATE_DTO)).rejects.toBeInstanceOf(
        ResourceNotFoundException,
      );
      expect(repository.create).not.toHaveBeenCalled();
    });

    it("hides an employee outside the caller's teams as not found", async () => {
      const { service, repository } = makeService({
        level: "team",
        teamIds: [4],
      });

      await expect(service.create(CREATE_DTO)).rejects.toBeInstanceOf(
        ResourceNotFoundException,
      );
      expect(repository.create).not.toHaveBeenCalled();
    });
  });

  describe("findAll / findOne", () => {
    it("returns a paginated list under the read scope", async () => {
      const { service, repository, teamContext, teamScope } = makeService();
      const query = Object.assign(new QueryLoanDto(), { page: 1, limit: 20 });

      const result = await service.findAll(query);

      expect(teamContext.resolveScope).toHaveBeenCalledWith("hr.loan.read");
      expect(repository.findMany).toHaveBeenCalledWith(teamScope, query, query);
      expect(result).toBeInstanceOf(PaginatedResponseDto);
      expect(result.total).toBe(1);
    });

    it("returns a loan in scope", async () => {
      const { service, repository, teamScope } = makeService({
        loan: { id: 3, status: "CLOSED" },
      });

      await expect(service.findOne(3)).resolves.toEqual({
        id: 3,
        status: "CLOSED",
      });
      expect(repository.findById).toHaveBeenCalledWith(teamScope, 3);
    });

    it("reports a loan outside scope as not found", async () => {
      const { service } = makeService({ loan: null });

      await expect(service.findOne(3)).rejects.toBeInstanceOf(
        ResourceNotFoundException,
      );
    });
  });

  describe("requestSkip", () => {
    const dto = { payrollPeriodId: 5, reason: "Medical emergency" };

    it("creates a skip request for an active loan and open period", async () => {
      const { service, repository, prisma } = makeService();

      const result = await service.requestSkip(1, dto);

      expect(prisma.loanSkipRequest.findFirst).toHaveBeenCalledWith({
        where: { loanId: 1, payrollPeriodId: 5, deletedAt: null },
      });
      expect(repository.createSkipRequest).toHaveBeenCalledWith(
        SCOPE,
        1,
        5,
        "Medical emergency",
        USER_ID,
      );
      expect(result).toEqual({ id: 20, status: "PENDING" });
    });

    it("rejects an unknown loan", async () => {
      const { service, repository } = makeService({ loan: null });

      await expect(service.requestSkip(1, dto)).rejects.toBeInstanceOf(
        ResourceNotFoundException,
      );
      expect(repository.createSkipRequest).not.toHaveBeenCalled();
    });

    it("rejects a skip for a loan that is not active", async () => {
      const { service, repository } = makeService({
        loan: { id: 1, status: "CLOSED" },
      });

      const error = await service.requestSkip(1, dto).catch((e: unknown) => e);

      expect(error).toBeInstanceOf(BusinessRuleViolationException);
      expect((error as BusinessRuleViolationException).errorCode).toBe(
        "LOAN_NOT_ACTIVE",
      );
      expect(repository.createSkipRequest).not.toHaveBeenCalled();
    });

    it("rejects an unknown payroll period", async () => {
      const { service } = makeService({ period: null });

      await expect(service.requestSkip(1, dto)).rejects.toBeInstanceOf(
        ResourceNotFoundException,
      );
    });

    it("rejects a skip for a finalized period", async () => {
      const { service, repository } = makeService({
        period: { id: 5, status: "FINALIZED" },
      });

      const error = await service.requestSkip(1, dto).catch((e: unknown) => e);

      expect(error).toBeInstanceOf(BusinessRuleViolationException);
      expect((error as BusinessRuleViolationException).errorCode).toBe(
        "PERIOD_FINALIZED",
      );
      expect(repository.createSkipRequest).not.toHaveBeenCalled();
    });

    it("rejects a duplicate skip request for the same period", async () => {
      const { service, repository } = makeService({
        existingSkip: { id: 19 },
      });

      await expect(service.requestSkip(1, dto)).rejects.toBeInstanceOf(
        ResourceConflictException,
      );
      expect(repository.createSkipRequest).not.toHaveBeenCalled();
    });
  });

  describe("decideSkip", () => {
    it("approves a pending skip request raised by someone else", async () => {
      const { service, repository, teamContext } = makeService({
        skipRequest: PENDING_SKIP,
      });

      const result = await service.decideSkip(20, { decision: "APPROVED" });

      expect(teamContext.resolveScope).toHaveBeenCalledWith("hr.loan.approve");
      expect(repository.decideSkipRequest).toHaveBeenCalledWith(
        SCOPE,
        20,
        "APPROVED",
        USER_ID,
      );
      expect(result).toEqual({
        id: 20,
        status: "APPROVED",
        decidedById: USER_ID,
      });
    });

    it("rejects an unknown skip request", async () => {
      const { service } = makeService();

      await expect(
        service.decideSkip(20, { decision: "APPROVED" }),
      ).rejects.toBeInstanceOf(ResourceNotFoundException);
    });

    it("blocks the requester from deciding their own skip request", async () => {
      const { service, repository } = makeService({
        skipRequest: { ...PENDING_SKIP, requestedById: USER_ID },
      });

      await expect(
        service.decideSkip(20, { decision: "APPROVED" }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(repository.decideSkipRequest).not.toHaveBeenCalled();
    });

    it("blocks the borrower from deciding a skip on their own loan", async () => {
      const { service, repository } = makeService({
        skipRequest: {
          ...PENDING_SKIP,
          loan: { employee: { userId: USER_ID } },
        },
      });

      await expect(
        service.decideSkip(20, { decision: "REJECTED" }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(repository.decideSkipRequest).not.toHaveBeenCalled();
    });

    it("rejects re-deciding an already decided skip request", async () => {
      const { service, repository } = makeService({
        skipRequest: { ...PENDING_SKIP, status: "REJECTED" },
      });

      const error = await service
        .decideSkip(20, { decision: "APPROVED" })
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(BusinessRuleViolationException);
      expect((error as BusinessRuleViolationException).errorCode).toBe(
        "ALREADY_DECIDED",
      );
      expect(repository.decideSkipRequest).not.toHaveBeenCalled();
    });

    it("rejects deciding a skip request for a finalized period", async () => {
      const { service, repository } = makeService({
        skipRequest: {
          ...PENDING_SKIP,
          payrollPeriod: { status: "FINALIZED" },
        },
      });

      const error = await service
        .decideSkip(20, { decision: "APPROVED" })
        .catch((e: unknown) => e);

      expect((error as BusinessRuleViolationException).errorCode).toBe(
        "PERIOD_FINALIZED",
      );
      expect(repository.decideSkipRequest).not.toHaveBeenCalled();
    });

    it("reports a concurrent decision when the guarded update matches nothing", async () => {
      const { service } = makeService({
        skipRequest: PENDING_SKIP,
        decided: null,
      });

      const error = await service
        .decideSkip(20, { decision: "APPROVED" })
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(BusinessRuleViolationException);
      expect((error as Error).message).toBe(
        "Skip request was decided concurrently",
      );
    });
  });

  describe("self-service", () => {
    it("lists the current employee's loans with the query's pagination", async () => {
      const { service, repository } = makeService();
      const query = Object.assign(new QueryLoanDto(), { page: 2, limit: 5 });

      const result = await service.findMyLoans(query);

      expect(repository.findMine).toHaveBeenCalledWith(SCOPE, 70, query, {
        page: 2,
        limit: 5,
        skip: 5,
      });
      expect(result).toBeInstanceOf(PaginatedResponseDto);
      expect(result.page).toBe(2);
      expect(result.limit).toBe(5);
    });

    it("defaults pagination when no query is given", async () => {
      const { service, repository } = makeService();

      const result = await service.findMyLoans();

      expect(repository.findMine).toHaveBeenCalledWith(
        SCOPE,
        70,
        {},
        { page: 1, limit: 50, skip: 0 },
      );
      expect(result.page).toBe(1);
      expect(result.limit).toBe(50);
    });

    it("returns one of the current employee's loans", async () => {
      const { service, repository } = makeService({ mine: { id: 3 } });

      await expect(service.findMyLoanById(3)).resolves.toEqual({ id: 3 });
      expect(repository.findMineById).toHaveBeenCalledWith(SCOPE, 70, 3);
    });

    it("reports another employee's loan as not found", async () => {
      const { service } = makeService();

      await expect(service.findMyLoanById(3)).rejects.toBeInstanceOf(
        ResourceNotFoundException,
      );
    });
  });
});
