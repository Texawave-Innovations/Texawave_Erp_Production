import { Injectable } from "@nestjs/common";
import { Prisma } from "@texawave-erp/database";
import { OrgScoped } from "../../../common/decorators/org-scoped.decorator.js";
import type { PaginationDto } from "../../../common/dto/pagination.dto.js";
import { BusinessRuleConflictException } from "../../../common/exceptions/business.exception.js";
import type { OrgScope } from "../../../common/tenancy/org-scope.js";
import { tenantWhere } from "../../../common/tenancy/tenant-where.js";
import { AuditWriter } from "../../../platform/audit/audit-writer.js";
import { PrismaService } from "../../../shared/prisma/prisma.service.js";
import type { CodeFormat } from "../master-list/code-formats.rules.js";
import { amountInWords } from "./amount-in-words.js";
import {
  type DocumentData,
  type DocumentFilter,
  issueDocumentNumber,
  lineRows,
  liveLines,
  pricedSnapshot,
  searchWhere,
} from "./document-repository.helpers.js";
import type { QuotationStatus } from "./dto/quotation.dto.js";

const ENTITY_TYPE = "sales_quotation";

const INCLUDE = {
  lines: liveLines,
} satisfies Prisma.SalesQuotationInclude;

type QuotationRow = Prisma.SalesQuotationGetPayload<{
  include: typeof INCLUDE;
}>;

export interface QuotationData extends DocumentData {
  quotationDate: Date;
  validity: string | null;
  deliveryTerms: string | null;
}

export interface QuotationFilter extends DocumentFilter {
  status?: QuotationStatus | undefined;
}

function toView(row: QuotationRow) {
  const { lines, ...rest } = row;
  return {
    ...rest,
    lines: lines.map((l) => ({
      lineNo: l.lineNo,
      description: l.description,
      hsnCode: l.hsnCode,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      amount: l.amount,
    })),
    amountInWords: amountInWords(row.totalAmount),
  };
}

export type QuotationView = ReturnType<typeof toView>;

const locked = (number: string) =>
  new BusinessRuleConflictException(
    `Quotation ${number} has been converted to an invoice and can no longer be changed`,
    "DOCUMENT_LOCKED",
  );

/** The only place `PrismaService` is called for quotations. Every write is
 * one transaction holding the change and its audit row. */
