import { randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { Prisma } from "@texawave-erp/database";
import { OrgScoped } from "../../../common/decorators/org-scoped.decorator.js";
import type { PaginationDto } from "../../../common/dto/pagination.dto.js";
import type { OrgScope } from "../../../common/tenancy/org-scope.js";
import { tenantWhere } from "../../../common/tenancy/tenant-where.js";
import { AuditWriter } from "../../../platform/audit/audit-writer.js";
import { PrismaService } from "../../../shared/prisma/prisma.service.js";
import type {
  CheckpointDto,
  CreateDefectDto,
  CreateTemplateDto,
  UpdateDefectDto,
  UpdateTemplateDto,
} from "./dto/quality.dto.js";
import { BusinessRuleViolationException } from "../../../common/exceptions/business.exception.js";

const text = (v: string | undefined, cur: string | null) =>
  v === undefined ? cur : v.trim() || null;

/** Stored checkpoint, including the stable id inspections refer to. */
export interface StoredCheckpoint {
  checkpointId: string;
  name: string;
  description: string | null;
  required: boolean;
  expectedValue: string | null;
  unit: string | null;
  sequence: number;
}

function toStoredCheckpoints(list: CheckpointDto[]): StoredCheckpoint[] {
  return list.map((c, idx) => ({
    checkpointId: c.checkpointId ?? `cp_${randomUUID().slice(0, 8)}`,
    name: c.name,
    description: c.description?.trim() || null,
    required: c.required,
    expectedValue: c.expectedValue?.trim() || null,
    unit: c.unit?.trim() || null,
    sequence: idx + 1,
  }));
}

/** Defect master and QC templates. Never hard-deleted — only deactivated, so
 * historical inspections keep a valid reference. */
@Injectable()
export class QualityMastersRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditWriter,
  ) {}

  // ---- defects ----------------------------------------------------------------

  @OrgScoped()
  async findDefects(
    scope: OrgScope,
    f: {
      q?: string | undefined;
      severity?: string | undefined;
      category?: string | undefined;
      active?: boolean | undefined;
    },
    page: PaginationDto,
  ) {
    const where = tenantWhere<Prisma.ScmQualityDefectWhereInput>(scope, {
      ...(f.severity ? { severity: f.severity } : {}),
      ...(f.category ? { category: f.category } : {}),
      ...(f.active !== undefined ? { active: f.active } : {}),
      ...(f.q
        ? {
            OR: [
              { defectCode: { contains: f.q, mode: "insensitive" } },
              { name: { contains: f.q, mode: "insensitive" } },
            ],
          }
        : {}),
    });
    const [items, total] = await Promise.all([
      this.prisma.scmQualityDefect.findMany({
        where,
        skip: page.skip,
        take: page.limit,
        orderBy: [{ defectCode: "asc" }],
      }),
      this.prisma.scmQualityDefect.count({ where }),
    ]);
    return { items, total };
  }

  @OrgScoped()
  findDefectByCode(scope: OrgScope, code: string) {
    return this.prisma.scmQualityDefect.findFirst({
      where: tenantWhere<Prisma.ScmQualityDefectWhereInput>(scope, {
        defectCode: { equals: code, mode: "insensitive" },
      }),
    });
  }

  @OrgScoped()
  async createDefect(scope: OrgScope, dto: CreateDefectDto, actorId: number) {
    return this.prisma.$transaction(async (tx) => {
      const created = await tx.scmQualityDefect.create({
        data: {
          organizationId: scope.organizationId,
          defectCode: dto.defectCode,
          name: dto.name,
          description: text(dto.description, null),
          category: dto.category,
          severity: dto.severity,
          createdBy: actorId,
        },
      });
      await this.audit.write(tx, {
        entityType: "scm_quality_defect",
        entityId: created.id,
        action: "create",
        after: {
          defectCode: dto.defectCode,
          name: dto.name,
          severity: dto.severity,
        },
      });
      return created;
    });
  }

  @OrgScoped()
  async updateDefect(scope: OrgScope, id: number, dto: UpdateDefectDto) {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.scmQualityDefect.findFirst({
        where: tenantWhere(scope, { id }),
      });
      if (!before) return null;
      const after = await tx.scmQualityDefect.update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.description !== undefined
            ? { description: text(dto.description, null) }
            : {}),
          ...(dto.category !== undefined ? { category: dto.category } : {}),
          ...(dto.severity !== undefined ? { severity: dto.severity } : {}),
          ...(dto.active !== undefined ? { active: dto.active } : {}),
        },
      });
      await this.audit.write(tx, {
        entityType: "scm_quality_defect",
        entityId: id,
        action:
          dto.active !== undefined && dto.active !== before.active
            ? "status_change"
            : "update",
        before: {
          name: before.name,
          category: before.category,
          severity: before.severity,
          active: before.active,
        },
        after: {
          name: after.name,
          category: after.category,
          severity: after.severity,
          active: after.active,
        },
      });
      return after;
    });
  }

  // ---- templates --------------------------------------------------------------

  @OrgScoped()
  async findTemplates(
    scope: OrgScope,
    f: {
      q?: string | undefined;
      inspectionType?: string | undefined;
      active?: boolean | undefined;
    },
    page: PaginationDto,
  ) {
    const where = tenantWhere<Prisma.ScmQualityTemplateWhereInput>(scope, {
      ...(f.inspectionType ? { inspectionType: f.inspectionType } : {}),
      ...(f.active !== undefined ? { active: f.active } : {}),
      ...(f.q
        ? {
            OR: [
              { templateCode: { contains: f.q, mode: "insensitive" } },
              { name: { contains: f.q, mode: "insensitive" } },
            ],
          }
        : {}),
    });
    const [items, total] = await Promise.all([
      this.prisma.scmQualityTemplate.findMany({
        where,
        skip: page.skip,
        take: page.limit,
        orderBy: [{ templateCode: "asc" }],
      }),
      this.prisma.scmQualityTemplate.count({ where }),
    ]);
    return { items, total };
  }

  @OrgScoped()
  findTemplate(scope: OrgScope, id: number) {
    return this.prisma.scmQualityTemplate.findFirst({
      where: tenantWhere(scope, { id }),
    });
  }

  @OrgScoped()
  findTemplateByCode(scope: OrgScope, code: string) {
    return this.prisma.scmQualityTemplate.findFirst({
      where: tenantWhere<Prisma.ScmQualityTemplateWhereInput>(scope, {
        templateCode: { equals: code, mode: "insensitive" },
      }),
    });
  }

  @OrgScoped()
  async createTemplate(
    scope: OrgScope,
    dto: CreateTemplateDto,
    actorId: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const created = await tx.scmQualityTemplate.create({
        data: {
          organizationId: scope.organizationId,
          templateCode: dto.templateCode,
          name: dto.name,
          description: text(dto.description, null),
          inspectionType: dto.inspectionType,
          checkpoints: toStoredCheckpoints(
            dto.checkpoints,
          ) as unknown as Prisma.InputJsonValue,
          createdBy: actorId,
        },
      });
      await this.audit.write(tx, {
        entityType: "scm_quality_template",
        entityId: created.id,
        action: "create",
        after: {
          templateCode: dto.templateCode,
          name: dto.name,
          checkpoints: dto.checkpoints.length,
        },
      });
      return created;
    });
  }

  @OrgScoped()
  async updateTemplate(scope: OrgScope, id: number, dto: UpdateTemplateDto) {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.scmQualityTemplate.findFirst({
        where: tenantWhere(scope, { id }),
      });
      if (!before) return null;
      const after = await tx.scmQualityTemplate.update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.description !== undefined
            ? { description: text(dto.description, null) }
            : {}),
          ...(dto.active !== undefined ? { active: dto.active } : {}),
          ...(dto.checkpoints !== undefined
            ? {
                checkpoints: toStoredCheckpoints(
                  dto.checkpoints,
                ) as unknown as Prisma.InputJsonValue,
              }
            : {}),
        },
      });
      await this.audit.write(tx, {
        entityType: "scm_quality_template",
        entityId: id,
        action:
          dto.active !== undefined && dto.active !== before.active
            ? "status_change"
            : "update",
        before: { name: before.name, active: before.active },
        after: { name: after.name, active: after.active },
      });
      return after;
    });
  }

  /** A defect code still referenced by an inspection line, a checkpoint
   * result or a quarantine record is history and cannot be deleted. */
  @OrgScoped()
  async removeDefect(scope: OrgScope, id: number, actorId: number) {
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.scmQualityDefect.findFirst({
        where: tenantWhere(scope, { id }),
      });
      if (!row) return false;
      const code = row.defectCode;
      const [lines, quarantined, checkpoints] = await Promise.all([
        tx.scmQualityInspectionItem.count({ where: { defectCode: code } }),
        tx.scmQuarantineRecord.count({
          where: { defectCode: code, organizationId: scope.organizationId },
        }),
        tx.$queryRaw<
          { n: bigint }[]
        >`SELECT COUNT(*)::bigint AS n FROM scm.quality_inspection_items WHERE checkpoint_results @> ${JSON.stringify([{ defectCode: code }])}::jsonb`,
      ]);
      if (lines > 0 || quarantined > 0 || Number(checkpoints[0]?.n ?? 0) > 0) {
        throw new BusinessRuleViolationException(
          "Cannot delete: this defect code is referenced by existing inspection or quarantine records.",
          "DEFECT_IN_USE",
        );
      }
      await tx.scmQualityDefect.delete({ where: { id } });
      await this.audit.write(tx, {
        entityType: "scm_quality_defect",
        entityId: id,
        action: "delete",
        before: { defectCode: code, by: actorId },
      });
      return true;
    });
  }

  /** A template an inspection was raised from cannot be deleted. */
  @OrgScoped()
  async removeTemplate(scope: OrgScope, id: number, actorId: number) {
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.scmQualityTemplate.findFirst({
        where: tenantWhere(scope, { id }),
      });
      if (!row) return false;
      const used = await tx.scmQualityInspection.count({
        where: { templateId: id, organizationId: scope.organizationId },
      });
      if (used > 0) {
        throw new BusinessRuleViolationException(
          "Cannot delete: this template has been used by one or more inspections.",
          "TEMPLATE_IN_USE",
        );
      }
      await tx.scmQualityTemplate.delete({ where: { id } });
      await this.audit.write(tx, {
        entityType: "scm_quality_template",
        entityId: id,
        action: "delete",
        before: { templateCode: row.templateCode, by: actorId },
      });
      return true;
    });
  }
}
