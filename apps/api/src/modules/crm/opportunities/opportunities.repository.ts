import { classifyDbError } from "../../../common/database/db-errors.js";
import type { OrgScope } from "../../../common/tenancy/org-scope.js";
import { tenantWhere } from "../../../common/tenancy/tenant-where.js";
import { OrgScoped } from "../../../common/decorators/org-scoped.decorator.js";
import { Injectable } from "@nestjs/common";
import { Prisma } from "@texawave-erp/database";
import { TeamScoped } from "../../../common/decorators/team-scoped.decorator.js";
import type { PaginationDto } from "../../../common/dto/pagination.dto.js";
import {
  BusinessRuleViolationException,
  ResourceConflictException,
} from "../../../common/exceptions/business.exception.js";
import type { TeamScope } from "../../../common/tenancy/team-scope.js";
import { teamWhere } from "../../../common/tenancy/team-where.js";
import { AuditWriter } from "../../../platform/audit/audit-writer.js";
import { PrismaService } from "../../../shared/prisma/prisma.service.js";
import { userNamesByIds } from "../shared/actor-names.js";
import type {
  ChangeStageDto,
  CreateOpportunityDto,
  MarkLostDto,
  MarkWonDto,
  ReopenDto,
  SetOnHoldDto,
  SetStuckReasonDto,
  UpdateOpportunityDto,
} from "./dto/opportunity.dto.js";

const ENTITY_TYPE = "crm_opportunity";

/** Opportunity owns its own `teamId`/`createdBy` directly, same shape as
 * Contact/Lead. */
const SCOPE_FIELDS = { ownerField: "createdBy" };
const INCLUDE = {
  account: { select: { id: true, name: true } },
  contact: { select: { id: true, name: true } },
  stage: true,
} satisfies Prisma.OpportunityInclude;
type OpportunityRow = Prisma.OpportunityGetPayload<{ include: typeof INCLUDE }>;

export interface OpportunityFilter {
  q?: string | undefined;
  accountId?: number | undefined;
  stageId?: number | undefined;
  status?: string | undefined;
}

function snapshot(
  row: Pick<
    OpportunityRow,
    "title" | "ownerName" | "stageId" | "status" | "estimatedValue" | "isActive"
  >,
) {
  return {
    title: row.title,
    ownerName: row.ownerName,
    stageId: row.stageId,
    status: row.status,
    estimatedValue: row.estimatedValue.toString(),
    isActive: row.isActive,
  };
}

function filterWhere(filter: OpportunityFilter): Prisma.OpportunityWhereInput {
  const clauses: Prisma.OpportunityWhereInput[] = [{ deletedAt: null }];
  if (filter.accountId !== undefined)
    clauses.push({ accountId: filter.accountId });
  if (filter.stageId !== undefined) clauses.push({ stageId: filter.stageId });
  if (filter.status) clauses.push({ status: filter.status });
  if (filter.q) {
    clauses.push({
      OR: [
        { title: { contains: filter.q, mode: "insensitive" } },
        { ownerName: { contains: filter.q, mode: "insensitive" } },
        { opportunityNumber: { contains: filter.q, mode: "insensitive" } },
        { account: { name: { contains: filter.q, mode: "insensitive" } } },
      ],
    });
  }
  return { AND: clauses };
}

/** Appends an immutable stage-history row (DB-trigger-enforced append-only
 * — see the migration's `opportunity_stage_history_no_update_delete`
 * trigger). Always called from inside the caller's own transaction so the
 * live record's stage/status and this history entry land together. */
async function appendStageHistory(
  tx: Prisma.TransactionClient,
  organizationId: number,
  opportunityId: number,
  fromStageId: number | null,
  toStageId: number,
  changedBy: number,
  remarks?: string | null,
) {
  await tx.opportunityStageHistory.create({
    data: {
      organizationId,
      opportunityId,
      fromStageId,
      toStageId,
      changedBy,
      remarks: remarks ?? null,
    },
  });
}

