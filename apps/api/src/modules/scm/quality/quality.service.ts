import { Injectable } from "@nestjs/common";
import { PaginatedResponseDto } from "../../../common/dto/paginated-response.dto.js";
import {
  ResourceConflictException,
  ResourceNotFoundException,
} from "../../../common/exceptions/business.exception.js";
import { TenantContextService } from "../../../platform/tenancy/tenant-context.service.js";
import { ScmActivityService } from "../common/scm-activity.service.js";
import type {
  CreateDefectDto,
  CreateInspectionDto,
  CreateTemplateDto,
  QueryActivityDto,
  QueryDefectDto,
  QueryInspectionDto,
  QueryQuarantineDto,
  QueryTemplateDto,
  RecordItemResultDto,
  UpdateDefectDto,
  UpdateTemplateDto,
} from "./dto/quality.dto.js";
import { InspectionsRepository } from "./inspections.repository.js";
import { QuarantineRepository } from "./quarantine.repository.js";
import { QualityMastersRepository } from "./quality-masters.repository.js";

export const QUALITY_ENTITY_TYPES = [
  "scm_quality_inspection",
  "scm_quality_defect",
  "scm_quality_template",
  "scm_quarantine",
];

@Injectable()
export class QualityService {
  constructor(
    private readonly masters: QualityMastersRepository,
    private readonly inspections: InspectionsRepository,
    private readonly quarantine: QuarantineRepository,
    private readonly activity: ScmActivityService,
    private readonly tenantContext: TenantContextService,
  ) {}

  private get scope() {
    return this.tenantContext.getOrgScope();
  }
  private get actor() {
    return this.tenantContext.getUserId();
  }
  private nf<T>(what: string, id: number, row: T | null): T {
    if (!row) throw new ResourceNotFoundException(what, id);
    return row;
  }

  // ---- defects ----------------------------------------------------------------

  async listDefects(query: QueryDefectDto) {
    const { items, total } = await this.masters.findDefects(
      this.scope,
      query,
      query,
    );
    return new PaginatedResponseDto(items, total, query.page, query.limit);
  }
  async createDefect(dto: CreateDefectDto) {
    if (await this.masters.findDefectByCode(this.scope, dto.defectCode)) {
      throw new ResourceConflictException(
        `Defect code ${dto.defectCode} already exists.`,
      );
    }
    return this.masters.createDefect(this.scope, dto, this.actor);
  }
  async updateDefect(id: number, dto: UpdateDefectDto) {
    return this.nf(
      "Defect",
      id,
      await this.masters.updateDefect(this.scope, id, dto),
    );
  }

  // ---- templates --------------------------------------------------------------

  async listTemplates(query: QueryTemplateDto) {
    const { items, total } = await this.masters.findTemplates(
      this.scope,
      query,
      query,
    );
    return new PaginatedResponseDto(items, total, query.page, query.limit);
  }
  async getTemplate(id: number) {
    return this.nf(
      "Template",
      id,
      await this.masters.findTemplate(this.scope, id),
    );
  }
  async createTemplate(dto: CreateTemplateDto) {
    if (await this.masters.findTemplateByCode(this.scope, dto.templateCode)) {
      throw new ResourceConflictException(
        `Template code ${dto.templateCode} already exists.`,
      );
    }
    return this.masters.createTemplate(this.scope, dto, this.actor);
  }
  async updateTemplate(id: number, dto: UpdateTemplateDto) {
    return this.nf(
      "Template",
      id,
      await this.masters.updateTemplate(this.scope, id, dto),
    );
  }

  // ---- inspections ------------------------------------------------------------

  async listInspections(query: QueryInspectionDto) {
    const { items, total } = await this.inspections.findMany(
      this.scope,
      query,
      query,
    );
    return new PaginatedResponseDto(items, total, query.page, query.limit);
  }
  async getInspection(id: number) {
    return this.nf(
      "Inspection",
      id,
      await this.inspections.findOne(this.scope, id),
    );
  }
  sources(type: string) {
    return this.inspections.findSources(this.scope, type);
  }
  dashboard() {
    return this.inspections.dashboard(this.scope);
  }
  createInspection(dto: CreateInspectionDto) {
    return this.inspections.create(this.scope, dto, this.actor);
  }
  async startInspection(id: number, inspectorName?: string) {
    return this.nf(
      "Inspection",
      id,
      await this.inspections.start(this.scope, id, inspectorName, this.actor),
    );
  }
  async cancelInspection(id: number, reason: string) {
    return this.nf(
      "Inspection",
      id,
      await this.inspections.cancel(this.scope, id, reason.trim(), this.actor),
    );
  }
  async recordItemResult(id: number, itemId: number, dto: RecordItemResultDto) {
    return this.nf(
      "Inspection line",
      itemId,
      await this.inspections.recordItemResult(this.scope, id, itemId, dto),
    );
  }
  async completeInspection(id: number) {
    return this.nf(
      "Inspection",
      id,
      await this.inspections.complete(this.scope, id, this.actor),
    );
  }

  // ---- quarantine -------------------------------------------------------------

  async listQuarantine(query: QueryQuarantineDto) {
    const { items, total } = await this.quarantine.findMany(
      this.scope,
      query,
      query,
    );
    return new PaginatedResponseDto(items, total, query.page, query.limit);
  }
  async reviewQuarantine(id: number) {
    return this.nf(
      "Quarantine record",
      id,
      await this.quarantine.review(this.scope, id, this.actor),
    );
  }
  async releaseQuarantine(id: number, notes?: string) {
    return this.nf(
      "Quarantine record",
      id,
      await this.quarantine.release(
        this.scope,
        id,
        notes?.trim() || undefined,
        this.actor,
      ),
    );
  }
  async rejectQuarantine(id: number, notes?: string) {
    return this.nf(
      "Quarantine record",
      id,
      await this.quarantine.reject(
        this.scope,
        id,
        notes?.trim() || undefined,
        this.actor,
      ),
    );
  }

  // ---- activity ---------------------------------------------------------------

  listActivity(query: QueryActivityDto) {
    return this.activity.list(QUALITY_ENTITY_TYPES, query, query.q);
  }
}
