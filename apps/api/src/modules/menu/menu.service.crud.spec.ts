import { describe, expect, it, vi } from "vitest";
import { PaginatedResponseDto } from "../../common/dto/paginated-response.dto.js";
import {
  ResourceConflictException,
  ResourceNotFoundException,
} from "../../common/exceptions/business.exception.js";
import { QueryMenuItemDto } from "./dto/query-menu-item.dto.js";
import { MenuService } from "./menu.service.js";

const SCOPE = { organizationId: 1 };
const USER_ID = 42;

function makeService() {
  const repository = {
    findActiveItems: vi.fn(),
    findMany: vi.fn(),
    findOne: vi.fn(),
    findByCode: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    softDelete: vi.fn(),
  };
  const tenantContext = {
    getOrgScope: vi.fn().mockReturnValue(SCOPE),
    getUserId: vi.fn().mockReturnValue(USER_ID),
  };
  const permissions = {
    getPermissionsForUser: vi.fn().mockResolvedValue([]),
  };

  const service = new MenuService(
    repository as never,
    tenantContext as never,
    permissions as never,
  );

  return { service, repository, permissions };
}

function item(
  id: number,
  overrides: Partial<{
    code: string;
    order: number;
    parentId: number | null;
    permission: string | null;
  }> = {},
) {
  return {
    id,
    code: overrides.code ?? `item-${id}`,
    label: `Item ${id}`,
    path: `/item-${id}`,
    icon: null,
    order: overrides.order ?? 0,
    parentId: overrides.parentId ?? null,
    permission: overrides.permission ?? null,
  };
}

describe("MenuService.getMyMenu() edge cases", () => {
  it("returns an empty menu for a missing user id without resolving permissions", async () => {
    const { service, repository, permissions } = makeService();

    await expect(service.getMyMenu(0)).resolves.toEqual([]);
    await expect(service.getMyMenu("42" as unknown as number)).resolves.toEqual(
      [],
    );
    expect(permissions.getPermissionsForUser).not.toHaveBeenCalled();
    expect(repository.findActiveItems).not.toHaveBeenCalled();
  });

  it("loads menu items for the caller's org and the given user's permissions", async () => {
    const { service, repository, permissions } = makeService();
    repository.findActiveItems.mockResolvedValue([]);

    await service.getMyMenu(USER_ID);

    expect(permissions.getPermissionsForUser).toHaveBeenCalledWith(USER_ID);
    expect(repository.findActiveItems).toHaveBeenCalledWith(SCOPE);
  });

  it("sorts roots and children by order regardless of repository order", async () => {
    const { service, repository } = makeService();
    repository.findActiveItems.mockResolvedValue([
      item(1, { code: "b-root", order: 2 }),
      item(2, { code: "a-root", order: 1 }),
      item(3, { code: "child-late", order: 5, parentId: 1 }),
      item(4, { code: "child-early", order: 1, parentId: 1 }),
    ]);

    const menu = await service.getMyMenu(USER_ID);

    expect(menu.map((n) => n.code)).toEqual(["a-root", "b-root"]);
    expect(menu[1]?.children.map((n) => n.code)).toEqual([
      "child-early",
      "child-late",
    ]);
    expect(menu[0]?.children).toEqual([]);
  });

  it("drops a permitted child whose parent the user cannot see, rather than promoting it to a root", async () => {
    const { service, repository, permissions } = makeService();
    permissions.getPermissionsForUser.mockResolvedValue(["hr.child.read"]);
    repository.findActiveItems.mockResolvedValue([
      item(1, { code: "secret-parent", permission: "hr.parent.read" }),
      item(2, {
        code: "visible-child",
        parentId: 1,
        permission: "hr.child.read",
      }),
    ]);

    await expect(service.getMyMenu(USER_ID)).resolves.toEqual([]);
  });

  it("maps every repository field onto the tree node", async () => {
    const { service, repository } = makeService();
    repository.findActiveItems.mockResolvedValue([
      { ...item(7, { code: "dash", order: 3 }), icon: "home" },
    ]);

    const [node] = await service.getMyMenu(USER_ID);

    expect(node).toEqual({
      id: 7,
      code: "dash",
      label: "Item 7",
      path: "/item-7",
      icon: "home",
      order: 3,
      parentId: null,
      permission: null,
      children: [],
    });
  });
});

