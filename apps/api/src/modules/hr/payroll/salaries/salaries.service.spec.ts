import { describe, expect, it, vi } from "vitest";
import { PaginatedResponseDto } from "../../../../common/dto/paginated-response.dto.js";
import {
  BusinessRuleConflictException,
  BusinessRuleViolationException,
  ResourceNotFoundException,
} from "../../../../common/exceptions/business.exception.js";
import { SalariesService } from "./salaries.service.js";

const ORG_SCOPE = { organizationId: 1 };
const USER_ID = 42;

/** Component master: id = position + 1. */
const MASTER = [
  "BASIC",
  "DA",
  "HRA",
  "CONVEYANCE",
  "OTHER_ALLOWANCE",
  "SPECIAL_ALLOWANCE",
  "CANTEEN",
].map((code, i) => ({
  id: i + 1,
  code,
  kind: code === "CANTEEN" ? "DEDUCTION" : "EARNING",
  isActive: true,
}));

const line = (code: string, monthlyAmount: number) => ({
  monthlyAmount: String(monthlyAmount),
  component: { code },
});

const CURRENT = {
  id: 20,
  employeeId: 7,
  employee: { id: 7, teamId: 3, userId: 70 },
  effectiveFrom: new Date("2026-04-01T00:00:00.000Z"),
  effectiveTo: null as Date | null,
  components: [
    line("BASIC", 20000),
    line("HRA", 8000),
    line("CONVEYANCE", 1600),
  ],
};

function errorCode(err: unknown): unknown {
  return (err as { errorCode?: string }).errorCode;
}

function makeService(opts?: {
  level?: "own" | "team" | "all";
  clash?: unknown;
  current?: unknown;
  finalized?: unknown[];
  letter?: unknown;
}) {
  const teamScope = {
    level: opts?.level ?? "all",
    userId: USER_ID,
    organizationId: 1,
    teamIds: [3],
  };
  const repository = {
    findOverlapping: vi.fn().mockResolvedValue(opts?.clash ?? null),
    findRevisionLetter: vi
      .fn()
      .mockResolvedValue(opts && "letter" in opts ? opts.letter : { id: 5 }),
    create: vi.fn().mockResolvedValue({ id: 1 }),
    findMany: vi.fn().mockResolvedValue({ items: [{ id: 1 }], total: 1 }),
    findById: vi
      .fn()
      .mockResolvedValue(
        opts && "current" in opts ? opts.current : { ...CURRENT },
      ),
    findApplicableOn: vi.fn().mockResolvedValue({ id: 20 }),
    update: vi.fn().mockResolvedValue({ id: 20 }),
    findFinalizedPeriodsOverlapping: vi
      .fn()
      .mockResolvedValue(opts?.finalized ?? []),
  };
  const settings = {
    rules: vi.fn().mockResolvedValue({
      basicPercent: 35,
      hraPercent: 30,
      conveyancePercent: 20,
    }),
  };
  const components = {
    resolveComponents: vi.fn(
      (refs: Array<{ componentId?: number; code?: string }>) =>
        Promise.resolve(
          refs.map((r) => {
            const c = MASTER.find(
              (m) => m.id === r.componentId || m.code === r.code,
            );
            if (!c) {
              throw new BusinessRuleViolationException(
                "unknown",
                "SALARY_COMPONENT_UNKNOWN",
              );
            }
            return c;
          }),
        ),
    ),
    applyTemplate: vi.fn().mockResolvedValue([
      { componentId: 1, code: "BASIC", kind: "EARNING", monthlyAmount: 30000 },
      { componentId: 3, code: "HRA", kind: "EARNING", monthlyAmount: 20000 },
    ]),
  };
  const tenantContext = {
    getOrgScope: vi.fn().mockReturnValue(ORG_SCOPE),
    getUserId: vi.fn().mockReturnValue(USER_ID),
  };
  const teamContext = { resolveScope: vi.fn().mockResolvedValue(teamScope) };
  const service = new SalariesService(
    repository as never,
    tenantContext as never,
    teamContext as never,
    settings as never,
    components as never,
  );
  return { service, repository, teamScope, components };
}

const lines = (repository: { create: ReturnType<typeof vi.fn> }) =>
  (repository.create.mock.calls[0] as unknown[])[2] as Array<{
    code: string;
    monthlyAmount: number;
  }>;

