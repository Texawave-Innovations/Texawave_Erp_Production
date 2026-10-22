import { Injectable } from "@nestjs/common";
import { Prisma } from "@texawave-erp/database";
import { OrgScoped } from "../../../common/decorators/org-scoped.decorator.js";
import type { PaginationDto } from "../../../common/dto/pagination.dto.js";
import {
  ResourceConflictException,
  BusinessRuleViolationException,
} from "../../../common/exceptions/business.exception.js";
import { classifyDbError } from "../../../common/database/db-errors.js";
import type { OrgScope } from "../../../common/tenancy/org-scope.js";
import { tenantWhere } from "../../../common/tenancy/tenant-where.js";
import { AuditWriter } from "../../../platform/audit/audit-writer.js";
import { PrismaService } from "../../../shared/prisma/prisma.service.js";
import { attachActorNames, userNamesByIds } from "../shared/actor-names.js";
import { accountRollupWhere } from "../shared/related-entity.js";
import type {
  AccountPriority,
  AccountTemperature,
  ChangeAccountStatusTagDto,
  CreateAccountDto,
  UpdateAccountDto,
} from "./dto/account.dto.js";

const ENTITY_TYPE = "crm_account";

export interface AccountFilter {
  search?: string | undefined;
  statusTag?: string | undefined;
  priority?: string | undefined;
  temperature?: string | undefined;
}

function snapshot(row: {
  name: string;
  isActive: boolean;
  statusTag: string | null;
  priority?: string | null;
  temperature?: string | null;
}) {
  return {
    name: row.name,
    isActive: row.isActive,
    statusTag: row.statusTag,
    priority: row.priority ?? null,
    temperature: row.temperature ?? null,
  };
}

const CUSTOM_FIELD_KEY = /^[A-Za-z0-9_-]{1,80}$/;

/** Merges incoming custom-field values into the stored JSON: only string
 * values under well-formed keys are kept; an empty string clears the key. */
function mergeCustomFields(
  existing: Prisma.JsonValue | null | undefined,
  incoming: Record<string, unknown>,
): Prisma.InputJsonObject {
  const out: Record<string, string> = {};
  if (existing && typeof existing === "object" && !Array.isArray(existing)) {
    for (const [k, v] of Object.entries(existing)) {
      if (typeof v === "string") out[k] = v;
    }
  }
  for (const [k, v] of Object.entries(incoming)) {
    if (!CUSTOM_FIELD_KEY.test(k) || typeof v !== "string") continue;
    const value = v.trim().slice(0, 2000);
    if (value) out[k] = value;
    else delete out[k];
  }
  return out;
}

function writeFields(dto: CreateAccountDto | UpdateAccountDto) {
  return {
    accountType: dto.accountType,
    ownerName: dto.ownerName,
    industry: dto.industry,
    hq: dto.hq,
    priority: dto.priority,
    temperature: dto.temperature,
    website: dto.website,
    phone: dto.phone,
    email: dto.email,
    linkedin: dto.linkedin,
    registrationNumber: dto.registrationNumber,
    numberOfEmployees: dto.numberOfEmployees,
    annualRevenue: dto.annualRevenue,
    description: dto.description,
    billingStreet: dto.billingStreet,
    billingCity: dto.billingCity,
    billingState: dto.billingState,
    billingPostalCode: dto.billingPostalCode,
    billingCountry: dto.billingCountry,
    shippingStreet: dto.shippingStreet,
    shippingCity: dto.shippingCity,
    shippingState: dto.shippingState,
    shippingPostalCode: dto.shippingPostalCode,
    shippingCountry: dto.shippingCountry,
    customerCategory: dto.customerCategory,
    customerClass: dto.customerClass,
    businessType: dto.businessType,
    resellerType: dto.resellerType,
    tags: dto.tags,
  };
}

