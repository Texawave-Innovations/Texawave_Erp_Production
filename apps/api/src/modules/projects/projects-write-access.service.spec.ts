import { ForbiddenException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { ProjectsWriteAccessService } from "./projects-write-access.service.js";

function makeService(granted: string[], teamIds: number[] = [3]) {
  const permissions = {
    getPermissionsForUser: vi.fn().mockResolvedValue(granted),
  };
  const teamContext = {
    resolveScope: vi
      .fn()
      .mockResolvedValue({ level: "team", teamIds, userId: 10 }),
  };
  const tenantContext = {
    getUserId: vi.fn().mockReturnValue(10),
    getOrgScope: vi.fn().mockReturnValue({ organizationId: 1 }),
  };
  const repository = {
    findEmployeeTeamId: vi.fn(),
    projectHasMemberInTeams: vi.fn(),
  };
  const service = new ProjectsWriteAccessService(
    permissions as never,
    teamContext as never,
    tenantContext as never,
    repository as never,
  );
  return { service, teamContext, repository };
}

describe("ProjectsWriteAccessService", () => {
  it("lets an org-wide writer through without resolving a team", async () => {
    const { service, teamContext, repository } = makeService([
      "projects.task.write",
    ]);
    const access = await service.resolve();
    expect(access).toEqual({ kind: "all" });
    await service.assertAssignee(access, null);
    await service.assertProject(access, 5);
    expect(teamContext.resolveScope).not.toHaveBeenCalled();
    expect(repository.findEmployeeTeamId).not.toHaveBeenCalled();
  });

  it("scopes a team lead to their own team(s)", async () => {
    const { service } = makeService(
      ["projects.task_assignment.write.team"],
      [3, 4],
    );
    expect(await service.resolve()).toEqual({ kind: "team", teamIds: [3, 4] });
  });

  it("rejects a caller with neither permission", async () => {
    const { service } = makeService(["projects.project.read"]);
    await expect(service.resolve()).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("accepts an assignee on the lead's team", async () => {
    const { service, repository } = makeService([
      "projects.task_assignment.write.team",
    ]);
    repository.findEmployeeTeamId.mockResolvedValue(3);
    await expect(
      service.assertAssignee({ kind: "team", teamIds: [3] }, 42),
    ).resolves.toBeUndefined();
  });

  it("rejects an assignee from another team, an unknown employee and no assignee", async () => {
    const { service, repository } = makeService([
      "projects.task_assignment.write.team",
    ]);
    const access = { kind: "team", teamIds: [3] } as const;
    repository.findEmployeeTeamId.mockResolvedValueOnce(9);
    await expect(service.assertAssignee(access, 42)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    repository.findEmployeeTeamId.mockResolvedValueOnce(null);
    await expect(service.assertAssignee(access, 43)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(service.assertAssignee(access, null)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(
      service.assertAssignee(access, undefined),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("allows milestones only on projects that include the lead's team", async () => {
    const { service, repository } = makeService([
      "projects.task_assignment.write.team",
    ]);
    const access = { kind: "team", teamIds: [3] } as const;
    repository.projectHasMemberInTeams.mockResolvedValueOnce(true);
    await expect(service.assertProject(access, 5)).resolves.toBeUndefined();
    repository.projectHasMemberInTeams.mockResolvedValueOnce(false);
    await expect(service.assertProject(access, 6)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
