import { Injectable } from "@nestjs/common";
import { Prisma } from "@texawave-erp/database";
import { OrgScoped } from "../../../common/decorators/org-scoped.decorator.js";
import type { PaginationDto } from "../../../common/dto/pagination.dto.js";
import {
  BusinessRuleConflictException,
  BusinessRuleViolationException,
} from "../../../common/exceptions/business.exception.js";
import type { OrgScope } from "../../../common/tenancy/org-scope.js";
import { tenantWhere } from "../../../common/tenancy/tenant-where.js";
import { AuditWriter } from "../../../platform/audit/audit-writer.js";
import { PrismaService } from "../../../shared/prisma/prisma.service.js";
import type { CodeFormat } from "../master-list/code-formats.rules.js";
import { amountInWords } from "./amount-in-words.js";
import { paymentStatus } from "./document-totals.js";
import {
  type DocumentData,
  type DocumentFilter,
  issueDocumentNumber,
  lineRows,
  liveLines,
  pricedSnapshot,
  searchWhere,
} from "./document-repository.helpers.js";
import type {
  InvoiceStatus,
  InvoiceType,
  PaymentMode,
} from "./dto/invoice.dto.js";

const ENTITY_TYPE = "sales_invoice";
const QUOTATION_ENTITY = "sales_quotation";

const INCLUDE = {
  lines: liveLines,
  payments: {
    where: { deletedAt: null },
    orderBy: [{ paymentDate: "asc" }, { id: "asc" }],
  },
  sourceQuotation: { select: { id: true, quotationNumber: true } },
  sourceInvoice: { select: { id: true, invoiceNumber: true } },
  convertedTo: {
    where: { deletedAt: null },
    select: { id: true, invoiceNumber: true },
  },
} satisfies Prisma.SalesInvoiceInclude;

type InvoiceRow = Prisma.SalesInvoiceGetPayload<{ include: typeof INCLUDE }>;

export interface InvoiceData extends DocumentData {
  invoiceDate: Date;
  dueDate: Date | null;
  paymentTerms: string | null;
}

export interface InvoiceFilter extends DocumentFilter {
  invoiceType?: InvoiceType | undefined;
  status?: InvoiceStatus | undefined;
}

export interface NewPayment {
  amount: number;
  paymentDate: Date;
  mode: PaymentMode;
  reference: string | null;
  notes: string | null;
}

type NumberSpec = { format: CodeFormat; fiscalYear: string };

const typeCode = (t: InvoiceType) =>
  t === "PROFORMA" ? "proforma_invoice" : "tax_invoice";

function toView(row: InvoiceRow) {
  const { lines, payments, convertedTo, ...rest } = row;
  return {
    ...rest,
    balance: row.totalAmount.minus(row.amountReceived),
    lines: lines.map((l) => ({
      lineNo: l.lineNo,
      description: l.description,
      hsnCode: l.hsnCode,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      amount: l.amount,
    })),
    payments: payments.map((p) => ({
      id: p.id,
      paymentDate: p.paymentDate,
      amount: p.amount,
      mode: p.mode,
      reference: p.reference,
      notes: p.notes,
      createdAt: p.createdAt,
    })),
    convertedTo: convertedTo[0] ?? null,
    amountInWords: amountInWords(row.totalAmount),
  };
}

export type InvoiceView = ReturnType<typeof toView>;

const locked = (number: string) =>
  new BusinessRuleConflictException(
    `Proforma invoice ${number} has been moved to a tax invoice and can no longer be changed`,
    "DOCUMENT_LOCKED",
  );

/** The only place `PrismaService` is called for invoices and their
 * payments. Every write is one transaction holding the change and its audit
 * row(s); a conversion writes both documents in the same transaction. */
