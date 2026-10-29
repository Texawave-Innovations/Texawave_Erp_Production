import { Injectable } from "@nestjs/common";
import { OrgScoped } from "../../../common/decorators/org-scoped.decorator.js";
import type { OrgScope } from "../../../common/tenancy/org-scope.js";
import { tenantWhere } from "../../../common/tenancy/tenant-where.js";
import { AuditWriter } from "../../../platform/audit/audit-writer.js";
import { PrismaService } from "../../../shared/prisma/prisma.service.js";
import {
  type CodeFormat,
  type CodeType,
  DEFAULT_CODE_FORMATS,
} from "./code-formats.rules.js";

const ENTITY_TYPE = "sales_code_format";

/** The only place `PrismaService` is called for the Sales master list. */
@Injectable()
export class CodeFormatsRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditWriter,
  ) {}

  @OrgScoped()
  findAll(scope: OrgScope) {
    return this.prisma.salesCodeFormat.findMany({
      where: tenantWhere(scope, { deletedAt: null }),
      select: { codeType: true, prefix: true, padding: true, updatedAt: true },
    });
  }

  @OrgScoped()
  findOne(scope: OrgScope, codeType: CodeType) {
    return this.prisma.salesCodeFormat.findFirst({
      where: tenantWhere(scope, { codeType, deletedAt: null }),
      select: { codeType: true, prefix: true, padding: true, updatedAt: true },
    });
  }

  /** Creates the row on first edit (from the default), else updates it; the
   * change and its audit row commit together. */
  @OrgScoped()
  async upsert(
    scope: OrgScope,
    codeType: CodeType,
    patch: Partial<CodeFormat>,
    actorId: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.salesCodeFormat.findFirst({
        where: tenantWhere(scope, { codeType, deletedAt: null }),
      });
      const before: CodeFormat = existing
        ? { prefix: existing.prefix, padding: existing.padding }
        : DEFAULT_CODE_FORMATS[codeType];
      const after: CodeFormat = { ...before, ...patch };
      const row = existing
        ? await tx.salesCodeFormat.update({
            where: { id: existing.id },
            data: { ...after, updatedBy: actorId },
          })
        : await tx.salesCodeFormat.create({
            data: {
              organizationId: scope.organizationId,
              codeType,
              ...after,
              createdBy: actorId,
              updatedBy: actorId,
            },
          });
      await this.audit.write(tx, {
        entityType: ENTITY_TYPE,
        entityId: row.id,
        action: "update",
        before: { codeType, ...before },
        after: { codeType, ...after },
      });
      return {
        codeType,
        prefix: row.prefix,
        padding: row.padding,
        updatedAt: row.updatedAt,
      };
    });
  }
}
