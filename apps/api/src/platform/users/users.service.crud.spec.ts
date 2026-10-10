import { BadRequestException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PaginatedResponseDto } from "../../common/dto/paginated-response.dto.js";
import {
  ResourceConflictException,
  ResourceNotFoundException,
} from "../../common/exceptions/business.exception.js";
import { QueryUserDto } from "./dto/query-user.dto.js";
import { UsersService } from "./users.service.js";

const { hashMock } = vi.hoisted(() => ({ hashMock: vi.fn() }));
vi.mock("bcrypt", () => ({ hash: hashMock, default: { hash: hashMock } }));

const SCOPE = { organizationId: 1 };
const CALLER_ID = 42;

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
    getUserId: vi.fn().mockReturnValue(CALLER_ID),
  };
  const permissions = { invalidate: vi.fn().mockResolvedValue(undefined) };

  const service = new UsersService(
    repository as never,
    tenantContext as never,
    permissions as never,
  );
  return { service, repository, permissions, tenantContext };
}

beforeEach(() => {
  hashMock.mockReset();
  hashMock.mockResolvedValue("hashed-pw");
});

describe("UsersService.findAll", () => {
  it("passes the org scope, search filter and pagination to the repository and wraps the result", async () => {
    const { service, repository } = makeService();
    repository.findMany.mockResolvedValue({
      items: [{ id: 1 }, { id: 2 }],
      total: 25,
    });
    const query = Object.assign(new QueryUserDto(), {
      page: 2,
      limit: 10,
      search: "ann",
    });

    const result = await service.findAll(query);

    expect(repository.findMany).toHaveBeenCalledWith(
      SCOPE,
      { search: "ann" },
      query,
    );
    expect(result).toBeInstanceOf(PaginatedResponseDto);
    expect(result.items).toEqual([{ id: 1 }, { id: 2 }]);
    expect(result.total).toBe(25);
    expect(result.page).toBe(2);
    expect(result.limit).toBe(10);
    expect(result.totalPages).toBe(3);
  });

  it("propagates a missing-tenant error instead of querying unscoped", async () => {
    const { service, repository, tenantContext } = makeService();
    tenantContext.getOrgScope.mockImplementation(() => {
      throw new Error("no organization in context");
    });

    await expect(service.findAll(new QueryUserDto())).rejects.toThrow(
      /no organization in context/,
    );
    expect(repository.findMany).not.toHaveBeenCalled();
  });
});

describe("UsersService.findOne", () => {
  it("returns the scoped user detail", async () => {
    const { service, repository } = makeService();
    repository.findOneDetail.mockResolvedValue({ id: 7, email: "a@b.c" });

    await expect(service.findOne(7)).resolves.toEqual({
      id: 7,
      email: "a@b.c",
    });
    expect(repository.findOneDetail).toHaveBeenCalledWith(SCOPE, 7);
  });
});