@Injectable()
export class InvoicesRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditWriter,
  ) {}

  @OrgScoped()
  async findMany(
    scope: OrgScope,
    filter: InvoiceFilter,
    pagination: PaginationDto,
  ) {
    const where = tenantWhere<Prisma.SalesInvoiceWhereInput>(scope, {
      deletedAt: null,
      ...(filter.invoiceType ? { invoiceType: filter.invoiceType } : {}),
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.customerId ? { customerId: filter.customerId } : {}),
      ...(filter.from || filter.to
        ? {
            invoiceDate: {
              ...(filter.from ? { gte: filter.from } : {}),
              ...(filter.to ? { lte: filter.to } : {}),
            },
          }
        : {}),
      ...searchWhere(filter.search, "invoiceNumber"),
    });
    const [rows, total] = await Promise.all([
      this.prisma.salesInvoice.findMany({
        where,
        include: INCLUDE,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: [
          { invoiceDate: pagination.order ?? "desc" },
          { id: pagination.order ?? "desc" },
        ],
      }),
      this.prisma.salesInvoice.count({ where }),
    ]);
    return { items: rows.map(toView), total };
  }

  @OrgScoped()
  async findOne(scope: OrgScope, id: number) {
    const row = await this.prisma.salesInvoice.findFirst({
      where: tenantWhere(scope, { id, deletedAt: null }),
      include: INCLUDE,
    });
    return row ? toView(row) : null;
  }

  @OrgScoped()
  async create(
    scope: OrgScope,
    invoiceType: InvoiceType,
    input: InvoiceData,
    number: NumberSpec,
    actorId: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const row = await this.insert(tx, scope, invoiceType, input, number, {
        actorId,
      });
      return toView(row);
    });
  }

  /** Quotation → invoice. Locks the quotation; refuses one that is gone or
   * already converted, and marks it CONVERTED with the invoice. */
  @OrgScoped()
  async createFromQuotation(
    scope: OrgScope,
    quotationId: number,
    invoiceType: InvoiceType,
    input: InvoiceData,
    number: NumberSpec,
    actorId: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT id FROM sales.quotations
         WHERE id = ${quotationId} AND organization_id = ${scope.organizationId}
         FOR UPDATE`;
      const quotation = await tx.salesQuotation.findFirst({
        where: tenantWhere(scope, { id: quotationId, deletedAt: null }),
        select: { id: true, quotationNumber: true, status: true },
      });
      if (!quotation) return null;
      if (quotation.status === "CONVERTED") {
        throw new BusinessRuleConflictException(
          `Quotation ${quotation.quotationNumber} has already been converted`,
          "ALREADY_CONVERTED",
        );
      }
      const row = await this.insert(tx, scope, invoiceType, input, number, {
        actorId,
        sourceQuotationId: quotationId,
      });
      await tx.salesQuotation.update({
        where: { id: quotationId },
        data: {
          status: "CONVERTED",
          convertedAt: new Date(),
          updatedBy: actorId,
        },
      });
      await this.audit.write(tx, {
        entityType: QUOTATION_ENTITY,
        entityId: quotationId,
        action: "convert",
        before: { status: quotation.status },
        after: {
          status: "CONVERTED",
          invoiceId: row.id,
          invoiceNumber: row.invoiceNumber,
        },
      });
      return toView(row);
    });
  }

  /** Proforma → tax invoice. Locks the proforma; its payments move to the
   * tax invoice and it becomes CONVERTED (locked). */
  @OrgScoped()
  async convertProforma(
    scope: OrgScope,
    proformaId: number,
    input: InvoiceData,
    number: NumberSpec,
    actorId: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const pi = await this.lockLive(tx, scope, proformaId);
      if (!pi) return null;
      if (pi.invoiceType !== "PROFORMA") {
        throw new BusinessRuleViolationException(
          `${pi.invoiceNumber} is already a tax invoice`,
          "NOT_A_PROFORMA",
        );
      }
      if (pi.status === "CONVERTED") {
        throw new BusinessRuleConflictException(
          `Proforma invoice ${pi.invoiceNumber} has already been moved to a tax invoice`,
          "ALREADY_CONVERTED",
        );
      }
      const created = await this.insert(tx, scope, "TAX", input, number, {
        actorId,
        sourceInvoiceId: proformaId,
        sourceQuotationId: pi.sourceQuotationId,
      });
      if (pi.amountReceived.greaterThan(created.totalAmount)) {
        throw new BusinessRuleViolationException(
          `${pi.invoiceNumber} has received ${pi.amountReceived.toFixed(2)}, more than the tax invoice total`,
          "TOTAL_BELOW_RECEIVED",
        );
      }
      await tx.salesInvoicePayment.updateMany({
        where: { invoiceId: proformaId, deletedAt: null },
        data: { invoiceId: created.id, updatedBy: actorId },
      });
      await tx.salesInvoice.update({
        where: { id: created.id },
        data: {
          amountReceived: pi.amountReceived,
          status: paymentStatus(created.totalAmount, pi.amountReceived),
        },
      });
      await tx.salesInvoice.update({
        where: { id: proformaId },
        data: {
          status: "CONVERTED",
          convertedAt: new Date(),
          amountReceived: 0,
          updatedBy: actorId,
        },
      });
      await this.audit.write(tx, {
        entityType: ENTITY_TYPE,
        entityId: proformaId,
        action: "convert",
        before: { status: pi.status },
        after: {
          status: "CONVERTED",
          invoiceId: created.id,
          invoiceNumber: created.invoiceNumber,
          paymentsMoved: pi.payments.length,
        },
      });
      const row = await tx.salesInvoice.findUniqueOrThrow({
        where: { id: created.id },
        include: INCLUDE,
      });
      return toView(row);
    });
  }

  /** null when not in scope (→ 404). Locks the row; a converted proforma is
   * refused, and the new total may not drop below what was received. */
  @OrgScoped()
  async update(
    scope: OrgScope,
    id: number,
    input: InvoiceData,
    actorId: number,
  ) {
    const { lines, ...data } = input;
    return this.prisma.$transaction(async (tx) => {
      const before = await this.lockLive(tx, scope, id);
      if (!before) return null;
      if (before.status === "CONVERTED") throw locked(before.invoiceNumber);
      if (before.amountReceived.greaterThan(data.totalAmount)) {
        throw new BusinessRuleViolationException(
          `${before.invoiceNumber} has received ${before.amountReceived.toFixed(2)}; the total cannot go below that`,
          "TOTAL_BELOW_RECEIVED",
        );
      }
      await tx.salesInvoice.update({
        where: { id },
        data: {
          ...columns(data),
          status: paymentStatus(data.totalAmount, before.amountReceived),
          updatedBy: actorId,
        },
      });
      await tx.salesInvoiceLine.updateMany({
        where: { invoiceId: id, deletedAt: null },
        data: { deletedAt: new Date(), updatedBy: actorId },
      });
      await tx.salesInvoiceLine.createMany({
        data: lineRows(lines, actorId).map((l) => ({
          ...l,
          organizationId: scope.organizationId,
          invoiceId: id,
        })),
      });
      const after = await tx.salesInvoice.findUniqueOrThrow({
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

  /**
   * false when not in scope (→ 404). Refused while payments or delivery
   * challans hang off it, or once converted. Deleting a converted-to
   * document reopens its source (quotation → OPEN, proforma → UNPAID).
   */
  @OrgScoped()
  async softDelete(scope: OrgScope, id: number, actorId: number) {
    return this.prisma.$transaction(async (tx) => {
      const before = await this.lockLive(tx, scope, id);
      if (!before) return false;
      if (before.status === "CONVERTED") throw locked(before.invoiceNumber);
      if (before.payments.length) {
        throw new BusinessRuleConflictException(
          `${before.invoiceNumber} has payments; delete them first`,
          "INVOICE_HAS_PAYMENTS",
        );
      }
      const dcs = await tx.salesDeliveryChallan.count({
        where: { sourceInvoiceId: id, deletedAt: null },
      });
      if (dcs) {
        throw new BusinessRuleConflictException(
          `${before.invoiceNumber} has delivery challans; delete them first`,
          "INVOICE_HAS_DELIVERY_CHALLANS",
        );
      }
      const now = new Date();
      await tx.salesInvoice.update({
        where: { id },
        data: { deletedAt: now, updatedBy: actorId },
      });
      await tx.salesInvoiceLine.updateMany({
        where: { invoiceId: id, deletedAt: null },
        data: { deletedAt: now, updatedBy: actorId },
      });
      if (before.sourceInvoiceId !== null) {
        // Its payments moved here, and there are none left — so it reopens
        // with nothing received.
        const source = await tx.salesInvoice.findUniqueOrThrow({
          where: { id: before.sourceInvoiceId },
          select: { totalAmount: true },
        });
        await tx.salesInvoice.update({
          where: { id: before.sourceInvoiceId },
          data: {
            status: paymentStatus(source.totalAmount, new Prisma.Decimal(0)),
            convertedAt: null,
            updatedBy: actorId,
          },
        });
      } else if (before.sourceQuotationId !== null) {
        await tx.salesQuotation.updateMany({
          where: { id: before.sourceQuotationId, status: "CONVERTED" },
          data: { status: "OPEN", convertedAt: null, updatedBy: actorId },
        });
      }
      await this.audit.write(tx, {
        entityType: ENTITY_TYPE,
        entityId: id,
        action: "delete",
        before: snapshot(before),
      });
      return true;
    });
  }

  /** null when the invoice is not in scope. The amount may not exceed the
   * balance (checked under the invoice's lock). */
  @OrgScoped()
  async recordPayment(
    scope: OrgScope,
    invoiceId: number,
    payment: NewPayment,
    actorId: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const invoice = await this.lockLive(tx, scope, invoiceId);
      if (!invoice) return null;
      if (invoice.status === "CONVERTED") throw locked(invoice.invoiceNumber);
      const balance = invoice.totalAmount.minus(invoice.amountReceived);
      if (balance.lessThan(payment.amount)) {
        throw new BusinessRuleViolationException(
          `${invoice.invoiceNumber} has a balance of ${balance.toFixed(2)}; the payment cannot exceed it`,
          "PAYMENT_EXCEEDS_BALANCE",
        );
      }
      const created = await tx.salesInvoicePayment.create({
        data: {
          ...payment,
          organizationId: scope.organizationId,
          invoiceId,
          createdBy: actorId,
          updatedBy: actorId,
        },
      });
      const received = invoice.amountReceived.plus(payment.amount);
      await tx.salesInvoice.update({
        where: { id: invoiceId },
        data: {
          amountReceived: received,
          status: paymentStatus(invoice.totalAmount, received),
          updatedBy: actorId,
        },
      });
      await this.audit.write(tx, {
        entityType: ENTITY_TYPE,
        entityId: invoiceId,
        action: "record_payment",
        after: {
          paymentId: created.id,
          amount: created.amount.toString(),
          mode: created.mode,
          amountReceived: received.toString(),
        },
      });
      const row = await tx.salesInvoice.findUniqueOrThrow({
        where: { id: invoiceId },
        include: INCLUDE,
      });
      return toView(row);
    });
  }

  /** null when the invoice or the payment is not in scope (→ 404). */
  @OrgScoped()
  async deletePayment(
    scope: OrgScope,
    invoiceId: number,
    paymentId: number,
    actorId: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const invoice = await this.lockLive(tx, scope, invoiceId);
      if (!invoice) return null;
      if (invoice.status === "CONVERTED") throw locked(invoice.invoiceNumber);
      const payment = invoice.payments.find((p) => p.id === paymentId);
      if (!payment) return null;
      await tx.salesInvoicePayment.update({
        where: { id: paymentId },
        data: { deletedAt: new Date(), updatedBy: actorId },
      });
      const received = invoice.amountReceived.minus(payment.amount);
      await tx.salesInvoice.update({
        where: { id: invoiceId },
        data: {
          amountReceived: received,
          status: paymentStatus(invoice.totalAmount, received),
          updatedBy: actorId,
        },
      });
      await this.audit.write(tx, {
        entityType: ENTITY_TYPE,
        entityId: invoiceId,
        action: "delete_payment",
        before: {
          paymentId,
          amount: payment.amount.toString(),
          mode: payment.mode,
        },
        after: { amountReceived: received.toString() },
      });
      const row = await tx.salesInvoice.findUniqueOrThrow({
        where: { id: invoiceId },
        include: INCLUDE,
      });
      return toView(row);
    });
  }

  private async insert(
    tx: Prisma.TransactionClient,
    scope: OrgScope,
    invoiceType: InvoiceType,
    input: InvoiceData,
    number: NumberSpec,
    meta: {
      actorId: number;
      sourceQuotationId?: number | null;
      sourceInvoiceId?: number;
    },
  ) {
    const { lines, ...data } = input;
    const invoiceNumber = await issueDocumentNumber(
      tx,
      scope.organizationId,
      typeCode(invoiceType),
      number.format,
      number.fiscalYear,
    );
    const created = await tx.salesInvoice.create({
      data: {
        ...columns(data),
        invoiceType,
        invoiceNumber,
        status: paymentStatus(data.totalAmount, new Prisma.Decimal(0)),
        sourceQuotationId: meta.sourceQuotationId ?? null,
        sourceInvoiceId: meta.sourceInvoiceId ?? null,
        organizationId: scope.organizationId,
        createdBy: meta.actorId,
        updatedBy: meta.actorId,
      },
    });
    await tx.salesInvoiceLine.createMany({
      data: lineRows(lines, meta.actorId).map((l) => ({
        ...l,
        organizationId: scope.organizationId,
        invoiceId: created.id,
      })),
    });
    const row = await tx.salesInvoice.findUniqueOrThrow({
      where: { id: created.id },
      include: INCLUDE,
    });
    await this.audit.write(tx, {
      entityType: ENTITY_TYPE,
      entityId: row.id,
      action: "create",
      after: snapshot(row),
    });
    return row;
  }

  private async lockLive(
    tx: Prisma.TransactionClient,
    scope: OrgScope,
    id: number,
  ) {
    await tx.$queryRaw`
      SELECT id FROM sales.invoices
       WHERE id = ${id} AND organization_id = ${scope.organizationId}
       FOR UPDATE`;
    return tx.salesInvoice.findFirst({
      where: tenantWhere(scope, { id, deletedAt: null }),
      include: INCLUDE,
    });
  }
}

function columns(data: Omit<InvoiceData, "lines">) {
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

function snapshot(row: InvoiceRow) {
  return {
    invoiceType: row.invoiceType,
    invoiceNumber: row.invoiceNumber,
    invoiceDate: row.invoiceDate,
    dueDate: row.dueDate,
    status: row.status,
    amountReceived: row.amountReceived.toString(),
    ...pricedSnapshot(row),
  };
}