/** Validates a stage id belongs to the caller's org and returns it —
 * every action that moves an opportunity to an explicit stage (create,
 * change-stage, reopen) needs this; won/lost/on-hold resolve their own
 * fixed stage by flag instead (see `resolveFlagStage`). */
async function requireStage(
  tx: Prisma.TransactionClient,
  organizationId: number,
  stageId: number,
) {
  const stage = await tx.pipelineStage.findFirst({
    where: { id: stageId, organizationId, deletedAt: null },
  });
  if (!stage) {
    throw new BusinessRuleViolationException(
      `Stage ${stageId} does not exist in this organization`,
      "INVALID_STAGE",
    );
  }
  return stage;
}

/** Resolves the org's single Won/Lost/On-Hold marker stage (the seeded
 * `won`/`lost`/`on_hold` codes, or whichever stage an admin has since
 * flagged) — these three actions move to a fixed destination, never a
 * caller-chosen one. */
async function resolveFlagStage(
  tx: Prisma.TransactionClient,
  organizationId: number,
  flag: "isWon" | "isLost" | "isOnHold",
) {
  const stage = await tx.pipelineStage.findFirst({
    where: { organizationId, deletedAt: null, [flag]: true },
  });
  if (!stage) {
    throw new BusinessRuleViolationException(
      `No pipeline stage is flagged ${flag} for this organization`,
      "MISSING_FLAG_STAGE",
    );
  }
  return stage;
}

