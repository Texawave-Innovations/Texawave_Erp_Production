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
import type { CreateAccountDto, UpdateAccountDto } from "./dto/account.dto.js";

const ENTITY_TYPE = "crm_account";

export interface AccountFilter {
  search?: string | undefined;
}

function snapshot(row: { name: string; isActive: boolean }) {
  return { name: row.name, isActive: row.isActive };
}

/** Minimal CRM Account foundation (Phase 4B) — organization-wide reference
 * data, no team dimension (same shape as master-data/* modules). Only the
 * fields the legacy Contacts.tsx actually reads off an account are modeled. */
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
    const where = tenantWhere<Prisma.AccountWhereInput>(scope, {
      deletedAt: null,
      ...(filter.search
        ? { name: { contains: filter.search, mode: "insensitive" } }
        : {}),
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
        const created = await tx.account.create({
          data: {
            organizationId: scope.organizationId,
            name: dto.name,
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
      const after = await tx.account.update({
        where: { id },
        data: { name: dto.name ?? before.name, updatedBy: actorId },
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

  private asConflict(error: unknown): unknown {
    return classifyDbError(error)?.kind === "unique"
      ? new ResourceConflictException(
          "An account with that name may already exist",
        )
      : error;
  }
}