@Injectable()
export class QuotationsRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditWriter,
  ) {}

  @OrgScoped()
  async findMany(
    scope: OrgScope,
    filter: QuotationFilter,
    pagination: PaginationDto,
  ) {
    const where = tenantWhere<Prisma.SalesQuotationWhereInput>(scope, {
      deletedAt: null,
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.customerId ? { customerId: filter.customerId } : {}),
      ...(filter.from || filter.to
        ? {
            quotationDate: {
              ...(filter.from ? { gte: filter.from } : {}),
              ...(filter.to ? { lte: filter.to } : {}),
            },
          }
        : {}),
      ...searchWhere(filter.search, "quotationNumber"),
    });
    const [rows, total] = await Promise.all([
      this.prisma.salesQuotation.findMany({
        where,
        include: INCLUDE,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: [
          { quotationDate: pagination.order ?? "desc" },
          { id: pagination.order ?? "desc" },
        ],
      }),
      this.prisma.salesQuotation.count({ where }),
    ]);
    return { items: rows.map(toView), total };
  }

  @OrgScoped()
  async findOne(scope: OrgScope, id: number) {
    const row = await this.prisma.salesQuotation.findFirst({
      where: tenantWhere(scope, { id, deletedAt: null }),
      include: INCLUDE,
    });
    return row ? toView(row) : null;
  }

  @OrgScoped()
  async create(
    scope: OrgScope,
    input: QuotationData,
    number: { format: CodeFormat; fiscalYear: string },
    actorId: number,
  ) {
    const { lines, ...data } = input;
    return this.prisma.$transaction(async (tx) => {
      const quotationNumber = await issueDocumentNumber(
        tx,
        scope.organizationId,
        "quotation",
        number.format,
        number.fiscalYear,
      );
      const created = await tx.salesQuotation.create({
        data: {
          ...columns(data),
          quotationNumber,
          organizationId: scope.organizationId,
          createdBy: actorId,
          updatedBy: actorId,
        },
      });
      await tx.salesQuotationLine.createMany({
        data: lineRows(lines, actorId).map((l) => ({
          ...l,
          organizationId: scope.organizationId,
          quotationId: created.id,
        })),
      });
      const row = await tx.salesQuotation.findUniqueOrThrow({
        where: { id: created.id },
        include: INCLUDE,
      });
      await this.audit.write(tx, {
        entityType: ENTITY_TYPE,
        entityId: row.id,
        action: "create",
        after: snapshot(row),
      });
      return toView(row);
    });
  }

  /** null when not in scope (→ 404). Locks the row; a converted quotation
   * is refused. The number never changes. */
  @OrgScoped()
  async update(
    scope: OrgScope,
    id: number,
    input: QuotationData,
    actorId: number,
  ) {
    const { lines, ...data } = input;
    return this.prisma.$transaction(async (tx) => {
      const before = await this.lockLive(tx, scope, id);
      if (!before) return null;
      if (before.status === "CONVERTED") throw locked(before.quotationNumber);
      await tx.salesQuotation.update({
        where: { id },
        data: { ...columns(data), updatedBy: actorId },
      });
      await tx.salesQuotationLine.updateMany({
        where: { quotationId: id, deletedAt: null },
        data: { deletedAt: new Date(), updatedBy: actorId },
      });
      await tx.salesQuotationLine.createMany({
        data: lineRows(lines, actorId).map((l) => ({
          ...l,
          organizationId: scope.organizationId,
          quotationId: id,
        })),
      });
      const after = await tx.salesQuotation.findUniqueOrThrow({
        where: { id },
        include: INCLUDE,
      });
      await this.audit.write(tx, {
        entityType: ENTITY_TYPE,
        entityId: id,
        action: "update",
        before: snapshot(before),
        after: snapshot(after),
      });
      return toView(after);
    });
  }

  /** false when not in scope (→ 404). A converted quotation stays: its
   * invoice points at it. */
  @OrgScoped()
  async softDelete(scope: OrgScope, id: number, actorId: number) {
    return this.prisma.$transaction(async (tx) => {
      const before = await this.lockLive(tx, scope, id);
      if (!before) return false;
      if (before.status === "CONVERTED") throw locked(before.quotationNumber);
      const now = new Date();
      await tx.salesQuotation.update({
        where: { id },
        data: { deletedAt: now, updatedBy: actorId },
      });
      await tx.salesQuotationLine.updateMany({
        where: { quotationId: id, deletedAt: null },
        data: { deletedAt: now, updatedBy: actorId },
      });
      await this.audit.write(tx, {
        entityType: ENTITY_TYPE,
        entityId: id,
        action: "delete",
        before: snapshot(before),
      });
      return true;
    });
  }

  private async lockLive(
    tx: Prisma.TransactionClient,
    scope: OrgScope,
    id: number,
  ) {
    await tx.$queryRaw`
      SELECT id FROM sales.quotations
       WHERE id = ${id} AND organization_id = ${scope.organizationId}
       FOR UPDATE`;
    return tx.salesQuotation.findFirst({
      where: tenantWhere(scope, { id, deletedAt: null }),
      include: INCLUDE,
    });
  }
}

function columns(data: Omit<QuotationData, "lines">) {
  const { customerSnapshot, bankDetails, customFields, ...rest } = data;
  return {
    ...rest,
    customerSnapshot: customerSnapshot as unknown as Prisma.InputJsonValue,
    bankDetails:
      bankDetails === null
        ? Prisma.DbNull
        : (bankDetails as Prisma.InputJsonValue),
    customFields: customFields as Prisma.InputJsonValue,
  };
}

function snapshot(row: QuotationRow) {
  return {
    quotationNumber: row.quotationNumber,
    quotationDate: row.quotationDate,
    status: row.status,
    ...pricedSnapshot(row),
  };
}
