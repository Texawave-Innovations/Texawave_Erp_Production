import { Injectable } from "@nestjs/common";
import { OrgScoped } from "../../../common/decorators/org-scoped.decorator.js";
import type { PaginationDto } from "../../../common/dto/pagination.dto.js";
import { BusinessRuleViolationException } from "../../../common/exceptions/business.exception.js";
import type { OrgScope } from "../../../common/tenancy/org-scope.js";
import { tenantWhere } from "../../../common/tenancy/tenant-where.js";
import { AuditWriter } from "../../../platform/audit/audit-writer.js";
import { PrismaService } from "../../../shared/prisma/prisma.service.js";
import type { CreateCrmNoteDto } from "./dto/note.dto.js";

const ENTITY_TYPE = "crm_note";

function snapshot(row: { content: string }) {
  return { content: row.content };
}

@Injectable()
export class CrmNotesRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditWriter,
  ) {}

  @OrgScoped()
  async findByAccount(
    scope: OrgScope,
    accountId: number,
    pagination: PaginationDto,
  ) {
    const where = tenantWhere(scope, { accountId, deletedAt: null });
    const [items, total] = await Promise.all([
      this.prisma.crmNote.findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: [{ createdAt: pagination.order ?? "desc" }, { id: "desc" }],
      }),
      this.prisma.crmNote.count({ where }),
    ]);
    return { items, total };
  }

  @OrgScoped()
  async create(scope: OrgScope, dto: CreateCrmNoteDto, actorId: number) {
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
      const created = await tx.crmNote.create({
        data: {
          organizationId: scope.organizationId,
          accountId: dto.accountId,
          content: dto.content,
          createdBy: actorId,
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
  }

  @OrgScoped()
  async softDelete(scope: OrgScope, id: number) {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.crmNote.findFirst({
        where: tenantWhere(scope, { id, deletedAt: null }),
      });
      if (!before) return null;
      const after = await tx.crmNote.update({
        where: { id },
        data: { deletedAt: new Date() },
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
