import { ForbiddenException } from "@nestjs/common";
import { TeamContextService } from "./team-context.service.js";

function makeService(opts: {
  granted: string[];
  cls?: Record<string, unknown>;
  teamRows?: Array<{ teamId: number }>;
}) {
  const cls = {
    get: vi.fn(
      (key: string) => (opts.cls ?? { userId: 7, organizationId: 1 })[key],
    ),
  };
  const permissions = {
    getPermissionsForUser: vi.fn().mockResolvedValue(opts.granted),
  };
  const prisma = {
    userTeamAccess: {
      findMany: vi.fn().mockResolvedValue(opts.teamRows ?? []),
    },
  };
  const service = new TeamContextService(
    cls as never,
    permissions as never,
    prisma as never,
  );
  return { service, prisma, permissions };
}

describe("TeamContextService.resolveScope", () => {
  it("returns 'all' without querying team membership", async () => {
    const { service, prisma } = makeService({
      granted: ["hr.employee.read.all"],
    });
    await expect(service.resolveScope("hr.employee.read")).resolves.toEqual({
      level: "all",
      userId: 7,
      organizationId: 1,
      teamIds: [],
    });
    expect(prisma.userTeamAccess.findMany).not.toHaveBeenCalled();
  });

  it("returns 'team' with the caller's team ids", async () => {
    const { service } = makeService({
      granted: ["hr.employee.read.team"],
      teamRows: [{ teamId: 4 }, { teamId: 9 }],
    });
    await expect(service.resolveScope("hr.employee.read")).resolves.toEqual({
      level: "team",
      userId: 7,
      organizationId: 1,
      teamIds: [4, 9],
    });
  });

  it("returns 'own' without querying team membership", async () => {
    const { service, prisma } = makeService({
      granted: ["hr.employee.read.own"],
    });
    await expect(service.resolveScope("hr.employee.read")).resolves.toEqual({
      level: "own",
      userId: 7,
      organizationId: 1,
      teamIds: [],
    });
    expect(prisma.userTeamAccess.findMany).not.toHaveBeenCalled();
  });

  it("picks the most permissive variant held: all > team > own", async () => {
    const both = makeService({
      granted: [
        "hr.employee.read.own",
        "hr.employee.read.team",
        "hr.employee.read.all",
      ],
    });
    expect((await both.service.resolveScope("hr.employee.read")).level).toBe(
      "all",
    );

    const teamOwn = makeService({
      granted: ["hr.employee.read.own", "hr.employee.read.team"],
    });
    expect((await teamOwn.service.resolveScope("hr.employee.read")).level).toBe(
      "team",
    );
  });

  it("ignores variants of a different permission", async () => {
    const { service } = makeService({
      granted: ["hr.employee.write.all", "hr.leave.read.all"],
    });
    await expect(
      service.resolveScope("hr.employee.read"),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("throws ForbiddenException (403), not a generic Error (500), when none is held", async () => {
    const { service } = makeService({ granted: [] });
    await expect(
      service.resolveScope("hr.employee.read"),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("does not treat the bare prefix as a grant", async () => {
    const { service } = makeService({ granted: ["hr.employee.read"] });
    await expect(
      service.resolveScope("hr.employee.read"),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("looks up only active, non-deleted memberships of active teams in the caller's own organization", async () => {
    const { service, prisma } = makeService({
      granted: ["hr.employee.read.team"],
      cls: { userId: 7, organizationId: 42 },
    });
    await service.resolveScope("hr.employee.read");
    expect(prisma.userTeamAccess.findMany).toHaveBeenCalledWith({
      where: {
        userId: 7,
        organizationId: 42,
        isActive: true,
        deletedAt: null,
        team: { organizationId: 42, isActive: true, deletedAt: null },
      },
      select: { teamId: true },
    });
  });

  it.each([
    ["no user", { organizationId: 1 }],
    ["no organization", { userId: 7 }],
    ["neither", {}],
  ])(
    "throws when the request context has %s (public route)",
    async (_l, cls) => {
      const { service, permissions } = makeService({
        granted: ["hr.employee.read.all"],
        cls,
      });
      await expect(service.resolveScope("hr.employee.read")).rejects.toThrow(
        /no user in context/,
      );
      expect(permissions.getPermissionsForUser).not.toHaveBeenCalled();
    },
  );
});