@Injectable()
export class AccountsRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditWriter,
  ) {}

  @OrgScoped()
  async findMany(
    scope: OrgScope,
    filter: AccountFilter,
    pagination: PaginationDto,
  ) {
    const clauses: Prisma.AccountWhereInput[] = [{ deletedAt: null }];
    if (filter.search) {
      clauses.push({
        OR: [
          { name: { contains: filter.search, mode: "insensitive" } },
          { industry: { contains: filter.search, mode: "insensitive" } },
          { ownerName: { contains: filter.search, mode: "insensitive" } },
          { email: { contains: filter.search, mode: "insensitive" } },
        ],
      });
    }
    if (filter.statusTag) clauses.push({ statusTag: filter.statusTag });
    if (filter.priority) clauses.push({ priority: filter.priority });
    if (filter.temperature) clauses.push({ temperature: filter.temperature });
    const where = tenantWhere<Prisma.AccountWhereInput>(scope, {
      AND: clauses,
    });
    const [rows, total] = await Promise.all([
      this.prisma.account.findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: [{ name: pagination.order ?? "asc" }, { id: "asc" }],
      }),
      this.prisma.account.count({ where }),
    ]);
    const items = await attachActorNames(
      this.prisma,
      scope.organizationId,
      rows,
    );
    return { items, total };
  }

  /** Global-search lookup (additive): name/email/phone/owner substring. */
  @OrgScoped()
  async search(scope: OrgScope, q: string, limit: number) {
    return this.prisma.account.findMany({
      where: tenantWhere<Prisma.AccountWhereInput>(scope, {
        deletedAt: null,
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
          { phone: { contains: q, mode: "insensitive" } },
          { ownerName: { contains: q, mode: "insensitive" } },
        ],
      }),
      select: { id: true, name: true, ownerName: true },
      orderBy: [{ name: "asc" }, { id: "asc" }],
      take: limit,
    });
  }

  /** id -> name lookup for cross-entity labels (search / calendar). */
  @OrgScoped()
  async namesByIds(scope: OrgScope, ids: number[]) {
    if (ids.length === 0) return [];
    return this.prisma.account.findMany({
      where: tenantWhere<Prisma.AccountWhereInput>(scope, {
        id: { in: ids },
        deletedAt: null,
      }),
      select: { id: true, name: true },
    });
  }

  @OrgScoped()
  async findOne(scope: OrgScope, id: number) {
    const row = await this.prisma.account.findFirst({
      where: tenantWhere(scope, { id, deletedAt: null }),
    });
    if (!row) return null;
    const [withNames] = await attachActorNames(
      this.prisma,
      scope.organizationId,
      [row],
    );
    return withNames ?? null;
  }

  @OrgScoped()
  async create(scope: OrgScope, dto: CreateAccountDto, actorId: number) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const fields = writeFields(dto);
        const nullableFields = Object.fromEntries(
          Object.entries(fields).map(([key, value]) => [key, value ?? null]),
        );
        const created = await tx.account.create({
          data: {
            organizationId: scope.organizationId,
            name: dto.name,
            ...nullableFields,
            tags: dto.tags ?? [],
            ...(dto.customFields
              ? { customFields: mergeCustomFields(null, dto.customFields) }
              : {}),
            createdBy: actorId,
            updatedBy: actorId,
          },
        });
        await this.audit.write(tx, {
          entityType: ENTITY_TYPE,
          entityId: created.id,
          action: "create",
          after: snapshot(created),
        });
        return created;
      });
    } catch (error) {
      throw this.asConflict(error);
    }
  }

  @OrgScoped()
  async update(
    scope: OrgScope,
    id: number,
    dto: UpdateAccountDto,
    actorId: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.account.findFirst({
        where: tenantWhere(scope, { id, deletedAt: null }),
      });
      if (!before) return null;
      const fields = writeFields(dto);
      const data: Prisma.AccountUpdateInput = {
        name: dto.name ?? before.name,
        updatedBy: actorId,
      };
      for (const [key, value] of Object.entries(fields)) {
        if (value !== undefined) (data as Record<string, unknown>)[key] = value;
      }
      if (dto.customFields) {
        data.customFields = mergeCustomFields(
          before.customFields,
          dto.customFields,
        );
      }
      const after = await tx.account.update({ where: { id }, data });
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

  /** Legacy setCrmPriority: writes the chip value and an audit entry
   * (priority_changed) the Timeline reads back. */
  @OrgScoped()
  async changePriority(
    scope: OrgScope,
    id: number,
    priority: AccountPriority,
    actorId: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.account.findFirst({
        where: tenantWhere(scope, { id, deletedAt: null }),
      });
      if (!before) return null;
      const after = await tx.account.update({
        where: { id },
        data: { priority, updatedBy: actorId },
      });
      await this.audit.write(tx, {
        entityType: ENTITY_TYPE,
        entityId: id,
        action: "priority_changed",
        before: snapshot(before),
        after: snapshot(after),
      });
      return after;
    });
  }

  /** Legacy setCrmTemperature (audit action temperature_changed). */
  @OrgScoped()
  async changeTemperature(
    scope: OrgScope,
    id: number,
    temperature: AccountTemperature,
    actorId: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.account.findFirst({
        where: tenantWhere(scope, { id, deletedAt: null }),
      });
      if (!before) return null;
      const after = await tx.account.update({
        where: { id },
        data: { temperature, updatedBy: actorId },
      });
      await this.audit.write(tx, {
        entityType: ENTITY_TYPE,
        entityId: id,
        action: "temperature_changed",
        before: snapshot(before),
        after: snapshot(after),
      });
      return after;
    });
  }

  /** Audit-backed Timeline feed (legacy accountAuditLogs): everything
   * recorded against the account, plus update/delete/restore events of its
   * contacts and delete/restore of its opportunities, except creation
   * events (the Timeline shows those from the rows themselves). */
  @OrgScoped()
  async findTimelineEvents(scope: OrgScope, id: number) {
    const account = await this.prisma.account.findFirst({
      where: tenantWhere(scope, { id, deletedAt: null }),
      select: { id: true },
    });
    if (!account) return null;
    const org = scope.organizationId;
    const [contacts, opportunities] = await Promise.all([
      this.prisma.contact.findMany({
        where: { organizationId: org, accountId: id },
        select: { id: true },
      }),
      this.prisma.opportunity.findMany({
        where: { organizationId: org, accountId: id },
        select: { id: true },
      }),
    ]);
    const logs = await this.prisma.auditLog.findMany({
      where: {
        organizationId: org,
        OR: [
          {
            entityType: ENTITY_TYPE,
            entityId: BigInt(id),
            action: { not: "create" },
          },
          {
            entityType: "crm_contact",
            entityId: { in: contacts.map((c) => BigInt(c.id)) },
            action: { in: ["update", "delete", "restore"] },
          },
          {
            entityType: "crm_opportunity",
            entityId: { in: opportunities.map((o) => BigInt(o.id)) },
            action: { in: ["delete", "restore"] },
          },
        ],
      },
      orderBy: { id: "desc" },
      take: 200,
    });
    const names = await userNamesByIds(
      this.prisma,
      org,
      logs.map((l) => l.actorUserId),
    );
    return logs.map((l) => ({
      id: Number(l.id),
      entityType: l.entityType,
      entityId: Number(l.entityId),
      action: l.action,
      before: l.before,
      after: l.after,
      at: l.at,
      byName: l.actorUserId ? (names.get(l.actorUserId) ?? null) : null,
    }));
  }

  /** Matches legacy changeCrmAccountStatusTag's field-write side; the
   * auto-task-creation side effect lives in the service layer (needs
   * CrmTasksService, a cross-module call that doesn't belong in a
   * repository per CODING_STANDARDS.md §11). */
  @OrgScoped()
  async changeStatusTag(
    scope: OrgScope,
    id: number,
    dto: ChangeAccountStatusTagDto,
    actorId: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.account.findFirst({
        where: tenantWhere(scope, { id, deletedAt: null }),
      });
      if (!before) return null;
      const after = await tx.account.update({
        where: { id },
        data: {
          statusTag: dto.statusTag,
          statusReason: dto.statusReason ?? null,
          statusDate: dto.statusDate ? new Date(dto.statusDate) : null,
          statusInfoType: dto.statusInfoType ?? null,
          statusUpdatedBy: actorId,
          statusUpdatedAt: new Date(),
          updatedBy: actorId,
        },
      });
      await this.audit.write(tx, {
        entityType: ENTITY_TYPE,
        entityId: id,
        action: "status_tag_changed",
        before: snapshot(before),
        after: snapshot(after),
      });
      return after;
    });
  }

  /** Full legacy `deleteCrmAccountCascade`: soft-deletes (with ONE shared
   * instant) the account's contacts, opportunities (+ their products),
   * quotations, notes, and every polymorphic record (meetings, follow-ups,
   * tasks, documents, activities) rolled up on the account, its contacts and
   * its deals. Restore reverses exactly the rows carrying that instant. */
  @OrgScoped()
  async softDelete(scope: OrgScope, id: number, actorId: number) {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.account.findFirst({
        where: tenantWhere(scope, { id, deletedAt: null }),
      });
      if (!before) return null;
      const now = new Date();
      const org = scope.organizationId;
      // Roll-up ids must be read BEFORE contacts/deals are soft-deleted.
      const rollup = await accountRollupWhere(tx, org, id);
      const dealIds = (
        await tx.opportunity.findMany({
          where: { accountId: id, organizationId: org, deletedAt: null },
          select: { id: true },
        })
      ).map((o) => o.id);
      await tx.opportunityProduct.updateMany({
        where: { opportunityId: { in: dealIds }, deletedAt: null },
        data: { deletedAt: now, isActive: false, updatedBy: actorId },
      });
      const poly = { organizationId: org, deletedAt: null, ...rollup };
      await tx.crmMeeting.updateMany({
        where: poly,
        data: { deletedAt: now, updatedBy: actorId },
      });
      await tx.crmFollowUp.updateMany({
        where: poly,
        data: { deletedAt: now, updatedBy: actorId },
      });
      await tx.crmActivity.updateMany({
        where: poly,
        data: { deletedAt: now, updatedBy: actorId },
      });
      await tx.crmTask.updateMany({
        where: poly,
        data: { deletedAt: now, updatedBy: actorId },
      });
      await tx.crmDocument.updateMany({
        where: poly,
        data: { deletedAt: now },
      });
      await tx.contact.updateMany({
        where: {
          accountId: id,
          organizationId: scope.organizationId,
          deletedAt: null,
        },
        data: { deletedAt: now, isActive: false, updatedBy: actorId },
      });
      await tx.opportunity.updateMany({
        where: {
          accountId: id,
          organizationId: scope.organizationId,
          deletedAt: null,
        },
        data: { deletedAt: now, isActive: false, updatedBy: actorId },
      });
      await tx.quotation.updateMany({
        where: {
          accountId: id,
          organizationId: scope.organizationId,
          deletedAt: null,
        },
        data: { deletedAt: now, updatedBy: actorId },
      });
      await tx.crmNote.updateMany({
        where: {
          accountId: id,
          organizationId: scope.organizationId,
          deletedAt: null,
        },
        data: { deletedAt: now },
      });
      const after = await tx.account.update({
        where: { id },
        data: { deletedAt: now, isActive: false, updatedBy: actorId },
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

  private asConflict(error: unknown): unknown {
    return classifyDbError(error)?.kind === "unique"
      ? new ResourceConflictException(
          "An account with that name may already exist",
        )
      : error;
  }
  /** Recycle Bin: this organization's soft-deleted rows, newest deletion first. */
  @OrgScoped()
  async findDeleted(scope: OrgScope) {
    return this.prisma.account.findMany({
      where: tenantWhere(scope, { deletedAt: { not: null } }),
      orderBy: [{ deletedAt: "desc" }, { id: "desc" }],
      take: 2000,
    });
  }

  /** Recycle Bin restore: clears `deletedAt` and restores the cascade (children deleted in the same instant). Returns null when the row is not in the bin. */
  @OrgScoped()
  async restoreDeleted(scope: OrgScope, id: number, actorId: number) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const before = await tx.account.findFirst({
          where: tenantWhere(scope, { id, deletedAt: { not: null } }),
        });
        if (!before || !before.deletedAt) return null;
        // Restore the cascade: children soft-deleted in the same instant as the account.
        const at = before.deletedAt;
        const org = scope.organizationId;
        const contactIds = (
          await tx.contact.findMany({
            where: { accountId: id, organizationId: org, deletedAt: at },
            select: { id: true },
          })
        ).map((c) => c.id);
        const dealIds = (
          await tx.opportunity.findMany({
            where: { accountId: id, organizationId: org, deletedAt: at },
            select: { id: true },
          })
        ).map((o) => o.id);
        const poly = {
          organizationId: org,
          deletedAt: at,
          OR: [
            { relatedType: "account", relatedId: id },
            { relatedType: "contact", relatedId: { in: contactIds } },
            { relatedType: "opportunity", relatedId: { in: dealIds } },
          ],
        };
        await tx.opportunityProduct.updateMany({
          where: { opportunityId: { in: dealIds }, deletedAt: at },
          data: { deletedAt: null, isActive: true, updatedBy: actorId },
        });
        await tx.crmMeeting.updateMany({
          where: poly,
          data: { deletedAt: null, updatedBy: actorId },
        });
        await tx.crmFollowUp.updateMany({
          where: poly,
          data: { deletedAt: null, updatedBy: actorId },
        });
        await tx.crmActivity.updateMany({
          where: poly,
          data: { deletedAt: null, updatedBy: actorId },
        });
        await tx.crmTask.updateMany({
          where: poly,
          data: { deletedAt: null, updatedBy: actorId },
        });
        await tx.crmDocument.updateMany({
          where: poly,
          data: { deletedAt: null },
        });
        await tx.contact.updateMany({
          where: {
            accountId: id,
            organizationId: scope.organizationId,
            deletedAt: before.deletedAt,
          },
          data: { deletedAt: null, isActive: true, updatedBy: actorId },
        });
        await tx.opportunity.updateMany({
          where: {
            accountId: id,
            organizationId: scope.organizationId,
            deletedAt: before.deletedAt,
          },
          data: { deletedAt: null, isActive: true, updatedBy: actorId },
        });
        await tx.quotation.updateMany({
          where: {
            accountId: id,
            organizationId: scope.organizationId,
            deletedAt: before.deletedAt,
          },
          data: { deletedAt: null, updatedBy: actorId },
        });
        await tx.crmNote.updateMany({
          where: {
            accountId: id,
            organizationId: scope.organizationId,
            deletedAt: before.deletedAt,
          },
          data: { deletedAt: null },
        });
        const after = await tx.account.update({
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
        const before = await tx.account.findFirst({
          where: tenantWhere(scope, { id, deletedAt: { not: null } }),
        });
        if (!before) return null;
        const org = scope.organizationId;
        const dealIds = (
          await tx.opportunity.findMany({
            where: {
              accountId: id,
              organizationId: org,
              deletedAt: { not: null },
            },
            select: { id: true },
          })
        ).map((o) => o.id);
        const contactIds = (
          await tx.contact.findMany({
            where: {
              accountId: id,
              organizationId: org,
              deletedAt: { not: null },
            },
            select: { id: true },
          })
        ).map((c) => c.id);
        await tx.lead.updateMany({
          where: { organizationId: org, linkedAccountId: id },
          data: { linkedAccountId: null },
        });
        await tx.lead.updateMany({
          where: { organizationId: org, linkedContactId: { in: contactIds } },
          data: { linkedContactId: null },
        });
        await tx.lead.updateMany({
          where: { organizationId: org, linkedOpportunityId: { in: dealIds } },
          data: { linkedOpportunityId: null },
        });
        await tx.crmColdCallingEntry.updateMany({
          where: { organizationId: org, linkedAccountId: id },
          data: { linkedAccountId: null },
        });
        await tx.quotation.deleteMany({
          where: {
            accountId: id,
            organizationId: org,
            deletedAt: { not: null },
          },
        });
        const historyCount = await tx.opportunityStageHistory.count({
          where: { opportunityId: { in: dealIds } },
        });
        if (historyCount > 0) {
          throw new BusinessRuleViolationException(
            "This account has deals with an append-only stage history, so it cannot be permanently deleted",
            "HAS_IMMUTABLE_HISTORY",
          );
        }
        await tx.opportunityProduct.deleteMany({
          where: { opportunityId: { in: dealIds } },
        });
        await tx.opportunity.deleteMany({ where: { id: { in: dealIds } } });
        await tx.contact.deleteMany({ where: { id: { in: contactIds } } });
        await tx.crmNote.deleteMany({
          where: {
            accountId: id,
            organizationId: org,
            deletedAt: { not: null },
          },
        });
        // Polymorphic rows have no FK; drop the ones this account's cascade binned.
        const poly = {
          organizationId: org,
          deletedAt: { not: null },
          OR: [
            { relatedType: "account", relatedId: id },
            { relatedType: "contact", relatedId: { in: contactIds } },
            { relatedType: "opportunity", relatedId: { in: dealIds } },
          ],
        };
        await tx.crmMeeting.deleteMany({ where: poly });
        await tx.crmFollowUp.deleteMany({ where: poly });
        await tx.crmActivity.deleteMany({ where: poly });
        await tx.crmTask.deleteMany({ where: poly });
        await tx.crmDocument.deleteMany({ where: poly });
        await tx.account.delete({ where: { id } });
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
