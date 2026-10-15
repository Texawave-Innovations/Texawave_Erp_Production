import { Injectable } from "@nestjs/common";
import { OrgScoped } from "../../../common/decorators/org-scoped.decorator.js";
import type { OrgScope } from "../../../common/tenancy/org-scope.js";
import { tenantWhere } from "../../../common/tenancy/tenant-where.js";
import { PrismaService } from "../../../shared/prisma/prisma.service.js";
import {
  type CodeFormat,
  type DocumentCodeType,
  documentSequenceDocType,
  formatDocumentNumber,
} from "../master-list/code-formats.rules.js";

/** Read-only peek at the per-year document counters. */
@Injectable()
export class DocumentNumbersRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** The number the next document will probably get — a preview for the
   * "Create …" header, never reserved (it is issued for real inside the
   * create transaction). */
  @OrgScoped()
  async peek(
    scope: OrgScope,
    codeType: DocumentCodeType,
    format: CodeFormat,
    fiscalYear: string,
  ): Promise<string> {
    const row = await this.prisma.documentSequence.findFirst({
      where: tenantWhere(scope, {
        docType: documentSequenceDocType(codeType, fiscalYear),
        deletedAt: null,
      }),
      select: { nextNumber: true },
    });
    return formatDocumentNumber(format, fiscalYear, row?.nextNumber ?? 1);
  }
}