describe("MenuService CRUD", () => {
  it("findAll() passes scope, search and pagination through and returns a PaginatedResponseDto", async () => {
    const { service, repository } = makeService();
    const rows = [item(1)];
    repository.findMany.mockResolvedValue({ items: rows, total: 45 });
    const query = Object.assign(new QueryMenuItemDto(), {
      page: 3,
      limit: 20,
      search: "dep",
    });

    const result = await service.findAll(query);

    expect(repository.findMany).toHaveBeenCalledWith(
      SCOPE,
      { search: "dep" },
      query,
    );
    expect(result).toBeInstanceOf(PaginatedResponseDto);
    expect(result).toMatchObject({
      items: rows,
      total: 45,
      page: 3,
      limit: 20,
    });
    expect(result.totalPages).toBe(3);
  });

  it("findOne() returns the item scoped to the caller's org", async () => {
    const { service, repository } = makeService();
    const row = item(9);
    repository.findOne.mockResolvedValue(row);

    await expect(service.findOne(9)).resolves.toBe(row);
    expect(repository.findOne).toHaveBeenCalledWith(SCOPE, 9);
  });

  it("create() writes with the caller as creator when the code is free", async () => {
    const { service, repository } = makeService();
    repository.findByCode.mockResolvedValue(null);
    const created = item(10, { code: "reports" });
    repository.create.mockResolvedValue(created);
    const dto = { code: "reports", label: "Reports" };

    await expect(service.create(dto)).resolves.toBe(created);
    expect(repository.findByCode).toHaveBeenCalledWith(SCOPE, "reports");
    expect(repository.create).toHaveBeenCalledWith(SCOPE, dto, USER_ID);
  });

  it("create() does not write when the code already exists", async () => {
    const { service, repository } = makeService();
    repository.findByCode.mockResolvedValue(item(1, { code: "reports" }));

    await expect(
      service.create({ code: "reports", label: "Reports" }),
    ).rejects.toThrow('A menu item with code "reports" already exists');
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("update() rejects a code already used by a different item", async () => {
    const { service, repository } = makeService();
    repository.findByCode.mockResolvedValue(item(2, { code: "reports" }));

    await expect(service.update(1, { code: "reports" })).rejects.toBeInstanceOf(
      ResourceConflictException,
    );
    expect(repository.update).not.toHaveBeenCalled();
  });

  it("update() allows keeping the item's own code", async () => {
    const { service, repository } = makeService();
    repository.findByCode.mockResolvedValue(item(1, { code: "reports" }));
    const updated = { ...item(1, { code: "reports" }), label: "New" };
    repository.update.mockResolvedValue(updated);

    await expect(
      service.update(1, { code: "reports", label: "New" }),
    ).resolves.toBe(updated);
    expect(repository.update).toHaveBeenCalledWith(
      SCOPE,
      1,
      { code: "reports", label: "New" },
      USER_ID,
    );
  });

  it("update() skips the code lookup when the code is not being changed", async () => {
    const { service, repository } = makeService();
    repository.update.mockResolvedValue(item(1));

    await service.update(1, { label: "Renamed" });

    expect(repository.findByCode).not.toHaveBeenCalled();
  });

  it("update() throws ResourceNotFoundException when the item does not exist in the org", async () => {
    const { service, repository } = makeService();
    repository.update.mockResolvedValue(null);

    await expect(service.update(999, { label: "X" })).rejects.toBeInstanceOf(
      ResourceNotFoundException,
    );
  });

  it("remove() soft-deletes with the caller recorded", async () => {
    const { service, repository } = makeService();
    repository.softDelete.mockResolvedValue(true);

    await expect(service.remove(4)).resolves.toBeUndefined();
    expect(repository.softDelete).toHaveBeenCalledWith(SCOPE, 4, USER_ID);
  });

  it("remove() throws ResourceNotFoundException when nothing was deleted", async () => {
    const { service, repository } = makeService();
    repository.softDelete.mockResolvedValue(false);

    await expect(service.remove(999)).rejects.toThrow(
      "MenuItem not found: 999",
    );
  });
});
