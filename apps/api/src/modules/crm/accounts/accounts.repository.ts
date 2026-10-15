import { Injectable } from "@nestjs/common";
import { Prisma } from "@texawave-erp/database";
import { OrgScoped } from "../../../common/decorators/org-scoped.decorator.js";
import type { PaginationDto } from "../../../common/dto/pagination.dto.js";
import { ResourceConflictException } from "../../../common/exceptions/business.exception.js";
import { classifyDbError } from "../../../common/database/db-errors.js";
import type { OrgScope } from "../../../common/tenancy/org-scope.js";
import { tenantWhere } from "../../../common/tenancy/tenant-where.js";
import { AuditWriter } from "../../../platform/audit/audit-writer.js";
import { PrismaService } from "../../../shared/prisma/prisma.service.js";
import type {
  ChangeAccountStatusTagDto,
  CreateAccountDto,
  UpdateAccountDto,
} from "./dto/account.dto.js";

const ENTITY_TYPE = "crm_account";

export interface AccountFilter {
  search?: string | undefined;
  statusTag?: string | undefined;
}

function snapshot(row: {
  name: string;
  isActive: boolean;
  statusTag: string | null;
}) {
  return { name: row.name, isActive: row.isActive, statusTag: row.statusTag };
}

function writeFields(dto: CreateAccountDto | UpdateAccountDto) {
  return {
    accountType: dto.accountType,
    ownerName: dto.ownerName,
    industry: dto.industry,
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
      clauses.push({ name: { contains: filter.search, mode: "insensitive" } });
    }
    if (filter.statusTag) clauses.push({ statusTag: filter.statusTag });
    const where = tenantWhere<Prisma.AccountWhereInput>(scope, {
      AND: clauses,
    });
    const [items, total] = await Promise.all([
      this.prisma.account.findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: [{ name: pagination.order ?? "asc" }, { id: "asc" }],
      }),
      this.prisma.account.count({ where }),
    ]);
    return { items, total };
  }

  @OrgScoped()
  async findOne(scope: OrgScope, id: number) {
    return this.prisma.account.findFirst({
      where: tenantWhere(scope, { id, deletedAt: null }),
    });
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

  /** Matches legacy `changeCrmAccountStatusTag`'s field-write side; the
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

  /** Cascade soft-delete of the account's own direct children (Contacts,
   * Opportunities, Quotations, Notes) — matches legacy
   * `deleteCrmAccountCascade`'s scope for the entities that exist in this
   * repo today. Meeting/FollowUp/CrmActivity/CrmTask/CrmDocument are
   * polymorphically related (no FK), so they are intentionally NOT
   * cascaded here — legacy cascades them too, but doing so safely needs a
   * cross-module call (same reasoning as the status-tag task side effect);
   * left as a follow-up, documented in Docs/CRM_FULL_LEGACY_PARITY.md. */
  @OrgScoped()
  async softDelete(scope: OrgScope, id: number, actorId: number) {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.account.findFirst({
        where: tenantWhere(scope, { id, deletedAt: null }),
      });
      if (!before) return null;
      const now = new Date();
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
}