describe("SalariesService", () => {
  describe("create", () => {
    const base = { employeeId: 7, effectiveFrom: "2026-05-01" };

    it("stores explicit component lines; the gross is their earnings", async () => {
      const { service, repository, teamScope } = makeService();
      await service.create({
        ...base,
        components: [
          { code: "BASIC", monthlyAmount: 30000 },
          { code: "DA", monthlyAmount: 5000 },
          { componentId: 7, monthlyAmount: 200 },
        ],
      });
      // The repository re-checks the write scope with the resolved TeamScope.
      expect(repository.create.mock.calls[0]?.[0]).toBe(teamScope);
      expect(lines(repository).map((l) => [l.code, l.monthlyAmount])).toEqual([
        ["BASIC", 30000],
        ["DA", 5000],
        ["CANTEEN", 200],
      ]);
    });

    it("refuses a gross that does not match the earning lines", async () => {
      const { service } = makeService();
      const err = await service
        .create({
          ...base,
          grossMonthly: 40000,
          components: [{ code: "BASIC", monthlyAmount: 30000 }],
        })
        .catch((e: unknown) => e);
      expect(errorCode(err)).toBe("SALARY_GROSS_MISMATCH");
    });

    it("builds the lines from a template and its gross", async () => {
      const { service, repository, components } = makeService();
      await service.create({
        ...base,
        salaryTemplateId: 3,
        grossMonthly: 50000,
      });
      expect(components.applyTemplate).toHaveBeenCalledWith(3, 50000);
      expect(lines(repository)).toHaveLength(2);
      expect(
        (repository.create.mock.calls[0]?.[1] as { salaryTemplateId: number })
          .salaryTemplateId,
      ).toBe(3);
    });

    it("maps the legacy basic/hra fields onto system components", async () => {
      const { service, repository } = makeService();
      await service.create({
        ...base,
        basic: 25000,
        hra: 15000,
        conveyance: 2000,
        specialAllowance: 5000,
      });
      expect(lines(repository).map((l) => l.code)).toEqual([
        "BASIC",
        "HRA",
        "CONVEYANCE",
        "SPECIAL_ALLOWANCE",
      ]);
    });

    it("splits a gross-only request by the payroll settings; special allowance stays on top", async () => {
      const { service, repository } = makeService();
      await service.create({
        ...base,
        grossMonthly: 50000,
        specialAllowance: 10000,
      });
      // 40000 split 35/30/20/remainder
      expect(lines(repository).map((l) => [l.code, l.monthlyAmount])).toEqual([
        ["BASIC", 14000],
        ["HRA", 12000],
        ["CONVEYANCE", 8000],
        ["OTHER_ALLOWANCE", 6000],
        ["SPECIAL_ALLOWANCE", 10000],
      ]);
    });

    it("rejects basic without hra", async () => {
      const { service } = makeService();
      const err = await service
        .create({ ...base, basic: 1000 })
        .catch((e: unknown) => e);
      expect(errorCode(err)).toBe("SALARY_COMPONENTS_INCOMPLETE");
    });

    it("rejects an overlapping structure", async () => {
      const { service } = makeService({ clash: { id: 9 } });
      await expect(
        service.create({ ...base, grossMonthly: 10000 }),
      ).rejects.toBeInstanceOf(BusinessRuleConflictException);
    });

    it("rejects a revision letter of another employee", async () => {
      const { service } = makeService({ letter: null });
      const err = await service
        .create({ ...base, grossMonthly: 10000, revisionLetterId: 99 })
        .catch((e: unknown) => e);
      expect(errorCode(err)).toBe("REVISION_LETTER_MISMATCH");
    });

    it("rejects an end date before the start", async () => {
      const { service } = makeService();
      await expect(
        service.create({
          ...base,
          effectiveTo: "2026-04-01",
          grossMonthly: 10000,
        }),
      ).rejects.toBeInstanceOf(BusinessRuleViolationException);
    });
  });

  describe("update", () => {
    it("changes one legacy amount on top of the current lines", async () => {
      const { service, repository } = makeService();
      await service.update(20, { hra: 9000 });
      const newLines = repository.update.mock.calls[0]?.[3] as Array<{
        code: string;
        monthlyAmount: number;
      }>;
      expect(newLines.map((l) => [l.code, l.monthlyAmount])).toEqual([
        ["BASIC", 20000],
        ["HRA", 9000],
        ["CONVEYANCE", 1600],
      ]);
    });

    it("leaves the lines untouched when no amount changes", async () => {
      const { service, repository } = makeService();
      await service.update(20, { arrearsSalary: 500 });
      expect(repository.update.mock.calls[0]?.[3]).toBeUndefined();
    });

    it("hides a structure outside the caller's write scope as not found", async () => {
      const { service } = makeService({ current: null });
      await expect(service.update(20, { hra: 1 })).rejects.toBeInstanceOf(
        ResourceNotFoundException,
      );
    });

    it("refuses changing recurring amounts once a covered period is finalized", async () => {
      const { service } = makeService({
        finalized: [
          {
            year: 2026,
            month: 4,
            periodEnd: new Date("2026-04-30T00:00:00.000Z"),
          },
        ],
      });
      const err = await service
        .update(20, { components: [{ code: "BASIC", monthlyAmount: 1 }] })
        .catch((e: unknown) => e);
      expect(errorCode(err)).toBe("SALARY_LOCKED_BY_FINALIZED_PAYROLL");
    });
  });

  it("lists within the read scope", async () => {
    const { service } = makeService();
    const res = await service.findAll({ page: 1, limit: 10, skip: 0 } as never);
    expect(res).toBeInstanceOf(PaginatedResponseDto);
  });
});
