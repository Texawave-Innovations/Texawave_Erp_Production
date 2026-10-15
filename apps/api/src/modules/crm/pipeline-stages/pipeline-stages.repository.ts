import { Injectable } from "@nestjs/common";
import { OrgScoped } from "../../../common/decorators/org-scoped.decorator.js";
import { BusinessRuleViolationException } from "../../../common/exceptions/business.exception.js";
import { classifyDbError } from "../../../common/database/db-errors.js";
import type { OrgScope } from "../../../common/tenancy/org-scope.js";
import { tenantWhere } from "../../../common/tenancy/tenant-where.js";
import { AuditWriter } from "../../../platform/audit/audit-writer.js";
import { PrismaService } from "../../../shared/prisma/prisma.service.js";
import { ensureSeededStages } from "./seed.js";
import type {
  CreatePipelineStageDto,
  ReorderPipelineStagesDto,
  UpdatePipelineStageDto,
} from "./dto/pipeline-stage.dto.js";

const ENTITY_TYPE = "crm_pipeline_stage";

function slugify(label: string): string {
  const base = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return base || `stage_${Date.now()}`;
}

function snapshot(row: {
  label: string;
  order: number;
  isActive: boolean;
  probability: number | null;
}) {
  return {
    label: row.label,
    order: row.order,
    isActive: row.isActive,
    probability: row.probability,
  };
}

@Injectable()
export class PipelineStagesRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditWriter,
  ) {}

  /** Self-seeds on first call (see seed.ts), then returns every stage for
   * the org ordered the way the board displays them. */
  @OrgScoped()
  async findAll(scope: OrgScope, actorId: number) {
    return this.prisma.$transaction(async (tx) => {
      await ensureSeededStages(tx, scope.organizationId, actorId);
      return tx.pipelineStage.findMany({
        where: tenantWhere(scope, { deletedAt: null }),
        orderBy: { order: "asc" },
      });
    });
  }

  @OrgScoped()
  async findOne(scope: OrgScope, id: number) {
    return this.prisma.pipelineStage.findFirst({
      where: tenantWhere(scope, { id, deletedAt: null }),
    });
  }

  @OrgScoped()
  async create(scope: OrgScope, dto: CreatePipelineStageDto, actorId: number) {
    return this.prisma.$transaction(async (tx) => {
      const count = await tx.pipelineStage.count({
        where: { organizationId: scope.organizationId, deletedAt: null },
      });
      const order = dto.order ?? count + 1;
      const baseCode = slugify(dto.label);
      let code = baseCode;
      let created;
      try {
        created = await tx.pipelineStage.create({
          data: {
            organizationId: scope.organizationId,
            code,
            label: dto.label,
            order,
            probability: dto.probability ?? null,
            slaDays: dto.slaDays ?? 7,
            createdBy: actorId,
            updatedBy: actorId,
          },
        });
      } catch (error) {
        if (classifyDbError(error)?.kind !== "unique") throw error;
        // Same collision-retry as legacy's runTransaction-on-the-slug
        // fallback: the slug is already taken (e.g. a seeded stage like
        // "follow_up", or a race with another create), so suffix it with
        // a timestamp instead of failing the request.
        code = `${baseCode}_${Date.now()}`;
        created = await tx.pipelineStage.create({
          data: {
            organizationId: scope.organizationId,
            code,
            label: dto.label,
            order,
            probability: dto.probability ?? null,
            slaDays: dto.slaDays ?? 7,
            createdBy: actorId,
            updatedBy: actorId,
          },
        });
      }
      await this.audit.write(tx, {
        entityType: ENTITY_TYPE,
        entityId: created.id,
        action: "create",
        after: snapshot(created),
      });
      return created;
    });
  }

  @OrgScoped()
  async update(
    scope: OrgScope,
    id: number,
    dto: UpdatePipelineStageDto,
    actorId: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.pipelineStage.findFirst({
        where: tenantWhere(scope, { id, deletedAt: null }),
      });
      if (!before) return null;
      const after = await tx.pipelineStage.update({
        where: { id },
        data: {
          label: dto.label ?? before.label,
          order: dto.order ?? before.order,
          probability:
            dto.probability === undefined
              ? before.probability
              : dto.probability,
          slaDays: dto.slaDays === undefined ? before.slaDays : dto.slaDays,
          isActive: dto.isActive ?? before.isActive,
          updatedBy: actorId,
        },
      });
      await this.audit.write(tx, {
        entityType: ENTITY_TYPE,
        entityId: id,
        action: "update",
        before: snapshot(before),
        after: snapshot(after),
      });
      return after;
    });
  }

  /** Claims every id atomically inside one transaction, validating each
   * belongs to the caller's org before reassigning `order` — a stray or
   * cross-org id in the list fails the whole reorder instead of silently
   * reindexing a partial list. */
  @OrgScoped()
  async reorder(
    scope: OrgScope,
    dto: ReorderPipelineStagesDto,
    actorId: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const totalCount = await tx.pipelineStage.count({
        where: tenantWhere(scope, { deletedAt: null }),
      });
      const rows = await tx.pipelineStage.findMany({
        where: tenantWhere(scope, {
          id: { in: dto.orderedIds },
          deletedAt: null,
        }),
        select: { id: true },
      });
      // `rows.length !== dto.orderedIds.length` catches a stray/cross-org/
      // duplicated id (an `IN` filter collapses duplicates, so repeating
      // one id de-matches the count). `rows.length !== totalCount` catches
      // a short list that omits a stage that still needs its order
      // reassigned.
      if (rows.length !== dto.orderedIds.length || rows.length !== totalCount) {
        throw new BusinessRuleViolationException(
          "orderedIds must list every active stage id for this organization exactly once",
          "INVALID_STAGE_SET",
        );
      }
      await Promise.all(
        dto.orderedIds.map((id, index) =>
          tx.pipelineStage.update({
            where: { id },
            data: { order: index + 1, updatedBy: actorId },
          }),
        ),
      );
      return tx.pipelineStage.findMany({
        where: tenantWhere(scope, { deletedAt: null }),
        orderBy: { order: "asc" },
      });
    });
  }

  /** Soft-delete only. Refuses (matching legacy exactly, including the
   * message shape) when any non-deleted Opportunity currently occupies
   * the stage — the DB's own `ON DELETE RESTRICT` on
   * `opportunities.stage_id` only protects a hard delete, which this app
   * never performs, so the count check here is the real enforcement. */
  @OrgScoped()
  async softDelete(scope: OrgScope, id: number, actorId: number) {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.pipelineStage.findFirst({
        where: tenantWhere(scope, { id, deletedAt: null }),
      });
      if (!before) return null;
      const opportunitiesInStage = await tx.opportunity.count({
        where: { stageId: id, deletedAt: null },
      });
      if (opportunitiesInStage > 0) {
        throw new BusinessRuleViolationException(
          `Can't delete "${before.label}" — ${opportunitiesInStage} opportunit${opportunitiesInStage === 1 ? "y is" : "ies are"} currently in this stage. Move them first.`,
          "STAGE_IN_USE",
        );
      }
      const after = await tx.pipelineStage.update({
        where: { id },
        data: { deletedAt: new Date(), isActive: false, updatedBy: actorId },
      });
      await this.audit.write(tx, {
        entityType: ENTITY_TYPE,
        entityId: id,
        action: "delete",
        before: snapshot(before),
        after: snapshot(after),
      });
      return after;
    });
  }
}
