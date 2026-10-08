import {
  BusinessRuleViolationException,
  ResourceNotFoundException,
} from "../../../common/exceptions/business.exception.js";
import {
  ExpenseClaimDecisionScopeException,
  ExpenseClaimsService,
} from "./expense-claims.service.js";

const ORG = { organizationId: 1 };

function makeService(decideLevel: "own" | "team" | "all" = "all") {
  const repository = {
    findMany: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    findOne: vi.fn(),
    findMine: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    findMineOne: vi.fn(),
    create: vi.fn().mockResolvedValue({ id: 1 }),
    decide: vi.fn(),
  };
  const tenantContext = {
    getOrgScope: vi.fn().mockReturnValue(ORG),
    getUserId: vi.fn().mockReturnValue(42),
  };
  const teamContext = {
    resolveScope: vi.fn(async (prefix: string) => ({
      level: prefix === "hr.expense_claim.decide" ? decideLevel : "all",
      userId: 42,
      organizationId: 1,
      teamIds: [],
    })),
  };
  const employees = {
    getCurrentEmployee: vi.fn().mockResolvedValue({ id: 77 }),
    findCurrentEmployeeOrNull: vi.fn().mockResolvedValue({ id: 77 }),
  };
  const service = new ExpenseClaimsService(
    repository as never,
    tenantContext as never,
    teamContext as never,
    employees as never,
  );
  return { service, repository, teamContext, employees };
}

const validClaim = {
  expenseType: "Travel" as const,
  amount: 1250.5,
  expenseDate: "2020-01-15",
  description: "Cab to client site",
};

describe("ExpenseClaimsService", () => {
  it("findAll() resolves the hr.expense_claim.read scope", async () => {
    const { service, repository, teamContext } = makeService();
    await service.findAll({ page: 1, limit: 20 } as never);
    expect(teamContext.resolveScope).toHaveBeenCalledWith(
      "hr.expense_claim.read",
    );
    expect(repository.findMany).toHaveBeenCalled();
  });

  it("findOne() maps an out-of-scope claim to 404, never 403", async () => {
    const { service, repository } = makeService();
    repository.findOne.mockResolvedValue(null);
    await expect(service.findOne(9)).rejects.toBeInstanceOf(
      ResourceNotFoundException,
    );
  });

  it("decide() refuses an own-level holder before reading any claim", async () => {
    const { service, repository } = makeService("own");
    await expect(
      service.decide(5, { decision: "APPROVED" } as never),
    ).rejects.toBeInstanceOf(ExpenseClaimDecisionScopeException);
    expect(repository.decide).not.toHaveBeenCalled();
  });

  it("decide() passes the approver's employee id and the decision to the repository", async () => {
    const { service, repository, teamContext } = makeService("team");
    repository.decide.mockResolvedValue({ id: 5, status: "REJECTED" });
    await service.decide(5, { decision: "REJECTED", note: "Missing bill" });
    expect(teamContext.resolveScope).toHaveBeenCalledWith(
      "hr.expense_claim.decide",
    );
    expect(repository.decide).toHaveBeenCalledWith(
      expect.objectContaining({ level: "team" }),
      5,
      77,
      { status: "REJECTED", note: "Missing bill" },
      42,
    );
  });

  it("decide() maps a claim outside the decision scope to 404", async () => {
    const { service, repository } = makeService("team");
    repository.decide.mockResolvedValue(null);
    await expect(
      service.decide(5, { decision: "APPROVED" } as never),
    ).rejects.toBeInstanceOf(ResourceNotFoundException);
  });

  it("decide() passes a null approver id (not a 403) for a caller with no linked employee", async () => {
    const { service, repository, employees } = makeService("team");
    employees.findCurrentEmployeeOrNull.mockResolvedValue(null);
    repository.decide.mockResolvedValue({ id: 5, status: "REJECTED" });
    await service.decide(5, { decision: "REJECTED", note: "Missing bill" });
    expect(repository.decide).toHaveBeenCalledWith(
      expect.objectContaining({ level: "team" }),
      5,
      null,
      { status: "REJECTED", note: "Missing bill" },
      42,
    );
  });

  it("createForCurrentEmployee() takes the employee from the JWT, never the client", async () => {
    const { service, repository } = makeService();
    await service.createForCurrentEmployee({
      ...validClaim,
      employeeId: 999,
    } as never);
    expect(repository.create).toHaveBeenCalledWith(
      ORG,
      expect.objectContaining({ employeeId: 77 }),
      42,
    );
  });

  it("createForCurrentEmployee() refuses a future expense date", async () => {
    const { service, repository } = makeService();
    const tomorrow = new Date(Date.now() + 2 * 86_400_000)
      .toISOString()
      .slice(0, 10);
    await expect(
      service.createForCurrentEmployee({
        ...validClaim,
        expenseDate: tomorrow,
      }),
    ).rejects.toBeInstanceOf(BusinessRuleViolationException);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("findMineOne() maps another employee's claim to 404", async () => {
    const { service, repository } = makeService();
    repository.findMineOne.mockResolvedValue(null);
    await expect(service.findMineOne(9)).rejects.toBeInstanceOf(
      ResourceNotFoundException,
    );
    expect(repository.findMineOne).toHaveBeenCalledWith(ORG, 77, 9);
  });
});