@Injectable()
export class OpportunitiesRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditWriter,
  ) {}

  @TeamScoped()
  async findMany(
    scope: TeamScope,
    filter: OpportunityFilter,
    pagination: PaginationDto,
  ) {
    const where = teamWhere(scope, filterWhere(filter), SCOPE_FIELDS);
    const [items, total] = await Promise.all([
      this.prisma.opportunity.findMany({
        where,
        include: INCLUDE,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: [{ createdAt: pagination.order ?? "desc" }, { id: "asc" }],
      }),
      this.prisma.opportunity.count({ where }),
    ]);
    return { items, total };
  }

  @TeamScoped()
  async findOne(scope: TeamScope, id: number) {
    return this.prisma.opportunity.findFirst({
      where: teamWhere(scope, { id, deletedAt: null }, SCOPE_FIELDS),
      include: INCLUDE,
    });
  }

  @TeamScoped()
  async findStageHistory(scope: TeamScope, opportunityId: number) {
    const owned = await this.prisma.opportunity.findFirst({
      where: teamWhere(
        scope,
        { id: opportunityId, deletedAt: null },
        SCOPE_FIELDS,
      ),
      select: { id: true },
    });
    if (!owned) return null;
    const rows = await this.prisma.opportunityStageHistory.findMany({
      where: { opportunityId },
      include: { fromStage: true, toStage: true },
      orderBy: { changedAt: "desc" },
    });
    const names = await userNamesByIds(
      this.prisma,
      scope.organizationId,
      rows.map((r) => r.changedBy),
    );
    return rows.map((r) => ({
      ...r,
      changedByName: r.changedBy ? (names.get(r.changedBy) ?? null) : null,
    }));
  }

  @TeamScoped()
  async create(scope: TeamScope, dto: CreateOpportunityDto, actorId: number) {
    return this.prisma.$transaction(async (tx) => {
      const account = await tx.account.findFirst({
        where: {
          id: dto.accountId,
          organizationId: scope.organizationId,
          deletedAt: null,
        },
        select: { id: true },
      });
      if (!account) {
        throw new BusinessRuleViolationException(
          `Account ${dto.accountId} does not exist in this organization`,
          "INVALID_ACCOUNT",
        );
      }
      if (dto.contactId !== undefined) {
        const contact = await tx.contact.findFirst({
          where: {
            id: dto.contactId,
            organizationId: scope.organizationId,
            deletedAt: null,
          },
          select: { id: true },
        });
        if (!contact) {
          throw new BusinessRuleViolationException(
            `Contact ${dto.contactId} does not exist in this organization`,
            "INVALID_CONTACT",
          );
        }
      }
      await requireStage(tx, scope.organizationId, dto.stageId);

      const created = await tx.opportunity.create({
        data: {
          organizationId: scope.organizationId,
          teamId: scope.level === "team" ? (scope.teamIds[0] ?? null) : null,
          accountId: dto.accountId,
          contactId: dto.contactId ?? null,
          title: dto.title,
          ownerName: dto.ownerName,
          stageId: dto.stageId,
          estimatedValue: dto.estimatedValue,
          currency: dto.currency ?? "INR",
          expectedCloseDate: dto.expectedCloseDate
            ? new Date(dto.expectedCloseDate)
            : null,
          priority: dto.priority ?? null,
          probability: dto.probability ?? null,
          nextAction: dto.nextAction || null,
          nextActionDate: dto.nextActionDate
            ? new Date(dto.nextActionDate)
            : null,
          campaignSource: dto.campaignSource ?? null,
          contactRole: dto.contactRole ?? null,
          forecastCategory: dto.forecastCategory ?? null,
          // Placeholder — overwritten below once the real id is known
          // (legacy derives the number from the Firebase push id's own
          // last 6 chars, created in the same call; the int-id equivalent
          // needs the row to exist first).
          opportunityNumber: "PENDING",
          createdBy: actorId,
          updatedBy: actorId,
        },
        include: INCLUDE,
      });
      const numbered = await tx.opportunity.update({
        where: { id: created.id },
        data: {
          opportunityNumber: `OPP-${String(created.id).padStart(6, "0")}`,
        },
        include: INCLUDE,
      });
      await appendStageHistory(
        tx,
        scope.organizationId,
        created.id,
        null,
        dto.stageId,
        actorId,
        "Opportunity created",
      );
      await this.audit.write(tx, {
        entityType: ENTITY_TYPE,
        entityId: numbered.id,
        action: "create",
        after: snapshot(numbered),
      });
      return numbered;
    });
  }

  @TeamScoped()
  async update(
    scope: TeamScope,
    id: number,
    dto: UpdateOpportunityDto,
    actorId: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.opportunity.findFirst({
        where: teamWhere(scope, { id, deletedAt: null }, SCOPE_FIELDS),
        include: INCLUDE,
      });
      if (!before) return null;
      if (dto.accountId !== undefined && dto.accountId !== before.accountId) {
        const account = await tx.account.findFirst({
          where: {
            id: dto.accountId,
            organizationId: scope.organizationId,
            deletedAt: null,
          },
          select: { id: true },
        });
        if (!account) {
          throw new BusinessRuleViolationException(
            `Account ${dto.accountId} does not exist in this organization`,
            "INVALID_ACCOUNT",
          );
        }
      }
      if (dto.contactId !== undefined && dto.contactId !== before.contactId) {
        const contact = await tx.contact.findFirst({
          where: {
            id: dto.contactId,
            organizationId: scope.organizationId,
            deletedAt: null,
          },
          select: { id: true },
        });
        if (!contact) {
          throw new BusinessRuleViolationException(
            `Contact ${dto.contactId} does not exist in this organization`,
            "INVALID_CONTACT",
          );
        }
      }
      const after = await tx.opportunity.update({
        where: { id },
        data: {
          accountId: dto.accountId ?? before.accountId,
          contactId:
            dto.contactId === undefined ? before.contactId : dto.contactId,
          title: dto.title ?? before.title,
          ownerName: dto.ownerName ?? before.ownerName,
          estimatedValue: dto.estimatedValue ?? before.estimatedValue,
          currency:
            dto.currency === undefined ? before.currency : dto.currency || null,
          expectedCloseDate:
            dto.expectedCloseDate === undefined
              ? before.expectedCloseDate
              : dto.expectedCloseDate
                ? new Date(dto.expectedCloseDate)
                : null,
          priority:
            dto.priority === undefined ? before.priority : dto.priority || null,
          probability:
            dto.probability === undefined
              ? before.probability
              : dto.probability,
          nextAction:
            dto.nextAction === undefined
              ? before.nextAction
              : dto.nextAction || null,
          nextActionDate:
            dto.nextActionDate === undefined
              ? before.nextActionDate
              : dto.nextActionDate
                ? new Date(dto.nextActionDate)
                : null,
          campaignSource:
            dto.campaignSource === undefined
              ? before.campaignSource
              : dto.campaignSource || null,
          contactRole:
            dto.contactRole === undefined
              ? before.contactRole
              : dto.contactRole || null,
          forecastCategory:
            dto.forecastCategory === undefined
              ? before.forecastCategory
              : dto.forecastCategory || null,
          updatedBy: actorId,
        },
        include: INCLUDE,
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

  /** No-op if already in the target stage, matching legacy's
   * `changeCrmOpportunityStage` early return. */
  @TeamScoped()
  async changeStage(
    scope: TeamScope,
    id: number,
    dto: ChangeStageDto,
    actorId: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.opportunity.findFirst({
        where: teamWhere(scope, { id, deletedAt: null }, SCOPE_FIELDS),
        include: INCLUDE,
      });
      if (!before) return null;
      if (before.stageId === dto.stageId) return before;
      await requireStage(tx, scope.organizationId, dto.stageId);
      const now = new Date();
      const after = await tx.opportunity.update({
        where: { id },
        data: {
          stageId: dto.stageId,
          stageEnteredAt: now,
          lastActivityAt: now,
          updatedBy: actorId,
        },
        include: INCLUDE,
      });
      await appendStageHistory(
        tx,
        scope.organizationId,
        id,
        before.stageId,
        dto.stageId,
        actorId,
        dto.remarks,
      );
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

  @TeamScoped()
  async markWon(
    scope: TeamScope,
    id: number,
    dto: MarkWonDto,
    actorId: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.opportunity.findFirst({
        where: teamWhere(scope, { id, deletedAt: null }, SCOPE_FIELDS),
        include: INCLUDE,
      });
      if (!before) return null;
      const wonStage = await resolveFlagStage(
        tx,
        scope.organizationId,
        "isWon",
      );
      const now = new Date();
      const after = await tx.opportunity.update({
        where: { id },
        data: {
          status: "WON",
          stageId: wonStage.id,
          stageEnteredAt: now,
          wonAt: now,
          closingAmount: dto.closingAmount ?? before.estimatedValue,
          closingDate: dto.closingDate
            ? new Date(dto.closingDate)
            : before.expectedCloseDate,
          updatedBy: actorId,
        },
        include: INCLUDE,
      });
      await appendStageHistory(
        tx,
        scope.organizationId,
        id,
        before.stageId,
        wonStage.id,
        actorId,
        dto.remarks || "Marked Won",
      );
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

  @TeamScoped()
  async markLost(
    scope: TeamScope,
    id: number,
    dto: MarkLostDto,
    actorId: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.opportunity.findFirst({
        where: teamWhere(scope, { id, deletedAt: null }, SCOPE_FIELDS),
        include: INCLUDE,
      });
      if (!before) return null;
      const lostStage = await resolveFlagStage(
        tx,
        scope.organizationId,
        "isLost",
      );
      const now = new Date();
      const after = await tx.opportunity.update({
        where: { id },
        data: {
          status: "LOST",
          stageId: lostStage.id,
          stageEnteredAt: now,
          lostReason: dto.reason,
          lostReasonOther: dto.reasonOther ?? null,
          lostAt: now,
          competitor: dto.competitor ?? before.competitor,
          updatedBy: actorId,
        },
        include: INCLUDE,
      });
      await appendStageHistory(
        tx,
        scope.organizationId,
        id,
        before.stageId,
        lostStage.id,
        actorId,
        dto.remarks || `Marked Lost — ${dto.reason}`,
      );
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

  /**
   * Matches legacy's `setCrmOpportunityOnHold` exactly, including the
   * observed quirk that the live `stageId` is NOT changed to the on-hold
   * stage — only `status`/hold fields move. The stage-history entry still
   * records a transition to the on-hold stage (legacy's own
   * `appendStageHistory(id, fromStage, 'on_hold', ...)` does this too),
   * so the live record and its own history can show a different "stage"
   * for an on-hold deal. This is reproduced as observed, not corrected.
   */
  @TeamScoped()
  async setOnHold(
    scope: TeamScope,
    id: number,
    dto: SetOnHoldDto,
    actorId: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.opportunity.findFirst({
        where: teamWhere(scope, { id, deletedAt: null }, SCOPE_FIELDS),
        include: INCLUDE,
      });
      if (!before) return null;
      const onHoldStage = await resolveFlagStage(
        tx,
        scope.organizationId,
        "isOnHold",
      );
      const now = new Date();
      const after = await tx.opportunity.update({
        where: { id },
        data: {
          status: "ON_HOLD",
          holdReason: dto.reason,
          holdReasonOther: dto.reasonOther ?? null,
          expectedResumeDate: dto.expectedResumeDate
            ? new Date(dto.expectedResumeDate)
            : null,
          holdNotes: dto.notes ?? null,
          onHoldAt: now,
          updatedBy: actorId,
        },
        include: INCLUDE,
      });
      await appendStageHistory(
        tx,
        scope.organizationId,
        id,
        before.stageId,
        onHoldStage.id,
        actorId,
        dto.notes || `Put On Hold — ${dto.reason}`,
      );
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

  /** Reopens a Won/Lost/On-Hold opportunity back to OPEN in the given
   * stage, clearing every hold/lost/stuck detail field — matches legacy's
   * `reopenCrmOpportunity` (used for both the generic Reopen action and
   * On-Hold's Resume action). */
  @TeamScoped()
  async reopen(scope: TeamScope, id: number, dto: ReopenDto, actorId: number) {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.opportunity.findFirst({
        where: teamWhere(scope, { id, deletedAt: null }, SCOPE_FIELDS),
        include: INCLUDE,
      });
      if (!before) return null;
      await requireStage(tx, scope.organizationId, dto.stageId);
      const now = new Date();
      const after = await tx.opportunity.update({
        where: { id },
        data: {
          status: "OPEN",
          stageId: dto.stageId,
          stageEnteredAt: now,
          resumedAt: now,
          lostReason: null,
          lostReasonOther: null,
          holdReason: null,
          holdReasonOther: null,
          expectedResumeDate: null,
          holdNotes: null,
          stuckReason: null,
          stuckReasonOther: null,
          updatedBy: actorId,
        },
        include: INCLUDE,
      });
      await appendStageHistory(
        tx,
        scope.organizationId,
        id,
        before.stageId,
        dto.stageId,
        actorId,
        "Reopened",
      );
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

  /** Plain field update, no stage-history entry — matches legacy's
   * `setCrmOpportunityStuckReason` exactly (it never touches history). */
  @TeamScoped()
  async setStuckReason(
    scope: TeamScope,
    id: number,
    dto: SetStuckReasonDto,
    actorId: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.opportunity.findFirst({
        where: teamWhere(scope, { id, deletedAt: null }, SCOPE_FIELDS),
      });
      if (!before) return null;
      const after = await tx.opportunity.update({
        where: { id },
        data: {
          stuckReason: dto.reason,
          stuckReasonOther: dto.reasonOther ?? null,
          updatedBy: actorId,
        },
        include: INCLUDE,
      });
      return after;
    });
  }

  /** Soft-delete only. Legacy cascades into Activities/Meetings/Follow-ups/
   * Quotations too — none of those exist in production yet, so this is
   * just the Opportunity row itself; extend when those entities land. */
  @TeamScoped()
  async softDelete(scope: TeamScope, id: number, actorId: number) {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.opportunity.findFirst({
        where: teamWhere(scope, { id, deletedAt: null }, SCOPE_FIELDS),
        include: INCLUDE,
      });
      if (!before) return null;
      const after = await tx.opportunity.update({
        where: { id },
        data: { deletedAt: new Date(), isActive: false, updatedBy: actorId },
        include: INCLUDE,
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

  /** Recycle Bin: this organization's soft-deleted rows, newest deletion first. */
  @OrgScoped()
  async findDeleted(scope: OrgScope) {
    return this.prisma.opportunity.findMany({
      where: tenantWhere(scope, { deletedAt: { not: null } }),
      orderBy: [{ deletedAt: "desc" }, { id: "desc" }],
      take: 2000,
    });
  }

  /** Recycle Bin restore: clears `deletedAt`. Returns null when the row is not in the bin. */
  @OrgScoped()
  async restoreDeleted(scope: OrgScope, id: number, actorId: number) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const before = await tx.opportunity.findFirst({
          where: tenantWhere(scope, { id, deletedAt: { not: null } }),
        });
        if (!before || !before.deletedAt) return null;
        const parent = await tx.account.findFirst({
          where: { id: before.accountId, organizationId: scope.organizationId },
          select: { deletedAt: true },
        });
        if (parent?.deletedAt) {
          throw new BusinessRuleViolationException(
            "Restore the parent account first - it is still in the Recycle Bin.",
            "PARENT_DELETED",
          );
        }
        const after = await tx.opportunity.update({
          where: { id },
          data: { deletedAt: null, isActive: true, updatedBy: actorId },
        });
        await this.audit.write(tx, {
          entityType: ENTITY_TYPE,
          entityId: id,
          action: "restore",
          before: { deletedAt: before.deletedAt },
          after: { deletedAt: null },
        });
        return after;
      });
    } catch (error) {
      if (classifyDbError(error)?.kind === "unique") {
        throw new ResourceConflictException(
          "A live record with the same unique value already exists, so this one can't be restored",
        );
      }
      throw error;
    }
  }

  /** Recycle Bin permanent delete: irreversible hard delete of a soft-deleted row. FK-safe: rows the record owns are removed, nullable references to it are cleared, and anything else still referencing it aborts with STILL_REFERENCED. Returns null when the row is not in the bin. */
  @OrgScoped()
  async purgeDeleted(scope: OrgScope, id: number) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const before = await tx.opportunity.findFirst({
          where: tenantWhere(scope, { id, deletedAt: { not: null } }),
        });
        if (!before) return null;
        const org = scope.organizationId;
        await tx.lead.updateMany({
          where: { linkedOpportunityId: id, organizationId: org },
          data: { linkedOpportunityId: null },
        });
        await tx.quotation.updateMany({
          where: { opportunityId: id, organizationId: org },
          data: { opportunityId: null },
        });
        const historyCount = await tx.opportunityStageHistory.count({
          where: { opportunityId: id, organizationId: org },
        });
        if (historyCount > 0) {
          throw new BusinessRuleViolationException(
            "A deal keeps an append-only stage history, so it cannot be permanently deleted",
            "HAS_IMMUTABLE_HISTORY",
          );
        }
        await tx.opportunityProduct.deleteMany({
          where: { opportunityId: id, organizationId: org },
        });
        await tx.opportunity.delete({ where: { id } });
        await this.audit.write(tx, {
          entityType: ENTITY_TYPE,
          entityId: id,
          action: "purge",
          before: { deletedAt: before.deletedAt },
        });
        return before;
      });
    } catch (error) {
      if (classifyDbError(error)?.kind === "foreign_key") {
        throw new BusinessRuleViolationException(
          "This record is still referenced by other records and can't be permanently deleted",
          "STILL_REFERENCED",
        );
      }
      throw error;
    }
  }
}

export { requireStage, resolveFlagStage, appendStageHistory };
