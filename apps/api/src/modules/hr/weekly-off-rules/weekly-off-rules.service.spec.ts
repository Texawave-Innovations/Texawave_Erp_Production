import { ResourceNotFoundException } from "../../../common/exceptions/business.exception.js";
import { WeeklyOffRulesService } from "./weekly-off-rules.service.js";

const SCOPE = { organizationId: 1 };

function makeService() {
  const repository = {
    findMany: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    findOne: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    end: vi.fn(),
    voidOne: vi.fn(),
  };
  const tenantContext = {
    getOrgScope: vi.fn().mockReturnValue(SCOPE),
    getUserId: vi.fn().mockReturnValue(42),
  };
  const service = new WeeklyOffRulesService(
    repository as never,
    tenantContext as never,
  );
  return { service, repository };
}

describe("WeeklyOffRulesService", () => {
  it("findAll() queries within the caller's organization scope", async () => {
    const { service, repository } = makeService();
    await service.findAll({ page: 1, limit: 20, teamId: 3 } as never);
    expect(repository.findMany).toHaveBeenCalledWith(
      SCOPE,
      expect.objectContaining({ teamId: 3 }),
      expect.anything(),
    );
  });

  it("findOne() throws not-found when the row is absent", async () => {
    const { service, repository } = makeService();
    repository.findOne.mockResolvedValue(null);
    await expect(service.findOne(9)).rejects.toBeInstanceOf(
      ResourceNotFoundException,
    );
  });

  it("create() passes the caller's scope and user id as actor", async () => {
    const { service, repository } = makeService();
    const dto = { scope: "ORGANIZATION" };
    await service.create(dto as never);
    expect(repository.create).toHaveBeenCalledWith(SCOPE, dto, 42);
  });

  it("void() hands only the reason to the repository", async () => {
    const { service, repository } = makeService();
    repository.voidOne.mockResolvedValue({ id: 5 });
    await service.void(5, { reason: "entered in error" });
    expect(repository.voidOne).toHaveBeenCalledWith(
      SCOPE,
      5,
      "entered in error",
      42,
    );
  });

  it("update(), end() and void() throw not-found when the repository returns null", async () => {
    const { service, repository } = makeService();
    repository.update.mockResolvedValue(null);
    repository.end.mockResolvedValue(null);
    repository.voidOne.mockResolvedValue(null);
    await expect(service.update(9, {} as never)).rejects.toBeInstanceOf(
      ResourceNotFoundException,
    );
    await expect(service.end(9, {} as never)).rejects.toBeInstanceOf(
      ResourceNotFoundException,
    );
    await expect(service.void(9, { reason: "x" })).rejects.toBeInstanceOf(
      ResourceNotFoundException,
    );
  });
});
