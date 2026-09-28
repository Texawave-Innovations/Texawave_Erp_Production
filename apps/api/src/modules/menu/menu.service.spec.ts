import { describe, expect, it, vi } from "vitest";
import {
  ResourceConflictException,
  ResourceNotFoundException,
} from "../../common/exceptions/business.exception.js";
import { MenuService } from "./menu.service.js";

const SCOPE = { organizationId: 1 };

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
    getUserId: vi.fn().mockReturnValue(42),
  };
  const permissions = {
    getPermissionsForUser: vi.fn(),
  };

  const service = new MenuService(
    repository as never,
    tenantContext as never,
    permissions as never,
  );

  return { service, repository, permissions };
}

describe("MenuService", () => {
  it("getMyMenu() filters out restricted menu items when user lacks the permission", async () => {
    const { service, repository, permissions } = makeService();

    // User only has "reference.tags.read", NOT "settings.role.read"
    permissions.getPermissionsForUser.mockResolvedValue([
      "reference.tags.read",
    ]);

    repository.findActiveItems.mockResolvedValue([
      {
        id: 1,
        code: "dashboard",
        label: "Dashboard",
        path: "/",
        icon: null,
        order: 1,
        parentId: null,
        permission: null, // Public
      },
      {
        id: 2,
        code: "tags",
        label: "Tags",
        path: "/reference/tags",
        icon: null,
        order: 2,
        parentId: null,
        permission: "reference.tags.read", // Allowed
      },
      {
        id: 3,
        code: "roles",
        label: "Roles",
        path: "/admin/roles",
        icon: null,
        order: 3,
        parentId: null,
        permission: "settings.role.read", // RESTRICTED: should be filtered out!
      },
    ]);

    const menu = await service.getMyMenu(42);

    expect(menu).toHaveLength(2);
    expect(menu.map((m) => m.code)).toEqual(["dashboard", "tags"]);
    expect(menu.some((m) => m.code === "roles")).toBe(false);
  });

  it("getMyMenu() builds nested tree hierarchy for permitted children", async () => {
    const { service, repository, permissions } = makeService();

    permissions.getPermissionsForUser.mockResolvedValue([
      "departments.department.read",
    ]);

    repository.findActiveItems.mockResolvedValue([
      {
        id: 10,
        code: "admin",
        label: "Admin",
        path: null,
        icon: null,
        order: 1,
        parentId: null,
        permission: null,
      },
      {
        id: 11,
        code: "admin-departments",
        label: "Departments",
        path: "/admin/departments",
        icon: null,
        order: 1,
        parentId: 10,
        permission: "departments.department.read",
      },
      {
        id: 12,
        code: "admin-roles",
        label: "Roles",
        path: "/admin/roles",
        icon: null,
        order: 2,
        parentId: 10,
        permission: "settings.role.read", // Restricted
      },
    ]);

    const menu = await service.getMyMenu(42);

    expect(menu).toHaveLength(1);
    expect(menu[0].code).toBe("admin");
    expect(menu[0].children).toHaveLength(1);
    expect(menu[0].children[0].code).toBe("admin-departments");
  });

  it("create() rejects duplicate menu code with ResourceConflictException", async () => {
    const { service, repository } = makeService();
    repository.findByCode.mockResolvedValue({ id: 1, code: "dashboard" });

    await expect(
      service.create({
        code: "dashboard",
        label: "Dashboard",
      }),
    ).rejects.toBeInstanceOf(ResourceConflictException);
  });

  it("findOne() throws ResourceNotFoundException if item not found", async () => {
    const { service, repository } = makeService();
    repository.findOne.mockResolvedValue(null);

    await expect(service.findOne(999)).rejects.toBeInstanceOf(
      ResourceNotFoundException,
    );
  });
});
