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

function errorCode(err: unknown): unknown {
  return (err as { errorCode?: string }).errorCode;
}

function makeService(overrides?: {
  level?: "own" | "team" | "all";
  employee?: unknown;
  gross?: number | null;
  otherEmis?: number;
  loan?: unknown;
  period?: unknown;
  existingSkip?: unknown;
  skipRequest?: unknown;
  prepayment?: unknown;
}) {
  const repository = {
    create: vi.fn().mockResolvedValue({ id: 1, status: "PENDING_APPROVAL" }),
    grossOn: vi
      .fn()
      .mockResolvedValue(
        overrides && "gross" in overrides ? overrides.gross : 20000,
      ),
    otherEmis: vi.fn().mockResolvedValue(overrides?.otherEmis ?? 0),
    findMany: vi.fn().mockResolvedValue({ items: [{ id: 1 }], total: 1 }),
    findById: vi
      .fn()
      .mockResolvedValue(
        overrides && "loan" in overrides
          ? overrides.loan
          : { id: 1, status: "ACTIVE", repayments: [] },
      ),
    decide: vi.fn().mockResolvedValue({ id: 1, status: "ACTIVE" }),
    createSkipRequest: vi.fn().mockResolvedValue({ id: 20, status: "PENDING" }),
    findSkipRequestById: vi
      .fn()
      .mockResolvedValue(overrides?.skipRequest ?? null),
    decideSkipRequest: vi
      .fn()
      .mockResolvedValue({ id: 20, status: "APPROVED" }),
    createPrepayment: vi.fn().mockResolvedValue({ id: 30, status: "PENDING" }),
    findPrepaymentById: vi
      .fn()
      .mockResolvedValue(overrides?.prepayment ?? null),
    decidePrepayment: vi.fn().mockResolvedValue({ id: 1, status: "CLOSED" }),
    findMine: vi.fn().mockResolvedValue({ items: [{ id: 1 }], total: 1 }),
    findMineById: vi.fn().mockResolvedValue(null),
  };
  const teamScope = {
    level: overrides?.level ?? "all",
    userId: USER_ID,
    organizationId: 1,
    teamIds: [3],
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
  const service = new LoansService(
    repository as never,
    {
      getOrgScope: vi.fn().mockReturnValue(SCOPE),
      getUserId: vi.fn().mockReturnValue(USER_ID),
    } as never,
    { resolveScope: vi.fn().mockResolvedValue(teamScope) } as never,
    prisma as never,
    { getCurrentEmployee: vi.fn().mockResolvedValue({ id: 70 }) } as never,
    {
      rules: vi
        .fn()
        .mockResolvedValue({ loanMaxMultiple: 3, loanMaxEmiPercent: 50 }),
    } as never,
  );
  return { service, repository, teamScope };
}

const CREATE_DTO: CreateLoanDto = {
  employeeId: 7,
  principalAmount: 10000,
  emiAmount: 1000,
  emiMonths: 10,
  disbursedDate: "2026-04-15",
};

const PENDING_LOAN = {
  id: 1,
  status: "PENDING_APPROVAL",
  createdBy: 11,
  limitOverride: false,
  employee: { userId: 70 },
};

describe("LoansService", () => {
  describe("create", () => {
    it("records a loan request awaiting approval with the parsed UTC date", async () => {
      const { service, repository, teamScope } = makeService();
      await service.create(CREATE_DTO);
      expect(repository.create).toHaveBeenCalledWith(
        teamScope,
        CREATE_DTO,
        new Date("2026-04-15T00:00:00.000Z"),
        false,
        USER_ID,
      );
    });

    it("hides an employee outside the caller's write scope as not found", async () => {
      const { service, repository } = makeService({ employee: null });
      await expect(service.create(CREATE_DTO)).rejects.toBeInstanceOf(
        ResourceNotFoundException,
      );
      expect(repository.create).not.toHaveBeenCalled();
    });

    it("never lets an .own grant record a loan", async () => {
      const { service } = makeService({ level: "own" });
      await expect(service.create(CREATE_DTO)).rejects.toBeInstanceOf(
        ResourceNotFoundException,
      );
    });

    it("rejects an EMI schedule that does not cover the principal", async () => {
      const { service } = makeService();
      const err = await service
        .create({ ...CREATE_DTO, emiAmount: 500 })
        .catch((e: unknown) => e);
      expect(errorCode(err)).toBe("LOAN_SCHEDULE_INVALID");
    });

    it("needs a salary to apply the limits", async () => {
      const { service } = makeService({ gross: null });
      const err = await service.create(CREATE_DTO).catch((e: unknown) => e);
      expect(errorCode(err)).toBe("SALARY_NOT_CONFIGURED");
    });

    it("refuses a principal above 3 × gross without an override reason", async () => {
      const { service } = makeService();
      const err = await service
        .create({ ...CREATE_DTO, principalAmount: 70000, emiAmount: 7000 })
        .catch((e: unknown) => e);
      expect(errorCode(err)).toBe("LOAN_OVER_LIMIT");
    });

    it("accepts it with an override reason and flags it", async () => {
      const { service, repository } = makeService();
      await service.create({
        ...CREATE_DTO,
        principalAmount: 70000,
        emiAmount: 7000,
        overrideReason: "Medical emergency in family",
      });
      expect(repository.create.mock.calls[0]?.[3]).toBe(true);
    });

    it("refuses EMIs above the EMI limit (never overridable)", async () => {
      const { service } = makeService({ otherEmis: 9500 });
      const err = await service
        .create({ ...CREATE_DTO, overrideReason: "Not enough to override" })
        .catch((e: unknown) => e);
      expect(errorCode(err)).toBe("LOAN_EMI_OVER_LIMIT");
    });
  });

  describe("decide", () => {
    it("approves a pending loan raised by someone else", async () => {
      const { service, repository } = makeService({ loan: PENDING_LOAN });
      await service.decide(1, { decision: "APPROVED" });
      expect(repository.decide).toHaveBeenCalled();
    });

    it("refuses the person who recorded it (maker-checker)", async () => {
      const { service } = makeService({
        loan: { ...PENDING_LOAN, createdBy: USER_ID },
      });
      await expect(
        service.decide(1, { decision: "APPROVED" }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it("refuses the borrower", async () => {
      const { service } = makeService({
        loan: { ...PENDING_LOAN, employee: { userId: USER_ID } },
      });
      await expect(
        service.decide(1, { decision: "APPROVED" }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it("needs an organization-wide approver for an over-limit loan", async () => {
      const { service } = makeService({
        level: "team",
        loan: { ...PENDING_LOAN, limitOverride: true },
      });
      await expect(
        service.decide(1, { decision: "APPROVED" }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it("needs a note to reject", async () => {
      const { service } = makeService({ loan: PENDING_LOAN });
      const err = await service
        .decide(1, { decision: "REJECTED" })
        .catch((e: unknown) => e);
      expect(errorCode(err)).toBe("DECISION_NOTE_REQUIRED");
    });

    it("refuses a loan already decided", async () => {
      const { service } = makeService({
        loan: { ...PENDING_LOAN, status: "ACTIVE" },
      });
      await expect(
        service.decide(1, { decision: "APPROVED" }),
      ).rejects.toBeInstanceOf(BusinessRuleViolationException);
    });
  });

  describe("skip requests", () => {
    it("creates a skip request for an active loan and open period", async () => {
      const { service, repository } = makeService();
      await service.requestSkip(1, { payrollPeriodId: 5, reason: "Festival" });
      expect(repository.createSkipRequest).toHaveBeenCalled();
    });

    it("refuses a duplicate skip request", async () => {
      const { service } = makeService({ existingSkip: { id: 1 } });
      await expect(
        service.requestSkip(1, { payrollPeriodId: 5, reason: "x" }),
      ).rejects.toBeInstanceOf(ResourceConflictException);
    });

    it("approves a pending skip request raised by someone else", async () => {
      const { service, repository } = makeService({
        skipRequest: {
          id: 20,
          status: "PENDING",
          requestedById: 11,
          loan: { employee: { userId: 70 } },
          payrollPeriod: { status: "DRAFT" },
        },
      });
      await service.decideSkip(20, { decision: "APPROVED" });
      expect(repository.decideSkipRequest).toHaveBeenCalled();
    });
  });

  describe("prepayments", () => {
    const ACTIVE = {
      id: 1,
      status: "ACTIVE",
      repayments: [
        { status: "PENDING", deletedAt: null, amount: "1000" },
        { status: "PENDING", deletedAt: null, amount: "1000" },
      ],
    };

    it("records a prepayment within the outstanding balance", async () => {
      const { service, repository } = makeService({ loan: ACTIVE });
      await service.requestPrepayment(1, {
        amount: 1500,
        receivedOn: "2026-05-02",
        reason: "Bonus received",
      });
      expect(repository.createPrepayment).toHaveBeenCalled();
    });

    it("refuses more than is outstanding", async () => {
      const { service } = makeService({ loan: ACTIVE });
      const err = await service
        .requestPrepayment(1, {
          amount: 2500,
          receivedOn: "2026-05-02",
          reason: "Too much",
        })
        .catch((e: unknown) => e);
      expect(errorCode(err)).toBe("LOAN_PREPAYMENT_EXCEEDS_BALANCE");
    });

    it("refuses the requester deciding their own prepayment", async () => {
      const { service } = makeService({
        prepayment: {
          id: 30,
          status: "PENDING",
          requestedById: USER_ID,
          loan: { employee: { userId: 70 } },
        },
      });
      await expect(
        service.decidePrepayment(30, { decision: "APPROVED" }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  it("lists loans within the read scope", async () => {
    const { service } = makeService();
    const res = await service.findAll(
      Object.assign(new QueryLoanDto(), { page: 1, limit: 10 }),
    );
    expect(res).toBeInstanceOf(PaginatedResponseDto);
  });
});
