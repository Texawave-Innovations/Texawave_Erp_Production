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
import { paymentStatus } from "./document-totals.js";
import { issueDocumentNumber } from "./document-repository.helpers.js";
import {
  effectiveDueDate,
  OPEN_INVOICE_STATUSES,
  overdueDays,
} from "./payments.rules.js";

const ENTITY_TYPE = "sales_payment";

const INCLUDE = {
  invoice: {
    select: {
      id: true,
      invoiceNumber: true,
      invoiceType: true,
      invoiceDate: true,
      dueDate: true,
      status: true,
      totalAmount: true,
      amountReceived: true,
      customer: {
        select: { id: true, customerCode: true, companyName: true },
      },
    },
  },
} satisfies Prisma.SalesInvoicePaymentInclude;

type PaymentRow = Prisma.SalesInvoicePaymentGetPayload<{
  include: typeof INCLUDE;
}>;

/** A payment's own fields, as the service resolved them. */
export interface PaymentData {
  amount: number;
  paymentDate: Date;
  dueDate: Date | null;
  mode: string;
  modeItemId: number | null;
  reference: string | null;
  notes: string | null;
}

export interface PaymentFilter {
  search?: string | undefined;
  customerId?: number | undefined;
  invoiceId?: number | undefined;
  paid?: { from: Date; to: Date } | undefined;
  due?: { from: Date; to: Date } | undefined;
  overdueOnly?: boolean | undefined;
}

function toView(row: PaymentRow, today: Date) {
  const { invoice, ...rest } = row;
  const { customer, ...inv } = invoice;
  const due = effectiveDueDate(row.dueDate, invoice.dueDate);
  return {
    ...rest,
    effectiveDueDate: due,
    overdueDays: overdueDays(due, invoice.status, today),
    invoice: {
      ...inv,
      balance: invoice.totalAmount.minus(invoice.amountReceived),
    },
    customer,
  };
}

export type PaymentView = ReturnType<typeof toView>;

function snapshot(row: {
  paymentNumber: string;
  invoiceId: number;
  amount: Prisma.Decimal;
  paymentDate: Date;
  dueDate: Date | null;
  mode: string;
  reference: string | null;
}) {
  return {
    paymentNumber: row.paymentNumber,
    invoiceId: row.invoiceId,
    amount: row.amount.toString(),
    paymentDate: row.paymentDate,
    dueDate: row.dueDate,
    mode: row.mode,
    reference: row.reference,
  };
}

/** Due (the payment's date, else the invoice's) before `today`, while the
 * invoice still has a balance. */
function overdueWhere(today: Date): Prisma.SalesInvoicePaymentWhereInput {
  return {
    invoice: { status: { in: [...OPEN_INVOICE_STATUSES] } },
    OR: [
      { dueDate: { lt: today } },
      { dueDate: null, invoice: { dueDate: { lt: today } } },
    ],
  };
}

function dueWithin(range: {
  from: Date;
  to: Date;
}): Prisma.SalesInvoicePaymentWhereInput {
  const within = { gte: range.from, lte: range.to };
  return {
    OR: [{ dueDate: within }, { dueDate: null, invoice: { dueDate: within } }],
  };
}

function searchWhere(
  search: string | undefined,
): Prisma.SalesInvoicePaymentWhereInput {
  if (!search) return {};
  const contains = { contains: search, mode: "insensitive" } as const;
  return {
    OR: [
      { paymentNumber: contains },
      { reference: contains },
      { invoice: { invoiceNumber: contains } },
      { invoice: { customer: { companyName: contains } } },
      { invoice: { customer: { customerCode: contains } } },
    ],
  };
}

const conflict = (number: string) =>
  new BusinessRuleConflictException(
    `Proforma invoice ${number} has been moved to a tax invoice and can no longer be changed`,
    "DOCUMENT_LOCKED",
  );

/**
 * The only place `PrismaService` is called for payments received. Every
 * write locks the invoice row first (the same lock invoice edits take), so
 * the live payments never exceed its total, and updates the invoice's
 * `amount_received` / status in the same transaction as its audit row.
 */
