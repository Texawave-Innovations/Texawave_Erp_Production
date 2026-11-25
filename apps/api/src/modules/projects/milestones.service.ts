import { Injectable } from "@nestjs/common";
import { ResourceNotFoundException } from "../../common/exceptions/business.exception.js";
import { TenantContextService } from "../../platform/tenancy/tenant-context.service.js";
import type { CreateMilestoneDto } from "./dto/create-milestone.dto.js";
import type { UpdateMilestoneDto } from "./dto/update-milestone.dto.js";
import { ProjectsRepository } from "./projects.repository.js";
import { ProjectsWriteAccessService } from "./projects-write-access.service.js";

@Injectable()
export class MilestonesService {
  constructor(
    private readonly repository: ProjectsRepository,
    private readonly tenantContext: TenantContextService,
    private readonly writeAccess: ProjectsWriteAccessService,
  ) {}

  async findMilestones(projectId: number) {
    const scope = this.tenantContext.getOrgScope();
    const project = await this.repository.findOne(scope, projectId);
    if (!project) {
      throw new ResourceNotFoundException("Project", projectId);
    }
    return this.repository.findMilestones(scope, projectId);
  }

  async createMilestone(projectId: number, dto: CreateMilestoneDto) {
    const scope = this.tenantContext.getOrgScope();
    const project = await this.repository.findOne(scope, projectId);
    if (!project) {
      throw new ResourceNotFoundException("Project", projectId);
    }
    await this.writeAccess.assertProject(
      await this.writeAccess.resolve(),
      projectId,
    );
    return this.repository.createMilestone(scope, projectId, dto);
  }

  async updateMilestone(milestoneId: number, dto: UpdateMilestoneDto) {
    const scope = this.tenantContext.getOrgScope();
    const milestone = await this.repository.findMilestoneById(
      scope,
      milestoneId,
    );
    if (!milestone) {
      throw new ResourceNotFoundException("Milestone", milestoneId);
    }
    await this.writeAccess.assertProject(
      await this.writeAccess.resolve(),
      milestone.projectId,
    );
    const updated = await this.repository.updateMilestone(
      scope,
      milestoneId,
      dto,
    );
    if (!updated) {
      throw new ResourceNotFoundException("Milestone", milestoneId);
    }
    return updated;
  }

  async deleteMilestone(milestoneId: number) {
    const scope = this.tenantContext.getOrgScope();
    const milestone = await this.repository.findMilestoneById(
      scope,
      milestoneId,
    );
    if (!milestone) {
      throw new ResourceNotFoundException("Milestone", milestoneId);
    }
    await this.writeAccess.assertProject(
      await this.writeAccess.resolve(),
      milestone.projectId,
    );
    const deleted = await this.repository.deleteMilestone(scope, milestoneId);
    return { success: deleted };
  }
}
