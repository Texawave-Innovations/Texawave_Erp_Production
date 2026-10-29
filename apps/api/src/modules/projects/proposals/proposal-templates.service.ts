import { Injectable } from "@nestjs/common";
import {
  InvalidStateTransitionException,
  ResourceNotFoundException,
} from "../../../common/exceptions/business.exception.js";
import { TenantContextService } from "../../../platform/tenancy/tenant-context.service.js";
import { UsersService } from "../../../platform/users/users.service.js";
import type {
  CreateProposalTemplateDto,
  UpdateProposalTemplateDto,
} from "./dto/template.dto.js";
import { ProposalsRepository } from "./proposals.repository.js";

/** Fields that define a template version's content. A published (`active`)
 * or archived version is immutable so proposals issued from it stay
 * reproducible — changes go into a new draft version. */
const CONTENT_FIELDS = [
  "name",
  "title",
  "code",
  "description",
  "department",
  "category",
  "schemaJson",
] as const;

@Injectable()
export class ProposalTemplatesService {
  constructor(
    private readonly repository: ProposalsRepository,
    private readonly tenantContext: TenantContextService,
    private readonly usersService: UsersService,
  ) {}

  findAll() {
    const scope = this.tenantContext.getOrgScope();
    return this.repository.findTemplates(scope);
  }

  async findOne(id: number) {
    const scope = this.tenantContext.getOrgScope();
    const template = await this.repository.findTemplateById(scope, id);
    if (!template) throw new ResourceNotFoundException("ProposalTemplate", id);
    return template;
  }

  async create(dto: CreateProposalTemplateDto) {
    const scope = this.tenantContext.getOrgScope();
    const userId = this.tenantContext.getUserId();
    const user = await this.usersService.findOne(userId);
    const code = dto.code?.trim().toUpperCase();
    return this.repository.createTemplate(
      scope,
      { ...dto, ...(code ? { code } : {}) },
      userId,
      user.fullName,
    );
  }

  async update(id: number, dto: UpdateProposalTemplateDto) {
    const existing = await this.findOne(id);
    const touchesContent = CONTENT_FIELDS.some((f) => dto[f] !== undefined);
    if (touchesContent && existing.status !== "draft") {
      throw new InvalidStateTransitionException(
        "ProposalTemplate",
        existing.status,
        existing.status,
        "published or archived template versions are immutable — create a new version to change them",
      );
    }
    if (dto.status === "active" && existing.status === "draft") {
      // Publishing goes through publish() so the version chain is updated.
      const { status: _ignored, ...rest } = dto;
      if (Object.keys(rest).length > 0) await this.update(id, rest);
      return this.publish(id);
    }
    if (dto.isDefault && (dto.status ?? existing.status) !== "active") {
      throw new InvalidStateTransitionException(
        "ProposalTemplate",
        existing.status,
        "default",
        "only a published template can be the default",
      );
    }
    const scope = this.tenantContext.getOrgScope();
    const updated = await this.repository.updateTemplate(scope, id, {
      ...dto,
      ...(dto.code !== undefined
        ? { code: dto.code.trim().toUpperCase() }
        : {}),
    });
    if (!updated) throw new ResourceNotFoundException("ProposalTemplate", id);
    return updated;
  }

  async publish(id: number) {
    const existing = await this.findOne(id);
    if (existing.status !== "draft") {
      throw new InvalidStateTransitionException(
        "ProposalTemplate",
        existing.status,
        "active",
      );
    }
    const scope = this.tenantContext.getOrgScope();
    const published = await this.repository.publishTemplate(scope, id);
    if (!published) throw new ResourceNotFoundException("ProposalTemplate", id);
    return published;
  }

  async duplicate(id: number) {
    const source = await this.findOne(id);
    const scope = this.tenantContext.getOrgScope();
    const userId = this.tenantContext.getUserId();
    const user = await this.usersService.findOne(userId);
    const copy = await this.repository.cloneTemplate(
      scope,
      id,
      {
        name: `${source.name} (Copy)`,
        title: source.title,
        code: source.code ? `${source.code}-COPY` : null,
        version: 1,
        parentVersionId: null,
        isCurrent: true,
      },
      userId,
      user.fullName,
    );
    if (!copy) throw new ResourceNotFoundException("ProposalTemplate", id);
    return copy;
  }

  async createNewVersion(id: number) {
    const source = await this.findOne(id);
    if (source.status === "draft") {
      throw new InvalidStateTransitionException(
        "ProposalTemplate",
        source.status,
        "new version",
        "edit the draft directly — new versions are created from published templates",
      );
    }
    const scope = this.tenantContext.getOrgScope();
    const userId = this.tenantContext.getUserId();
    const user = await this.usersService.findOne(userId);
    const next = await this.repository.cloneTemplate(
      scope,
      id,
      {
        name: source.name,
        title: source.title,
        code: source.code,
        version: source.version + 1,
        parentVersionId: source.id,
        isCurrent: false,
      },
      userId,
      user.fullName,
    );
    if (!next) throw new ResourceNotFoundException("ProposalTemplate", id);
    return next;
  }

  async softDelete(id: number) {
    const scope = this.tenantContext.getOrgScope();
    const removed = await this.repository.softDeleteTemplate(scope, id);
    if (!removed) throw new ResourceNotFoundException("ProposalTemplate", id);
    return { success: true };
  }
}