@Injectable()
export class PaymentsRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditWriter,
  ) {}

  @OrgScoped()
  async findMany(
    scope: OrgScope,
    filter: PaymentFilter,
    pagination: PaginationDto,
    today: Date,
  ) {
    const and: Prisma.SalesInvoicePaymentWhereInput[] = [
      searchWhere(filter.search),
    ];
    if (filter.due) and.push(dueWithin(filter.due));
    if (filter.overdueOnly) and.push(overdueWhere(today));
    const where = tenantWhere<Prisma.SalesInvoicePaymentWhereInput>(scope, {
      deletedAt: null,
      invoice: {
        deletedAt: null,
        ...(filter.customerId ? { customerId: filter.customerId } : {}),
      },
      ...(filter.invoiceId ? { invoiceId: filter.invoiceId } : {}),
      ...(filter.paid
        ? { paymentDate: { gte: filter.paid.from, lte: filter.paid.to } }
        : {}),
      AND: and,
    });
    const [rows, total] = await Promise.all([
      this.prisma.salesInvoicePayment.findMany({
        where,
        include: INCLUDE,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: [
          { paymentDate: pagination.order ?? "desc" },
          { id: pagination.order ?? "desc" },
        ],
      }),
      this.prisma.salesInvoicePayment.count({ where }),
    ]);
    return { items: rows.map((r) => toView(r, today)), total };
  }

  @OrgScoped()
  async findOne(scope: OrgScope, id: number, today: Date) {
    const row = await this.prisma.salesInvoicePayment.findFirst({
      where: tenantWhere(scope, { id, deletedAt: null }),
      include: INCLUDE,
    });
    return row ? toView(row, today) : null;
  }

  /** The "Due Date Intimation Alerts" banner: overdue payments, the
   * invoices they belong to, and those invoices' unpaid balance. */
  @OrgScoped()
  async overdueSummary(scope: OrgScope, today: Date) {
    const rows = await this.prisma.salesInvoicePayment.findMany({
      where: tenantWhere<Prisma.SalesInvoicePaymentWhereInput>(scope, {
        deletedAt: null,
        invoice: { deletedAt: null },
        AND: [overdueWhere(today)],
      }),
      select: {
        invoiceId: true,
        invoice: { select: { totalAmount: true, amountReceived: true } },
      },
    });
    const balances = new Map<number, Prisma.Decimal>();
    for (const r of rows) {
      balances.set(
        r.invoiceId,
        r.invoice.totalAmount.minus(r.invoice.amountReceived),
      );
    }
    let balance = new Prisma.Decimal(0);
    for (const b of balances.values()) balance = balance.plus(b);
    return {
      overduePayments: rows.length,
      overdueInvoices: balances.size,
      overdueBalance: balance,
    };
  }

  /** null when the invoice is not in scope (→ 404). */
  @OrgScoped()
  async create(
    scope: OrgScope,
    invoiceId: number,
    data: PaymentData,
    number: { format: CodeFormat; fiscalYear: string },
    actorId: number,
    today: Date,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const invoice = await this.lockInvoice(tx, scope, invoiceId);
      if (!invoice) return null;
      const received = invoice.amountReceived.plus(data.amount);
      this.assertWithinTotal(invoice, received);
      const paymentNumber = await issueDocumentNumber(
        tx,
        scope.organizationId,
        "payment_received",
        number.format,
        number.fiscalYear,
      );
      const created = await tx.salesInvoicePayment.create({
        data: {
          ...data,
          paymentNumber,
          invoiceId,
          organizationId: scope.organizationId,
          createdBy: actorId,
          updatedBy: actorId,
        },
      });
      await this.setReceived(tx, invoice, received, actorId);
      await this.audit.write(tx, {
        entityType: ENTITY_TYPE,
        entityId: created.id,
        action: "create",
        after: { ...snapshot(created), amountReceived: received.toString() },
      });
      return this.reload(tx, created.id, today);
    });
  }

  /** null when the payment is not in scope (→ 404). */
  @OrgScoped()
  async update(
    scope: OrgScope,
    id: number,
    data: PaymentData,
    actorId: number,
    today: Date,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const located = await this.locate(tx, scope, id);
      if (!located) return null;
      const { invoice, payment } = located;
      const received = invoice.amountReceived
        .minus(payment.amount)
        .plus(data.amount);
      this.assertWithinTotal(invoice, received);
      const updated = await tx.salesInvoicePayment.update({
        where: { id },
        data: { ...data, updatedBy: actorId },
      });
      await this.setReceived(tx, invoice, received, actorId);
      await this.audit.write(tx, {
        entityType: ENTITY_TYPE,
        entityId: id,
        action: "update",
        before: snapshot(payment),
        after: { ...snapshot(updated), amountReceived: received.toString() },
      });
      return this.reload(tx, id, today);
    });
  }

  /** false when the payment is not in scope (→ 404). `invoiceId`, when
   * given, must be the payment's invoice (the invoice route). */
  @OrgScoped()
  async softDelete(
    scope: OrgScope,
    id: number,
    actorId: number,
    invoiceId?: number,
  ): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const located = await this.locate(tx, scope, id);
      if (!located) return false;
      const { invoice, payment } = located;
      if (invoiceId !== undefined && invoice.id !== invoiceId) return false;
      await tx.salesInvoicePayment.update({
        where: { id },
        data: { deletedAt: new Date(), updatedBy: actorId },
      });
      const received = invoice.amountReceived.minus(payment.amount);
      await this.setReceived(tx, invoice, received, actorId);
      await this.audit.write(tx, {
        entityType: ENTITY_TYPE,
        entityId: id,
        action: "delete",
        before: snapshot(payment),
        after: { amountReceived: received.toString() },
      });
      return true;
    });
  }

  /** The live payment and its invoice, with the invoice row locked. */
  private async locate(
    tx: Prisma.TransactionClient,
    scope: OrgScope,
    id: number,
  ) {
    const found = await tx.salesInvoicePayment.findFirst({
      where: tenantWhere(scope, { id, deletedAt: null }),
      select: { invoiceId: true },
    });
    if (!found) return null;
    const invoice = await this.lockInvoice(tx, scope, found.invoiceId);
    // Re-read under the lock: a concurrent delete may have won.
    const payment = await tx.salesInvoicePayment.findFirst({
      where: tenantWhere(scope, {
        id,
        invoiceId: found.invoiceId,
        deletedAt: null,
      }),
    });
    if (!invoice || !payment) return null;
    return { invoice, payment };
  }

  private async lockInvoice(
    tx: Prisma.TransactionClient,
    scope: OrgScope,
    invoiceId: number,
  ) {
    await tx.$queryRaw`
      SELECT id FROM sales.invoices
       WHERE id = ${invoiceId} AND organization_id = ${scope.organizationId}
       FOR UPDATE`;
    const invoice = await tx.salesInvoice.findFirst({
      where: tenantWhere(scope, { id: invoiceId, deletedAt: null }),
      select: {
        id: true,
        invoiceNumber: true,
        status: true,
        totalAmount: true,
        amountReceived: true,
      },
    });
    if (invoice?.status === "CONVERTED") {
      throw conflict(invoice.invoiceNumber);
    }
    return invoice;
  }

  private assertWithinTotal(
    invoice: {
      invoiceNumber: string;
      totalAmount: Prisma.Decimal;
      amountReceived: Prisma.Decimal;
    },
    received: Prisma.Decimal,
  ) {
    if (received.greaterThan(invoice.totalAmount)) {
      const balance = invoice.totalAmount.minus(invoice.amountReceived);
      throw new BusinessRuleViolationException(
        `${invoice.invoiceNumber} has a balance of ${balance.toFixed(2)}; the payment cannot exceed it`,
        "PAYMENT_EXCEEDS_BALANCE",
      );
    }
  }

  private async setReceived(
    tx: Prisma.TransactionClient,
    invoice: { id: number; totalAmount: Prisma.Decimal },
    received: Prisma.Decimal,
    actorId: number,
  ) {
    await tx.salesInvoice.update({
      where: { id: invoice.id },
      data: {
        amountReceived: received,
        status: paymentStatus(invoice.totalAmount, received),
        updatedBy: actorId,
      },
    });
  }

  private async reload(tx: Prisma.TransactionClient, id: number, today: Date) {
    const row = await tx.salesInvoicePayment.findUniqueOrThrow({
      where: { id },
      include: INCLUDE,
    });
    return toView(row, today);
  }
}
