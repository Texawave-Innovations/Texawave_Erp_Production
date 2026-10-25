import { Injectable } from "@nestjs/common";
import { PaginatedResponseDto } from "../../../common/dto/paginated-response.dto.js";
import {
  BusinessRuleViolationException,
  InvalidStateTransitionException,
  ResourceNotFoundException,
  VersionConflictException,
} from "../../../common/exceptions/business.exception.js";
import { TenantContextService } from "../../../platform/tenancy/tenant-context.service.js";
import { UsersService } from "../../../platform/users/users.service.js";
import { ProjectsService } from "../projects.service.js";
import type {
  CreateMomDocumentDto,
  QueryMomDocumentDto,
  StartMomRevisionDto,
  UpdateMomDocumentDto,
} from "./dto/document.dto.js";
import { MomRepository, type ResolvedMomProject } from "./mom.repository.js";
import { validateMomFinalize } from "./rules/mom-rules.js";

@Injectable()
export class MomDocumentsService {
  constructor(
    private readonly repository: MomRepository,
    private readonly tenantContext: TenantContextService,
    private readonly usersService: UsersService,
    private readonly projectsService: ProjectsService,
  ) {}

  async findAll(query: QueryMomDocumentDto) {
    const scope = this.tenantContext.getOrgScope();
    const { items, total, page, limit } = await this.repository.findDocuments(
      scope,
      query,
    );
    return new PaginatedResponseDto(items, total, page, limit);
  }

  /** Register stat cards — counts across the whole register, not one page. */
  async getStats() {
    const scope = this.tenantContext.getOrgScope();
    const { rows, inRevision } =
      await this.repository.countDocumentsByStatus(scope);
    const byStatus = { draft: 0, finalized: 0, archived: 0 };
    for (const row of rows) {
      byStatus[row.status] = row._count._all;
    }
    return {
      total: byStatus.draft + byStatus.finalized + byStatus.archived,
      draft: byStatus.draft,
      finalized: byStatus.finalized,
      archived: byStatus.archived,
      inRevision,
    };
  }

  findByProjectId(projectId: number) {
    const scope = this.tenantContext.getOrgScope();
    return this.repository.findByProjectId(scope, projectId);
  }

  async findOne(id: number) {
    const scope = this.tenantContext.getOrgScope();
    const document = await this.repository.findDocumentById(scope, id);
    if (!document) throw new ResourceNotFoundException("MomDocument", id);
    return document;
  }

  async create(dto: CreateMomDocumentDto) {
    const scope = this.tenantContext.getOrgScope();
    const userId = this.tenantContext.getUserId();
    const user = await this.usersService.findOne(userId);
    const project = await this.resolveProject(dto.projectId);

    // Legacy editor pre-applied the default active template when the user
    // didn't pick one, so every MoM records which template/version it used.
    let templateId = dto.templateId;
    if (templateId === undefined) {
      const fallback = await this.repository.findDefaultActiveTemplate(scope);
      templateId = fallback?.id;
    }

    return this.repository.createDocument(
      scope,
      { ...dto, ...(templateId !== undefined ? { templateId } : {}) },
      project,
      userId,
      user.fullName,
    );
  }

  async update(id: number, dto: UpdateMomDocumentDto) {
    const existing = await this.findOne(id);
    if (existing.status === "archived") {
      throw new InvalidStateTransitionException(
        "MomDocument",
        existing.status,
        existing.status,
        "archived minutes must be restored before they can be edited",
      );
    }
    if (existing.status !== "draft" && existing.workingRevision === null) {
      throw new InvalidStateTransitionException(
        "MomDocument",
        existing.status,
        existing.status,
        "finalized minutes can only be edited after starting a revision",
      );
    }
    if (dto.versionToken && dto.versionToken !== existing.versionToken) {
      throw new VersionConflictException("MomDocument");
    }

    const scope = this.tenantContext.getOrgScope();
    const userId = this.tenantContext.getUserId();
    const user = await this.usersService.findOne(userId);
    const project = await this.resolveProject(dto.projectId);
    const updated = await this.repository.updateDocument(
      scope,
      id,
      dto,
      project,
      userId,
      user.fullName,
      existing.workingRevision !== null,
    );
    if (!updated) throw new ResourceNotFoundException("MomDocument", id);
    return this.findOne(id);
  }