describe("UsersService.create", () => {
  const base = {
    email: "new@org.test",
    fullName: "New User",
    password: "Password123!",
  };

  it("hashes the password, creates the user scoped to the org with the caller as actor, and returns the detail", async () => {
    const { service, repository } = makeService();
    repository.findByEmail.mockResolvedValue(null);
    repository.create.mockResolvedValue({ id: 99 });
    repository.findOneDetail.mockResolvedValue({ id: 99, email: base.email });

    const result = await service.create({ ...base, mustChangePassword: true });

    expect(hashMock).toHaveBeenCalledWith("Password123!", 10);
    expect(repository.findByEmail).toHaveBeenCalledWith(SCOPE, base.email);
    expect(repository.create).toHaveBeenCalledWith(
      SCOPE,
      {
        email: base.email,
        fullName: base.fullName,
        passwordHash: "hashed-pw",
        mustChangePassword: true,
      },
      CALLER_ID,
    );
    // The plaintext password never reaches the repository.
    expect(JSON.stringify(repository.create.mock.calls)).not.toContain(
      "Password123!",
    );
    expect(repository.findRolesInOrg).not.toHaveBeenCalled();
    expect(repository.findTeamsInOrg).not.toHaveBeenCalled();
    expect(repository.assignRoles).not.toHaveBeenCalled();
    expect(repository.assignTeams).not.toHaveBeenCalled();
    expect(repository.findOneDetail).toHaveBeenCalledWith(SCOPE, 99);
    expect(result).toEqual({ id: 99, email: base.email });
  });

  it("treats empty roleIds/teamIds arrays as no assignment", async () => {
    const { service, repository } = makeService();
    repository.findByEmail.mockResolvedValue(null);
    repository.create.mockResolvedValue({ id: 5 });
    repository.findOneDetail.mockResolvedValue({ id: 5 });

    await service.create({ ...base, roleIds: [], teamIds: [] });

    expect(repository.findRolesInOrg).not.toHaveBeenCalled();
    expect(repository.findTeamsInOrg).not.toHaveBeenCalled();
    expect(repository.assignRoles).not.toHaveBeenCalled();
    expect(repository.assignTeams).not.toHaveBeenCalled();
  });

  it("validates and assigns roles and teams (teams as non-lead) after creating the user", async () => {
    const { service, repository } = makeService();
    repository.findByEmail.mockResolvedValue(null);
    repository.findRolesInOrg.mockResolvedValue([{ id: 1 }, { id: 2 }]);
    repository.findTeamsInOrg.mockResolvedValue([{ id: 3 }]);
    repository.create.mockResolvedValue({ id: 11 });
    repository.findOneDetail.mockResolvedValue({ id: 11 });

    await service.create({ ...base, roleIds: [1, 2], teamIds: [3] });

    expect(repository.findRolesInOrg).toHaveBeenCalledWith(SCOPE, [1, 2]);
    expect(repository.findTeamsInOrg).toHaveBeenCalledWith(SCOPE, [3]);
    expect(repository.assignRoles).toHaveBeenCalledWith(
      SCOPE,
      11,
      [1, 2],
      CALLER_ID,
    );
    expect(repository.assignTeams).toHaveBeenCalledWith(
      SCOPE,
      11,
      [{ teamId: 3, isLead: false }],
      CALLER_ID,
    );
  });

  it("rejects roles outside the org before hashing or creating anything", async () => {
    const { service, repository } = makeService();
    repository.findByEmail.mockResolvedValue(null);
    repository.findRolesInOrg.mockResolvedValue([{ id: 1 }]);

    await expect(
      service.create({ ...base, roleIds: [1, 2] }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(hashMock).not.toHaveBeenCalled();
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("rejects teams outside the org before creating anything", async () => {
    const { service, repository } = makeService();
    repository.findByEmail.mockResolvedValue(null);
    repository.findTeamsInOrg.mockResolvedValue([]);

    await expect(
      service.create({ ...base, teamIds: [8] }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.create).not.toHaveBeenCalled();
  });
});

describe("UsersService.update", () => {
  it("updates without an email uniqueness check when email is not being changed", async () => {
    const { service, repository } = makeService();
    repository.update.mockResolvedValue({ id: 3, fullName: "X" });

    await expect(service.update(3, { fullName: "X" })).resolves.toEqual({
      id: 3,
      fullName: "X",
    });
    expect(repository.findByEmail).not.toHaveBeenCalled();
    expect(repository.update).toHaveBeenCalledWith(
      SCOPE,
      3,
      { fullName: "X" },
      CALLER_ID,
    );
  });

  it("allows keeping the user's own email", async () => {
    const { service, repository } = makeService();
    repository.findByEmail.mockResolvedValue({ id: 3 });
    repository.update.mockResolvedValue({ id: 3 });

    await expect(service.update(3, { email: "me@org.test" })).resolves.toEqual({
      id: 3,
    });
    expect(repository.findByEmail).toHaveBeenCalledWith(SCOPE, "me@org.test");
  });

  it("rejects an email that belongs to another user", async () => {
    const { service, repository } = makeService();
    repository.findByEmail.mockResolvedValue({ id: 4 });

    await expect(
      service.update(3, { email: "taken@org.test" }),
    ).rejects.toBeInstanceOf(ResourceConflictException);
    expect(repository.update).not.toHaveBeenCalled();
  });

  it("throws ResourceNotFoundException when the scoped update matched nothing", async () => {
    const { service, repository } = makeService();
    repository.update.mockResolvedValue(null);

    await expect(service.update(3, { isActive: false })).rejects.toBeInstanceOf(
      ResourceNotFoundException,
    );
  });
});

describe("UsersService.remove", () => {
  it("soft-deletes within the org and invalidates cached permissions", async () => {
    const { service, repository, permissions } = makeService();
    repository.softDelete.mockResolvedValue(true);

    await expect(service.remove(6)).resolves.toBeUndefined();
    expect(repository.softDelete).toHaveBeenCalledWith(SCOPE, 6, CALLER_ID);
    expect(permissions.invalidate).toHaveBeenCalledWith(6);
  });

  it("throws ResourceNotFoundException and does not touch the cache when nothing was deleted", async () => {
    const { service, repository, permissions } = makeService();
    repository.softDelete.mockResolvedValue(false);

    await expect(service.remove(6)).rejects.toBeInstanceOf(
      ResourceNotFoundException,
    );
    expect(permissions.invalidate).not.toHaveBeenCalled();
  });
});

describe("UsersService.assignRoles", () => {
  it("throws ResourceNotFoundException when the user is not in the org", async () => {
    const { service, repository, permissions } = makeService();
    repository.findById.mockResolvedValue(null);

    await expect(
      service.assignRoles(10, { roleIds: [1] }),
    ).rejects.toBeInstanceOf(ResourceNotFoundException);
    expect(repository.findById).toHaveBeenCalledWith(SCOPE, 10);
    expect(repository.findRolesInOrg).not.toHaveBeenCalled();
    expect(permissions.invalidate).not.toHaveBeenCalled();
  });
});

describe("UsersService.assignTeams", () => {
  it("throws ResourceNotFoundException when the user is not in the org", async () => {
    const { service, repository } = makeService();
    repository.findById.mockResolvedValue(null);

    await expect(
      service.assignTeams(10, { teamIds: [1] }),
    ).rejects.toBeInstanceOf(ResourceNotFoundException);
    expect(repository.assignTeams).not.toHaveBeenCalled();
  });

  it("maps teamIds to non-lead assignments", async () => {
    const { service, repository } = makeService();
    repository.findById.mockResolvedValue({ id: 10 });
    repository.findTeamsInOrg.mockResolvedValue([{ id: 1 }, { id: 2 }]);
    repository.findOneDetail.mockResolvedValue({ id: 10 });

    const result = await service.assignTeams(10, { teamIds: [1, 2] });

    expect(repository.findTeamsInOrg).toHaveBeenCalledWith(SCOPE, [1, 2]);
    expect(repository.assignTeams).toHaveBeenCalledWith(
      SCOPE,
      10,
      [
        { teamId: 1, isLead: false },
        { teamId: 2, isLead: false },
      ],
      CALLER_ID,
    );
    expect(result).toEqual({ id: 10 });
  });

  it("prefers detailed `teams` over `teamIds` and defaults a missing isLead to false", async () => {
    const { service, repository } = makeService();
    repository.findById.mockResolvedValue({ id: 10 });
    repository.findTeamsInOrg.mockResolvedValue([{ id: 4 }, { id: 5 }]);

    await service.assignTeams(10, {
      teamIds: [99],
      teams: [{ teamId: 4, isLead: true }, { teamId: 5 }],
    });

    expect(repository.findTeamsInOrg).toHaveBeenCalledWith(SCOPE, [4, 5]);
    expect(repository.assignTeams).toHaveBeenCalledWith(
      SCOPE,
      10,
      [
        { teamId: 4, isLead: true },
        { teamId: 5, isLead: false },
      ],
      CALLER_ID,
    );
  });

  it("clears all teams when neither teams nor teamIds is given, without an org lookup", async () => {
    const { service, repository } = makeService();
    repository.findById.mockResolvedValue({ id: 10 });

    await service.assignTeams(10, {});

    expect(repository.findTeamsInOrg).not.toHaveBeenCalled();
    expect(repository.assignTeams).toHaveBeenCalledWith(
      SCOPE,
      10,
      [],
      CALLER_ID,
    );
  });
});
