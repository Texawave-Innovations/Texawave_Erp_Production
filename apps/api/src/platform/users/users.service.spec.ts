import { BadRequestException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import {
  ResourceConflictException,
  ResourceNotFoundException,
} from "../../common/exceptions/business.exception.js";
import { UsersService } from "./users.service.js";

const SCOPE = { organizationId: 1 };

function makeService() {
  const repository = {
    findMany: vi.fn(),
    findOneDetail: vi.fn(),
    findByEmail: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    softDelete: vi.fn(),
    findRolesInOrg: vi.fn(),
    assignRoles: vi.fn(),
    findTeamsInOrg: vi.fn(),
    assignTeams: vi.fn(),
  };
  const tenantContext = {
    getOrgScope: vi.fn().mockReturnValue(SCOPE),
    getUserId: vi.fn().mockReturnValue(42),
  };
  const permissions = { invalidate: vi.fn() };

  const service = new UsersService(
    repository as never,
    tenantContext as never,
    permissions as never,
  );
  return { service, repository, permissions };
}

describe("UsersService", () => {
  it("create() rejects duplicate email with ResourceConflictException", async () => {
    const { service, repository } = makeService();
    repository.findByEmail.mockResolvedValue({ id: 1, email: "test@org.test" });

    await expect(
      service.create({
        email: "test@org.test",
        fullName: "Test User",
        password: "Password123!",
      }),
    ).rejects.toBeInstanceOf(ResourceConflictException);
  });

  it("assignRoles() throws BadRequestException if any role is outside org", async () => {
    const { service, repository } = makeService();
    repository.findById.mockResolvedValue({ id: 10 });
    // User requested roles [1, 2], but only [1] belongs to this org
    repository.findRolesInOrg.mockResolvedValue([{ id: 1 }]);

    await expect(
      service.assignRoles(10, { roleIds: [1, 2] }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.assignRoles).not.toHaveBeenCalled();
  });

  it("assignRoles() updates roles and invalidates cached permissions when roles belong to org", async () => {
    const { service, repository, permissions } = makeService();
    repository.findById.mockResolvedValue({ id: 10 });
    repository.findRolesInOrg.mockResolvedValue([{ id: 1 }, { id: 2 }]);
    repository.assignRoles.mockResolvedValue(true);
    repository.findOneDetail.mockResolvedValue({
      id: 10,
      roles: [{ id: 1 }, { id: 2 }],
    });

    const result = await service.assignRoles(10, { roleIds: [1, 2] });
    expect(repository.assignRoles).toHaveBeenCalledWith(SCOPE, 10, [1, 2], 42);
    expect(permissions.invalidate).toHaveBeenCalledWith(10);
    expect(result?.id).toBe(10);
  });

  it("assignTeams() throws BadRequestException if any team is outside org", async () => {
    const { service, repository } = makeService();
    repository.findById.mockResolvedValue({ id: 10 });
    repository.findTeamsInOrg.mockResolvedValue([{ id: 5 }]);

    await expect(
      service.assignTeams(10, { teamIds: [5, 99] }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.assignTeams).not.toHaveBeenCalled();
  });

  it("findOne() throws ResourceNotFoundException when user is not found", async () => {
    const { service, repository } = makeService();
    repository.findOneDetail.mockResolvedValue(null);

    await expect(service.findOne(999)).rejects.toBeInstanceOf(
      ResourceNotFoundException,
    );
  });
});
