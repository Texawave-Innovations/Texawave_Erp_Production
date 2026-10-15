import { Injectable } from "@nestjs/common";
import { Prisma } from "@texawave-erp/database";
import { OrgScoped } from "../../../common/decorators/org-scoped.decorator.js";
import { BusinessRuleViolationException } from "../../../common/exceptions/business.exception.js";
import type { OrgScope } from "../../../common/tenancy/org-scope.js";
import { tenantWhere } from "../../../common/tenancy/tenant-where.js";
import { AuditWriter } from "../../../platform/audit/audit-writer.js";
import { PrismaService } from "../../../shared/prisma/prisma.service.js";
import {
  type CodeFormat,
  type DocumentCodeType,
  documentSequenceDocType,
} from "./code-formats.rules.js";

const ENTITY_TYPE = "sales_running_number";

/** The highest number already issued for `<prefix>/<fy>/` — deleted
 * documents included, since their numbers stay taken. */
function maxIssuedSql(
  codeType: DocumentCodeType,
  organizationId: number,
  stem: string,
): Prisma.Sql {
  const pattern = `${stem}%`;
  const from = stem.length + 1;
  const pick = (column: Prisma.Sql, table: Prisma.Sql, extra: Prisma.Sql) =>
    Prisma.sql`
      SELECT COALESCE(max(substring(${column} FROM ${from}::int)::int), 0) AS max
        FROM ${table}
       WHERE organization_id = ${organizationId}
         AND ${column} LIKE ${pattern}
         AND substring(${column} FROM ${from}::int) ~ '^[0-9]{1,9}$' ${extra}`;
  switch (codeType) {
    case "quotation":
      return pick(
        Prisma.sql`quotation_number`,
        Prisma.sql`sales.quotations`,
        Prisma.empty,
      );
    case "proforma_invoice":
      return pick(
        Prisma.sql`invoice_number`,
        Prisma.sql`sales.invoices`,
        Prisma.sql`AND invoice_type = 'PROFORMA'`,
      );
    case "tax_invoice":
      return pick(
        Prisma.sql`invoice_number`,
        Prisma.sql`sales.invoices`,
        Prisma.sql`AND invoice_type = 'TAX'`,
      );
    case "delivery_challan":
      return pick(
        Prisma.sql`dc_number`,
        Prisma.sql`sales.delivery_challans`,
        Prisma.empty,
      );
    case "payment_received":
      return pick(
        Prisma.sql`payment_number`,
        Prisma.sql`sales.invoice_payments`,
        Prisma.empty,
      );
    case "returnable_dc":
      return pick(
        Prisma.sql`rdc_number`,
        Prisma.sql`sales.returnable_delivery_challans`,
        Prisma.empty,
      );
  }
}

/** The per-year document counters behind the "Running Numbers" page. */
@Injectable()
export class RunningNumbersRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditWriter,
  ) {}

  /** The next number for one document type and financial year (1 when
   * nothing has been issued or set yet). */
  @OrgScoped()
  async nextNumber(
    scope: OrgScope,
    codeType: DocumentCodeType,
    fiscalYear: string,
  ): Promise<number> {
    const row = await this.prisma.documentSequence.findFirst({
      where: tenantWhere(scope, {
        docType: documentSequenceDocType(codeType, fiscalYear),
        deletedAt: null,
      }),
      select: { nextNumber: true },
    });
    return row?.nextNumber ?? 1;
  }

  /**
   * Sets the last number used, so the next document gets `lastNumber + 1`.
   * Under the counter's row lock (the same lock document creation takes),
   * so it cannot race a create. Refused below a number already issued with
   * the current prefix — that would hand out a duplicate.
   */
  @OrgScoped()
  async setLastNumber(
    scope: OrgScope,
    codeType: DocumentCodeType,
    fiscalYear: string,
    format: CodeFormat,
    lastNumber: number,
    actorId: number,
  ): Promise<number> {
    const docType = documentSequenceDocType(codeType, fiscalYear);
    const org = scope.organizationId;
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        INSERT INTO platform.document_sequences
          (organization_id, doc_type, prefix, padding, next_number, updated_at)
        VALUES (${org}, ${docType}, ${format.prefix}, ${format.padding}, 1, now())
        ON CONFLICT (organization_id, doc_type) DO NOTHING`;
      const [current] = await tx.$queryRaw<
        Array<{ id: number; next_number: number }>
      >`
        SELECT id, next_number FROM platform.document_sequences
         WHERE organization_id = ${org} AND doc_type = ${docType}
           AND deleted_at IS NULL
         FOR UPDATE`;
      if (!current) {
        throw new Error(
          `No active ${docType} sequence for organization ${org}`,
        );
      }
      const [issued] = await tx.$queryRaw<Array<{ max: number }>>(
        maxIssuedSql(codeType, org, `${format.prefix}/${fiscalYear}/`),
      );
      const highest = issued?.max ?? 0;
      if (lastNumber < highest) {
        throw new BusinessRuleViolationException(
          `Number ${highest} is already used for ${format.prefix}/${fiscalYear}; the last number cannot be set below it`,
          "RUNNING_NUMBER_IN_USE",
        );
      }
      await tx.$executeRaw`
        UPDATE platform.document_sequences
           SET next_number = ${lastNumber + 1}, updated_by = ${actorId},
               updated_at = now()
         WHERE organization_id = ${org} AND doc_type = ${docType}`;
      await this.audit.write(tx, {
        entityType: ENTITY_TYPE,
        entityId: current.id,
        action: "set_last_number",
        before: { docType, lastNumber: current.next_number - 1 },
        after: { docType, lastNumber },
      });
      return lastNumber + 1;
    });
  }
}