  async finalize(id: number) {
    const existing = await this.findOne(id);
    if (existing.status !== "draft") {
      throw new InvalidStateTransitionException(
        "MomDocument",
        existing.status,
        "finalized",
      );
    }
    this.assertFinalizable(existing);
    const scope = this.tenantContext.getOrgScope();
    const userId = this.tenantContext.getUserId();
    const user = await this.usersService.findOne(userId);
    return this.repository.finalize(scope, id, userId, user.fullName);
  }

  async startRevision(id: number, dto: StartMomRevisionDto) {
    const existing = await this.findOne(id);
    if (existing.status !== "finalized" || existing.workingRevision !== null) {
      throw new InvalidStateTransitionException(
        "MomDocument",
        existing.status,
        existing.status,
        "a revision can only be started on a finalized document with no revision already in progress",
      );
    }
    const scope = this.tenantContext.getOrgScope();
    const userId = this.tenantContext.getUserId();
    const user = await this.usersService.findOne(userId);
    return this.repository.startRevision(
      scope,
      id,
      {
        meetingTitle: existing.meetingTitle,
        meetingDate: existing.meetingDate,
        startTime: existing.startTime,
        endTime: existing.endTime,
        timezone: existing.timezone,
        location: existing.location,
        attendeesJson: existing.attendeesJson,
        absenteesJson: existing.absenteesJson,
        agendaJson: existing.agendaJson,
        meetingNotesJson: existing.meetingNotesJson,
        additionalSectionsJson: existing.additionalSectionsJson,
        freeTextContent: existing.freeTextContent,
        status: existing.status,
        currentRevision: existing.currentRevision,
      },
      userId,
      user.fullName,
      dto.reason.trim(),
    );
  }

  async finalizeRevision(id: number) {
    const existing = await this.findOne(id);
    if (existing.status !== "finalized" || existing.workingRevision === null) {
      throw new InvalidStateTransitionException(
        "MomDocument",
        existing.status,
        "finalized",
        "no revision is currently in progress",
      );
    }
    this.assertFinalizable(existing);
    const scope = this.tenantContext.getOrgScope();
    const userId = this.tenantContext.getUserId();
    const user = await this.usersService.findOne(userId);
    return this.repository.finalizeRevision(scope, id, userId, user.fullName);
  }

  async archive(id: number) {
    const existing = await this.findOne(id);
    if (existing.status === "archived") {
      throw new InvalidStateTransitionException(
        "MomDocument",
        existing.status,
        "archived",
      );
    }
    const scope = this.tenantContext.getOrgScope();
    const userId = this.tenantContext.getUserId();
    const user = await this.usersService.findOne(userId);
    return this.repository.archive(scope, id, userId, user.fullName);
  }

  async restore(id: number) {
    const existing = await this.findOne(id);
    if (existing.status !== "archived") {
      throw new InvalidStateTransitionException(
        "MomDocument",
        existing.status,
        existing.previousStatus ?? "draft",
      );
    }
    const scope = this.tenantContext.getOrgScope();
    const userId = this.tenantContext.getUserId();
    const user = await this.usersService.findOne(userId);
    return this.repository.restore(scope, id, userId, user.fullName);
  }

  async softDelete(id: number) {
    const scope = this.tenantContext.getOrgScope();
    const removed = await this.repository.softDeleteDocument(scope, id);
    if (!removed) throw new ResourceNotFoundException("MomDocument", id);
    return { success: true };
  }

  /** Legacy `validateMomFinalize` — run server-side so a finalized MoM is
   * always a complete record regardless of which client finalized it. */
  private assertFinalizable(doc: Parameters<typeof validateMomFinalize>[0]) {
    const problems = validateMomFinalize(doc);
    if (problems.length > 0) {
      throw new BusinessRuleViolationException(
        problems.join(" "),
        "MOM_INCOMPLETE",
      );
    }
  }

  /** Copies the linked project's code/name/client onto the MoM (legacy kept
   * `projectCode`/`projectName` denormalized on the document). Throws 404
   * for a project outside the caller's organization. */
  private async resolveProject(
    projectId: number | undefined,
  ): Promise<ResolvedMomProject | null> {
    if (!projectId) return null;
    const project = await this.projectsService.findOne(projectId);
    return {
      id: project.id,
      code: project.projectCode,
      name: project.name,
      clientName: project.customerName ?? project.customer?.name ?? null,
    };
  }
}
