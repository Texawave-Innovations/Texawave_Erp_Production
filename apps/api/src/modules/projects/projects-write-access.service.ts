import { ForbiddenException, Injectable } from "@nestjs/common";
import { TeamContextService } from "../../platform/tenancy/team-context.service.js";
import { PermissionsService } from "../../platform/roles-permissions/permissions.service.js";
import { TenantContextService } from "../../platform/tenancy/tenant-context.service.js";
import { ProjectsRepository } from "./projects.repository.js";

/** What the caller may write: everything (`projects.task.write`), or only
 * work for employees of their own team(s) (`projects.task_assignment.write.team`). */
export type ProjectsWriteAccess =
  { kind: "all" } | { kind: "team"; teamIds: readonly number[] };

/**
 * Task and milestone writes are open to two audiences. Holders of the org-wide
 * `projects.task.write` are unrestricted, exactly as before. A Team Lead holds
 * `projects.task_assignment.write.team` and is limited to their own team: a task may only
 * be created for, assigned to, edited on or deleted from an employee of their
 * team(s), and a milestone only on a project that includes one of their team's
 * employees. The controller decides who may reach the route; this decides what
 * they may touch.
 */
@Injectable()
export class ProjectsWriteAccessService {
  constructor(
    private readonly permissions: PermissionsService,
    private readonly teamContext: TeamContextService,
    private readonly tenantContext: TenantContextService,
    private readonly repository: ProjectsRepository,
  ) {}

  async resolve(): Promise<ProjectsWriteAccess> {
    const granted = await this.permissions.getPermissionsForUser(
      this.tenantContext.getUserId(),
    );
    if (
      granted.includes("projects.task.write") ||
      granted.includes("projects.task_assignment.write.all")
    ) {
      return { kind: "all" };
    }
    // Only the `.team` grant is accepted: `.own` is a reserved variant that
    // gives no write access to anything.
    if (!granted.includes("projects.task_assignment.write.team")) {
      throw new ForbiddenException(
        "Missing permission: projects.task.write or projects.task_assignment.write.team",
      );
    }
    const scope = await this.teamContext.resolveScope(
      "projects.task_assignment.write",
    );
    return { kind: "team", teamIds: scope.teamIds };
  }

  /** The employee a task is (or is being) assigned to must be on the
   * caller's team. Unassigned work is not something a team lead can create. */
  async assertAssignee(
    access: ProjectsWriteAccess,
    employeeId: number | null | undefined,
  ): Promise<void> {
    if (access.kind === "all") return;
    if (!employeeId) {
      throw new ForbiddenException(
        "A team lead can only manage tasks assigned to an employee of their own team",
      );
    }
    const teamId = await this.repository.findEmployeeTeamId(
      this.tenantContext.getOrgScope(),
      employeeId,
    );
    if (teamId === null || !access.teamIds.includes(teamId)) {
      throw new ForbiddenException(
        "This employee is not on your team, so you cannot manage their tasks",
      );
    }
  }

  /** Milestones carry no assignee: the project must include the lead's team. */
  async assertProject(
    access: ProjectsWriteAccess,
    projectId: number,
  ): Promise<void> {
    if (access.kind === "all") return;
    const ok = await this.repository.projectHasMemberInTeams(
      this.tenantContext.getOrgScope(),
      projectId,
      access.teamIds,
    );
    if (!ok) {
      throw new ForbiddenException(
        "None of your team is a member of this project, so you cannot manage its milestones",
      );
    }
  }
}
