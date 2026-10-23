import { Injectable } from "@nestjs/common";
import { OrgScoped } from "../../common/decorators/org-scoped.decorator.js";
import type { OrgScope } from "../../common/tenancy/org-scope.js";
import { tenantWhere } from "../../common/tenancy/tenant-where.js";
import { PrismaService } from "../../shared/prisma/prisma.service.js";
import type { SalesDocumentType } from "./sales-settings.constants.js";
import type { UpdateDocumentNumberingDto } from "./dto/update-document-numbering.dto.js";

/** Thin CRUD over the existing `document_sequences` table
 * (Docs/ARCHITECTURE.md §5.3) — this module only adds new `docType` values,
 * it does not own the table. The only place `PrismaService` is called for
 * this resource. Allocating the next number for an actual document (inside a
 * transaction, with the row lock) is each Sales/SCM module's own job — see
 * Docs/SALES_SETTINGS_FOUNDATION.md. */
@Injectable()
export class DocumentNumberingRepository {
  constructor(private readonly prisma: PrismaService) {}

  @OrgScoped()
  findMany(scope: OrgScope, docTypes: readonly SalesDocumentType[]) {
    return this.prisma.documentSequence.findMany({
      where: tenantWhere(scope, {
        docType: { in: [...docTypes] },
        deletedAt: null,
      }),
    });
  }

  @OrgScoped()
  findOne(scope: OrgScope, docType: SalesDocumentType) {
    return this.prisma.documentSequence.findFirst({
      where: tenantWhere(scope, { docType, deletedAt: null }),
    });
  }

  /** Create-or-update: the UI edits a fixed set of prefixes, never creates or
   * deletes a doc type, so a save always upserts. `nextNumber` is left alone
   * on update — editing the prefix must never reset or skip the counter. */
  @OrgScoped()
  async upsert(
    scope: OrgScope,
    docType: SalesDocumentType,
    dto: UpdateDocumentNumberingDto,
    actorId: number,
  ) {
    const existing = await this.findOne(scope, docType);
    if (!existing) {
      return this.prisma.documentSequence.create({
        data: {
          docType,
          prefix: dto.prefix,
          padding: dto.padding ?? 6,
          organizationId: scope.organizationId,
          createdBy: actorId,
          updatedBy: actorId,
        },
      });
    }
    return this.prisma.documentSequence.update({
      where: { id: existing.id },
      data: {
        prefix: dto.prefix,
        ...(dto.padding !== undefined ? { padding: dto.padding } : {}),
        updatedBy: actorId,
      },
    });
  }
}
