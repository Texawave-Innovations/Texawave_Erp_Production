import { Injectable } from "@nestjs/common";
import { PaginatedResponseDto } from "../../../common/dto/paginated-response.dto.js";
import {
  InvalidStateTransitionException,
  ResourceNotFoundException,
} from "../../../common/exceptions/business.exception.js";
import { TenantContextService } from "../../../platform/tenancy/tenant-context.service.js";
import { UsersService } from "../../../platform/users/users.service.js";
import { ProjectsService } from "../projects.service.js";
import type {
  CreateProposalDocumentDto,
  ExtendFollowupDto,
  QueryProposalDocumentDto,
  TransitionProposalDto,
  UpdateProposalDocumentDto,
} from "./dto/document.dto.js";
import {
  applyProposalTransition,
  assertTransitionComment,
  PROPOSAL_EDITABLE_STATUSES,
} from "./proposal-workflow.js";
import {
  type ProposalNumberFormat,
  ProposalsRepository,
  type ResolvedProposalProject,
} from "./proposals.repository.js";

/** Fields that make up the proposal's content of record. */
const CONTENT_FIELDS = [
  "title",
  "sectionValues",
  "templateId",
  "projectId",
  "projectName",
  "clientId",
  "clientName",
  "proposalDate",
] as const;

@Injectable()
export class ProposalDocumentsService {
  constructor(
    private readonly repository: ProposalsRepository,
    private readonly tenantContext: TenantContextService,
    private readonly usersService: UsersService,
    private readonly projectsService: ProjectsService,
  ) {}

  async findAll(query: QueryProposalDocumentDto) {
    const scope = this.tenantContext.getOrgScope();
    const { items, total, page, limit } = await this.repository.findDocuments(
      scope,
      query,
    );
    const rows = items.map(({ activities, ...doc }) => ({
      ...doc,
      createdByName: activities[0]?.userName ?? null,
    }));
    return new PaginatedResponseDto(rows, total, page, limit);
  }

  /** Hub stat cards (legacy `ProposalsHub` summary counts). */
  async getStats() {
    const scope = this.tenantContext.getOrgScope();
    const { byStatus, followUpsDue, clients } =
      await this.repository.documentStats(scope);
    const counts: Record<string, number> = {};
    for (const row of byStatus) counts[row.status] = row._count._all;
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    return {
      total,
      byStatus: counts,
      followUpsDue,
      clients: clients
        .map((c) => c.clientName)
        .filter((name): name is string => Boolean(name)),
    };
  }

  async findOne(id: number) {
    const scope = this.tenantContext.getOrgScope();
    const document = await this.repository.findDocumentById(scope, id);
    if (!document) throw new ResourceNotFoundException("ProposalDocument", id);
    return document;
  }

  async create(dto: CreateProposalDocumentDto) {
    const scope = this.tenantContext.getOrgScope();
    const userId = this.tenantContext.getUserId();
    const user = await this.usersService.findOne(userId);
    const project = await this.resolveProject(dto.projectId);

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
      await this.numberFormat(),
    );
  }

  async update(id: number, dto: UpdateProposalDocumentDto) {
    const existing = await this.findOne(id);
    if (existing.status === "archived") {
      throw new InvalidStateTransitionException(
        "ProposalDocument",
        existing.status,
        existing.status,
        "archived proposals cannot be edited",
      );
    }
    const touchesContent = CONTENT_FIELDS.some((f) => dto[f] !== undefined);
    if (
      touchesContent &&
      !PROPOSAL_EDITABLE_STATUSES.includes(existing.status)
    ) {
      throw new InvalidStateTransitionException(
        "ProposalDocument",
        existing.status,
        existing.status,
        "content can only change while the proposal is a draft or has changes requested — revert it to draft first",
      );
    }
    const scope = this.tenantContext.getOrgScope();
    const userId = this.tenantContext.getUserId();
    const project =
      dto.projectId !== undefined
        ? await this.resolveProject(dto.projectId)
        : undefined;
    const updated = await this.repository.updateDocument(
      scope,
      id,
      dto,
      project,
      userId,
    );
    if (!updated) throw new ResourceNotFoundException("ProposalDocument", id);
    return updated;
  }

  async transition(id: number, dto: TransitionProposalDto) {
    const existing = await this.findOne(id);
    const nextStatus = applyProposalTransition(existing.status, dto.action);
    assertTransitionComment(dto.action, dto.comments);

    const scope = this.tenantContext.getOrgScope();
    const userId = this.tenantContext.getUserId();
    const user = await this.usersService.findOne(userId);

    return this.repository.transitionDocument(
      scope,
      id,
      nextStatus,
      userId,
      user.fullName,
      undefined,
      dto.action,
      existing.status,
      dto.comments?.trim() || undefined,
    );
  }

  async extendFollowup(id: number, dto: ExtendFollowupDto) {
    const existing = await this.findOne(id);
    if (existing.status === "archived") {
      throw new InvalidStateTransitionException(
        "ProposalDocument",
        existing.status,
        existing.status,
        "archived proposals have no follow-up",
      );
    }
    const scope = this.tenantContext.getOrgScope();
    const userId = this.tenantContext.getUserId();
    const user = await this.usersService.findOne(userId);
    return this.repository.extendFollowup(
      scope,
      id,
      dto.dueDate,
      userId,
      user.fullName,
      dto.reason,
    );
  }

  async duplicate(id: number) {
    await this.findOne(id);
    const scope = this.tenantContext.getOrgScope();
    const userId = this.tenantContext.getUserId();
    const user = await this.usersService.findOne(userId);
    const copy = await this.repository.duplicateDocument(
      scope,
      id,
      userId,
      user.fullName,
      await this.numberFormat(),
    );
    if (!copy) throw new ResourceNotFoundException("ProposalDocument", id);
    return copy;
  }

  async softDelete(id: number) {
    const scope = this.tenantContext.getOrgScope();
    const removed = await this.repository.softDeleteDocument(scope, id);
    if (!removed) throw new ResourceNotFoundException("ProposalDocument", id);
    return { success: true };
  }

  private async numberFormat(): Promise<ProposalNumberFormat> {
    const scope = this.tenantContext.getOrgScope();
    const settings = await this.repository.getSettings(scope);
    return {
      prefix: settings.prefix,
      yearFormat: settings.yearFormat as ProposalNumberFormat["yearFormat"],
      sequenceDigits: settings.sequenceDigits,
    };
  }

  /** Copies the linked project's code/name/client onto the proposal.
   * Throws 404 for a project outside the caller's organization. */
  private async resolveProject(
    projectId: number | undefined,
  ): Promise<ResolvedProposalProject | null> {
    if (!projectId) return null;
    const project = await this.projectsService.findOne(projectId);
    return {
      id: project.id,
      code: project.projectCode,
      name: project.name,
      clientId: project.customerId ?? null,
      clientName: project.customerName ?? project.customer?.name ?? null,
    };
  }
}
