import { ForbiddenException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { PaginatedResponseDto } from "../../../../common/dto/paginated-response.dto.js";
import {
  BusinessRuleViolationException,
  ResourceNotFoundException,
} from "../../../../common/exceptions/business.exception.js";
import { PayrollRunsService } from "./payroll-runs.service.js";

const ORG_SCOPE = { organizationId: 1 };
const USER_ID = 42;
const PERIOD = {
  id: 10,
  status: "DRAFT",
  periodStart: new Date("2026-04-01"),
  periodEnd: new Date("2026-04-30"),
};

function errorCode(err: unknown): unknown {
  return (err as { errorCode?: string }).errorCode;
}

function makeService(opts?: {
  level?: "own" | "team" | "all";
  period?: unknown;
  activeEmployees?: Array<{ id: number }>;
  run?: unknown;
  liveRuns?: Array<{ id: number; entries: Array<{ employeeId: number }> }>;
}) {
  const level = opts?.level ?? "all";
  const teamScope = {
    level,
    userId: USER_ID,
    organizationId: 1,
    teamIds: level === "team" ? [3] : [],
  };
  const repository = {
    createRun: vi.fn().mockResolvedValue({ id: 99, status: "PROCESSED" }),
    findManyRuns: vi.fn().mockResolvedValue({ items: [{ id: 1 }], total: 1 }),
    findRunById: vi
      .fn()
      .mockResolvedValue(
        opts && "run" in opts
          ? opts.run
          : { id: 5, status: "PROCESSED", createdById: 7 },
      ),
    approveRun: vi.fn().mockResolvedValue({ id: 5, status: "APPROVED" }),
    findManyEntries: vi
      .fn()
      .mockResolvedValue({ items: [{ id: 1 }, { id: 2 }], total: 2 }),
    findEntryById: vi.fn().mockResolvedValue({ id: 1 }),
  };
  const calculator = {
    calculateForEmployee: vi
      .fn()
      .mockImplementation((_org: number, _period: number, empId: number) => ({
        employeeId: empId,
        netPayable: 1000,
      })),
  };
  const tenantContext = {
    getOrgScope: vi.fn().mockReturnValue(ORG_SCOPE),
    getUserId: vi.fn().mockReturnValue(USER_ID),
  };
  const teamContext = { resolveScope: vi.fn().mockResolvedValue(teamScope) };
  const prisma = {
    payrollPeriod: {
      findFirst: vi
        .fn()
        .mockResolvedValue(
          opts && "period" in opts ? opts.period : { ...PERIOD },
        ),
    },
    employee: {
      findMany: vi
        .fn()
        .mockResolvedValue(opts?.activeEmployees ?? [{ id: 1 }, { id: 2 }]),
    },
    payrollRun: {
      findMany: vi.fn().mockResolvedValue(opts?.liveRuns ?? []),
    },
  };
  const service = new PayrollRunsService(
    repository as never,
    calculator as never,
    tenantContext as never,
    teamContext as never,
    prisma as never,
  );
  return { service, repository, calculator, teamContext, teamScope, prisma };
}

describe("PayrollRunsService", () => {
  describe("createRun", () => {
    it("calculates every active employee in the period and stores the run", async () => {
      const { service, repository, calculator, prisma, teamContext } =
        makeService();

      const result = await service.createRun({
        payrollPeriodId: 10,
        notes: "April",
      });

      expect(result).toEqual({ id: 99, status: "PROCESSED" });
      expect(teamContext.resolveScope).toHaveBeenCalledWith("hr.payroll.write");
      expect(prisma.payrollPeriod.findFirst).toHaveBeenCalledWith({
        where: { id: 10, organizationId: 1, deletedAt: null },
      });
      expect(prisma.employee.findMany).toHaveBeenCalledWith({
        where: {
          organizationId: 1,
          status: "ACTIVE",
          deletedAt: null,
          dateOfJoining: { lte: PERIOD.periodEnd },
          OR: [
            { dateOfExit: null },
            { dateOfExit: { gte: PERIOD.periodStart } },
          ],
        },
        select: { id: true },
      });
      expect(calculator.calculateForEmployee).toHaveBeenCalledTimes(2);
      expect(calculator.calculateForEmployee).toHaveBeenCalledWith(1, 10, 1);
      expect(calculator.calculateForEmployee).toHaveBeenCalledWith(1, 10, 2);
      expect(repository.createRun).toHaveBeenCalledWith(
        ORG_SCOPE,
        10,
        "April",
        USER_ID,
        [
          { employeeId: 1, netPayable: 1000 },
          { employeeId: 2, netPayable: 1000 },
        ],
        [],
      );
      expect(prisma.payrollRun.findMany).toHaveBeenCalledWith({
        where: {
          organizationId: 1,
          payrollPeriodId: 10,
          status: { in: ["PROCESSED", "APPROVED"] },
        },
        select: {
          id: true,
          entries: {
            where: { deletedAt: null },
            select: { employeeId: true },
          },
        },
      });
    });

    it("recalculates selected employees without dropping the rest of the live run", async () => {
      const { service, repository, calculator, prisma } = makeService({
        liveRuns: [{ id: 30, entries: [{ employeeId: 1 }, { employeeId: 2 }] }],
      });
      prisma.employee.findMany.mockResolvedValueOnce([
        { id: 1 },
        { id: 2 },
        { id: 9 },
      ]);

      await service.createRun({ payrollPeriodId: 10, employeeIds: [9, 2] });

      const [eligibility] = prisma.employee.findMany.mock.calls[0] as [
        { where: { id: unknown } },
      ];
      expect(eligibility.where.id).toEqual({ in: [9, 2, 1] });
      expect(
        calculator.calculateForEmployee.mock.calls.map((c) => c[2]),
      ).toEqual([1, 2, 9]);
      // The repository re-checks under the lock that run 30 is still the
      // period's only live run before superseding it.
      expect(repository.createRun.mock.calls[0]![5]).toEqual([30]);
    });

    it("filters an explicit, de-duplicated employee list to non-INACTIVE employees in the org", async () => {
      const { service, calculator, prisma } = makeService();
      // 5 is INACTIVE — the eligibility query leaves it out.
      prisma.employee.findMany.mockResolvedValueOnce([{ id: 3 }, { id: 4 }]);

      await service.createRun({
        payrollPeriodId: 10,
        employeeIds: [3, 3, 4, 5],
      });

      expect(prisma.employee.findMany).toHaveBeenCalledWith({
        where: {
          id: { in: [3, 4, 5] },
          organizationId: 1,
          status: { not: "INACTIVE" },
          deletedAt: null,
        },
        select: { id: true },
      });
      expect(
        calculator.calculateForEmployee.mock.calls.map((c) => c[2]),
      ).toEqual([3, 4]);
    });

    it("rejects an explicit list that contains only INACTIVE employees", async () => {
      const { service, prisma, repository } = makeService();
      prisma.employee.findMany.mockResolvedValueOnce([]);

      await expect(
        service.createRun({ payrollPeriodId: 10, employeeIds: [5] }),
      ).rejects.toMatchObject({ errorCode: "NO_ELIGIBLE_EMPLOYEES" });
      expect(repository.createRun).not.toHaveBeenCalled();
    });

    it("skips employees the calculator returns null for", async () => {
      const { service, repository, calculator } = makeService();
      calculator.calculateForEmployee
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ employeeId: 2, netPayable: 500 });

      await service.createRun({ payrollPeriodId: 10 });

      expect(repository.createRun.mock.calls[0]![4]).toEqual([
        { employeeId: 2, netPayable: 500 },
      ]);
    });

    it.each(["team", "own"] as const)("refuses a .%s grant", async (level) => {
      const { service, prisma, repository } = makeService({ level });
      await expect(
        service.createRun({ payrollPeriodId: 10 }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.payrollPeriod.findFirst).not.toHaveBeenCalled();
      expect(repository.createRun).not.toHaveBeenCalled();
    });

    it("throws not found for a missing period", async () => {
      const { service } = makeService({ period: null });
      await expect(
        service.createRun({ payrollPeriodId: 10 }),
      ).rejects.toBeInstanceOf(ResourceNotFoundException);
    });

    it.each(["FINALIZED", "CANCELLED"])(
      "rejects a %s period with PAYROLL_FINALIZED",
      async (status) => {
        const { service, repository } = makeService({
          period: { ...PERIOD, status },
        });
        const err = await service
          .createRun({ payrollPeriodId: 10 })
          .catch((e: unknown) => e);
        expect(err).toBeInstanceOf(BusinessRuleViolationException);
        expect(errorCode(err)).toBe("PAYROLL_FINALIZED");
        expect((err as Error).message).toContain(status.toLowerCase());
        expect(repository.createRun).not.toHaveBeenCalled();
      },
    );

    it("rejects when no employees are eligible", async () => {
      const { service, calculator } = makeService({ activeEmployees: [] });
      const err = await service
        .createRun({ payrollPeriodId: 10 })
        .catch((e: unknown) => e);
      expect(errorCode(err)).toBe("NO_ELIGIBLE_EMPLOYEES");
      expect(calculator.calculateForEmployee).not.toHaveBeenCalled();
    });

    it("treats an empty explicit employee list as 'all active employees'", async () => {
      const { service, prisma } = makeService();
      await service.createRun({ payrollPeriodId: 10, employeeIds: [] });
      expect(prisma.employee.findMany).toHaveBeenCalledOnce();
    });

    it("rejects when every calculation comes back empty", async () => {
      const { service, repository, calculator } = makeService();
      calculator.calculateForEmployee.mockResolvedValue(null);
      const err = await service
        .createRun({ payrollPeriodId: 10 })
        .catch((e: unknown) => e);
      expect(errorCode(err)).toBe("CALCULATION_EMPTY");
      expect(repository.createRun).not.toHaveBeenCalled();
    });
  });

  describe("findAllRuns / findRunById", () => {
    it.each(["team", "all"] as const)(
      "lets a .%s grant list run headers",
      async (level) => {
        const { service, repository } = makeService({ level });
        const query = { page: 1, limit: 20 };
        const result = await service.findAllRuns(query as never);
        expect(repository.findManyRuns).toHaveBeenCalledWith(
          ORG_SCOPE,
          query,
          query,
        );
        expect(result).toBeInstanceOf(PaginatedResponseDto);
        expect(result.items).toEqual([{ id: 1 }]);
        expect(result.total).toBe(1);
      },
    );

    it("refuses an .own grant from listing runs", async () => {
      const { service, repository } = makeService({ level: "own" });
      await expect(
        service.findAllRuns({ page: 1, limit: 20 } as never),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(repository.findManyRuns).not.toHaveBeenCalled();
    });

    it("returns a run by id", async () => {
      const { service, repository } = makeService();
      await expect(service.findRunById(5)).resolves.toMatchObject({ id: 5 });
      expect(repository.findRunById).toHaveBeenCalledWith(ORG_SCOPE, 5);
    });

    it("throws not found for a missing run", async () => {
      const { service } = makeService({ run: null });
      await expect(service.findRunById(5)).rejects.toBeInstanceOf(
        ResourceNotFoundException,
      );
    });

    it("refuses an .own grant from reading a run", async () => {
      const { service } = makeService({ level: "own" });
      await expect(service.findRunById(5)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });
  });

  describe("approveRun", () => {
    it("approves a PROCESSED run created by someone else", async () => {
      const { service, repository, teamContext } = makeService();
      const result = await service.approveRun(5, { notes: "ok" });
      expect(teamContext.resolveScope).toHaveBeenCalledWith(
        "hr.payroll.approve",
      );
      expect(repository.approveRun).toHaveBeenCalledWith(
        ORG_SCOPE,
        5,
        USER_ID,
        "ok",
      );
      expect(result).toEqual({ id: 5, status: "APPROVED" });
    });

    it("refuses a .team grant", async () => {
      const { service, repository } = makeService({ level: "team" });
      await expect(service.approveRun(5, {})).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(repository.findRunById).not.toHaveBeenCalled();
    });

    it("throws not found for a missing run", async () => {
      const { service } = makeService({ run: null });
      await expect(service.approveRun(5, {})).rejects.toBeInstanceOf(
        ResourceNotFoundException,
      );
    });

    it("blocks the run's creator from approving it (maker-checker)", async () => {
      const { service, repository } = makeService({
        run: { id: 5, status: "PROCESSED", createdById: USER_ID },
      });
      await expect(service.approveRun(5, {})).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(repository.approveRun).not.toHaveBeenCalled();
    });

    it("rejects an already-approved run", async () => {
      const { service } = makeService({
        run: { id: 5, status: "APPROVED", createdById: 7 },
      });
      const err = await service.approveRun(5, {}).catch((e: unknown) => e);
      expect(errorCode(err)).toBe("RUN_ALREADY_APPROVED");
    });

    it.each(["CANCELLED", "DRAFT"])(
      "rejects approving a %s run",
      async (status) => {
        const { service, repository } = makeService({
          run: { id: 5, status, createdById: 7 },
        });
        const err = await service.approveRun(5, {}).catch((e: unknown) => e);
        expect(errorCode(err)).toBe("INVALID_STATE_TRANSITION");
        expect(repository.approveRun).not.toHaveBeenCalled();
      },
    );
  });

  describe("entries", () => {
    it("lists entries with the caller's team scope", async () => {
      const { service, repository, teamScope } = makeService({ level: "team" });
      const query = { page: 1, limit: 50, payrollRunId: 5 };
      const result = await service.findAllEntries(query as never);
      expect(repository.findManyEntries).toHaveBeenCalledWith(
        teamScope,
        query,
        query,
      );
      expect(result.total).toBe(2);
      expect(result.items).toHaveLength(2);
    });

    it("returns an entry within scope", async () => {
      const { service, repository, teamScope } = makeService({ level: "own" });
      await expect(service.findEntryById(1)).resolves.toEqual({ id: 1 });
      expect(repository.findEntryById).toHaveBeenCalledWith(teamScope, 1);
    });

    it("throws not found for an entry outside scope", async () => {
      const { service, repository } = makeService();
      repository.findEntryById.mockResolvedValue(null);
      await expect(service.findEntryById(1)).rejects.toBeInstanceOf(
        ResourceNotFoundException,
      );
    });
  });
});
