import { Injectable } from "@nestjs/common";
import {
  InvalidStateTransitionException,
  ResourceNotFoundException,
} from "../../../common/exceptions/business.exception.js";
import { TenantContextService } from "../../../platform/tenancy/tenant-context.service.js";
import type {
  CreateMomTemplateDto,
  UpdateMomTemplateDto,
} from "./dto/template.dto.js";
import { MomRepository } from "./mom.repository.js";
import {
  DEFAULT_MOM_AGENDA,
  DEFAULT_MOM_NOTE_ROWS,
  DEFAULT_MOM_SECTIONS,
} from "./rules/mom-rules.js";

/** Fields that define a template's content. Legacy locked a published
 * (`active`) or archived template version so documents already issued from
 * it stay reproducible — changes go into a new draft version instead. */
const CONTENT_FIELDS = [
  "name",
  "code",
  "description",
  "category",
  "sectionsJson",
  "defaultAgendaJson",
  "defaultNoteRowsJson",
] as const;

@Injectable()
export class MomTemplatesService {
  constructor(
    private readonly repository: MomRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  findAll() {
    const scope = this.tenantContext.getOrgScope();
    return this.repository.findTemplates(scope);
  }

  async findOne(id: number) {
    const scope = this.tenantContext.getOrgScope();
    const template = await this.repository.findTemplateById(scope, id);
    if (!template) throw new ResourceNotFoundException("MomTemplate", id);
    return template;
  }

  create(dto: CreateMomTemplateDto) {
    const scope = this.tenantContext.getOrgScope();
    const userId = this.tenantContext.getUserId();
    // Legacy `createMomTemplate` seeded a new template from the official
    // TexaWave template's sections/agenda/notes when none were supplied.
    const code = dto.code?.trim().toUpperCase();
    return this.repository.createTemplate(
      scope,
      {
        ...dto,
        ...(code ? { code } : {}),
        sectionsJson: dto.sectionsJson ?? DEFAULT_MOM_SECTIONS,
        defaultAgendaJson: dto.defaultAgendaJson ?? DEFAULT_MOM_AGENDA,
        defaultNoteRowsJson: dto.defaultNoteRowsJson ?? DEFAULT_MOM_NOTE_ROWS,
      },
      userId,
    );
  }

  async update(id: number, dto: UpdateMomTemplateDto) {
    const existing = await this.findOne(id);
    const touchesContent = CONTENT_FIELDS.some((f) => dto[f] !== undefined);
    if (touchesContent && existing.status !== "draft") {
      throw new InvalidStateTransitionException(
        "MomTemplate",
        existing.status,
        existing.status,
        "published or archived template versions are immutable — create a new version to change them",
      );
    }
    if (dto.isDefault && (dto.status ?? existing.status) !== "active") {
      throw new InvalidStateTransitionException(
        "MomTemplate",
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
    if (!updated) throw new ResourceNotFoundException("MomTemplate", id);
    return updated;
  }

  /** Legacy `publishMomTemplate` — draft → active, locking the version. */
  async publish(id: number) {
    const existing = await this.findOne(id);
    if (existing.status !== "draft") {
      throw new InvalidStateTransitionException(
        "MomTemplate",
        existing.status,
        "active",
      );
    }
    return this.update(id, { status: "active" });
  }

  /** Legacy `duplicateMomTemplate` — an independent draft copy (V1). */
  async duplicate(id: number) {
    const source = await this.findOne(id);
    const scope = this.tenantContext.getOrgScope();
    const userId = this.tenantContext.getUserId();
    const copy = await this.repository.cloneTemplate(
      scope,
      id,
      {
        name: `${source.name} (Copy)`,
        code: source.code ? `${source.code}-COPY` : null,
        version: 1,
      },
      userId,
    );
    if (!copy) throw new ResourceNotFoundException("MomTemplate", id);
    return copy;
  }

  /** Legacy `createNewTemplateVersion` — next version number as a draft,
   * leaving the published version untouched. */
  async createNewVersion(id: number) {
    const source = await this.findOne(id);
    if (source.status === "draft") {
      throw new InvalidStateTransitionException(
        "MomTemplate",
        source.status,
        "new version",
        "edit the draft directly — new versions are created from published templates",
      );
    }
    const scope = this.tenantContext.getOrgScope();
    const userId = this.tenantContext.getUserId();
    const next = await this.repository.cloneTemplate(
      scope,
      id,
      { name: source.name, code: source.code, version: source.version + 1 },
      userId,
    );
    if (!next) throw new ResourceNotFoundException("MomTemplate", id);
    return next;
  }

  async softDelete(id: number) {
    const scope = this.tenantContext.getOrgScope();
    const removed = await this.repository.softDeleteTemplate(scope, id);
    if (!removed) throw new ResourceNotFoundException("MomTemplate", id);
    return { success: true };
  }
}
