import { ResourceNotFoundException } from "../../../common/exceptions/business.exception.js";
import { ActionItemsService } from "./action-items.service.js";

const scope = { organizationId: 1 };

function makeService() {
  const repository = {
    findMany: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    create: vi.fn().mockResolvedValue({ id: 1 }),
    setDone: vi.fn(),
    softDelete: vi.fn(),
    countOpen: vi.fn(),
  };
  const tenantContext = {
    getOrgScope: vi.fn().mockReturnValue(scope),
    getUserId: vi.fn().mockReturnValue(42),
  };
  return {
    service: new ActionItemsService(
      repository as never,
      tenantContext as never,
    ),
    repository,
  };
}

describe("ActionItemsService", () => {
  it("lists open items by default", async () => {
    const { service, repository } = makeService();
    await service.findAll({ page: 1, limit: 20, skip: 0 } as never);
    expect(repository.findMany).toHaveBeenCalledWith(
      scope,
      "open",
      expect.anything(),
    );
  });

  it("parses the due date as a calendar date", async () => {
    const { service, repository } = makeService();
    await service.create({ title: "Call client", dueDate: "2026-10-20" });
    await service.create({ title: "No date" });
    const [, first] = repository.create.mock.calls[0] as [
      unknown,
      { dueDate: Date },
    ];
    const [, second] = repository.create.mock.calls[1] as [
      unknown,
      { dueDate: Date | null },
    ];
    expect(first.dueDate.toISOString()).toBe("2026-10-20T00:00:00.000Z");
    expect(second.dueDate).toBeNull();
  });

  it("404s when completing or deleting an item outside the organization", async () => {
    const { service, repository } = makeService();
    repository.setDone.mockResolvedValue(null);
    repository.softDelete.mockResolvedValue(false);
    await expect(service.setDone(5, true)).rejects.toBeInstanceOf(
      ResourceNotFoundException,
    );
    await expect(service.remove(5)).rejects.toBeInstanceOf(
      ResourceNotFoundException,
    );
  });

  it("passes the actor when completing", async () => {
    const { service, repository } = makeService();
    repository.setDone.mockResolvedValue({ id: 5 });
    await service.setDone(5, true);
    expect(repository.setDone).toHaveBeenCalledWith(scope, 5, true, 42);
  });
});
