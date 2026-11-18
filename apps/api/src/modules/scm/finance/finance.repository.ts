import { Injectable } from "@nestjs/common";
import { Prisma } from "@texawave-erp/database";
import { OrgScoped } from "../../../common/decorators/org-scoped.decorator.js";
import type { PaginationDto } from "../../../common/dto/pagination.dto.js";
import {
  BusinessRuleViolationException,
  ResourceConflictException,
  ResourceNotFoundException,
} from "../../../common/exceptions/business.exception.js";
import type { OrgScope } from "../../../common/tenancy/org-scope.js";
import { tenantWhere } from "../../../common/tenancy/tenant-where.js";
import { AuditWriter } from "../../../platform/audit/audit-writer.js";
import { PrismaService } from "../../../shared/prisma/prisma.service.js";
import { toDate } from "../common/scm-actor.helpers.js";
import { ScmNumberingService } from "../common/scm-numbering.service.js";
import { SUPPLIER_ENTITY_TYPE } from "../suppliers/suppliers.repository.js";
import type {
  CreateBillDto,
  CreatePaymentDto,
  UpdateBillDto,
} from "./dto/finance.dto.js";
import {
  billStatusFor,
  dueDateFrom,
  isOverdue,
  outstanding,
} from "./finance.helpers.js";

const rule = (message: string, code: string) =>
  new BusinessRuleViolationException(message, code);

const num = (d: Prisma.Decimal | number | null | undefined) => Number(d ?? 0);
const round2 = (n: number) => Math.round(n * 100) / 100;

const billInclude = {
  supplier: {
    select: {
      id: true,
      supplierCode: true,
      companyName: true,
      gstin: true,
      state: true,
    },
  },
  purchaseOrder: { select: { id: true, poNumber: true } },
  goodsReceipt: { select: { id: true, grnNumber: true } },
} satisfies Prisma.ScmSupplierBillInclude;

const paymentInclude = {
  supplier: {
    select: {
      id: true,
      supplierCode: true,
      companyName: true,
      gstin: true,
      state: true,
    },
  },
  bill: { select: { id: true, billNumber: true, supplierBillNumber: true } },
} satisfies Prisma.ScmSupplierPaymentInclude;

type BillRow = Prisma.ScmSupplierBillGetPayload<{
  include: typeof billInclude;
}>;

/** Adds the derived fields every bill response carries. */
const withDerived = (b: BillRow) => ({
  ...b,
  outstanding: outstanding(num(b.total), num(b.paidAmount)),
  overdue: isOverdue(b),
});

export interface BillFilter {
  q?: string | undefined;
  status?: string | undefined;
  supplierId?: number | undefined;
  overdue?: boolean | undefined;
}

export interface PaymentFilter {
  q?: string | undefined;
  supplierId?: number | undefined;
  billId?: number | undefined;
  status?: string | undefined;
}

@Injectable()
export class FinanceRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditWriter,
    private readonly numbering: ScmNumberingService,
  ) {}

  // ---- bills: reads ---------------------------------------------------------

  @OrgScoped()
  async findBills(scope: OrgScope, f: BillFilter, page: PaginationDto) {
    const today = new Date();
    const todayUtc = new Date(
      Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()),
    );
    const where = tenantWhere<Prisma.ScmSupplierBillWhereInput>(scope, {
      ...(f.status ? { status: f.status } : {}),
      ...(f.supplierId ? { supplierId: f.supplierId } : {}),
      ...(f.overdue
        ? {
            status: { in: ["OPEN", "PARTIALLY_PAID"] },
            dueDate: { lt: todayUtc },
          }
        : {}),
      ...(f.q
        ? {
            OR: [
              { billNumber: { contains: f.q, mode: "insensitive" } },
              { supplierBillNumber: { contains: f.q, mode: "insensitive" } },
              {
                supplier: {
                  companyName: { contains: f.q, mode: "insensitive" },
                },
              },
            ],
          }
        : {}),
    });
    const [rows, total] = await Promise.all([
      this.prisma.scmSupplierBill.findMany({
        where,
        include: billInclude,
        skip: page.skip,
        take: page.limit,
        orderBy: [{ billDate: "desc" }, { id: "desc" }],
      }),
      this.prisma.scmSupplierBill.count({ where }),
    ]);
    return { items: rows.map(withDerived), total };
  }

  @OrgScoped()
  async findBill(scope: OrgScope, id: number) {
    const row = await this.prisma.scmSupplierBill.findFirst({
      where: tenantWhere(scope, { id }),
      include: {
        ...billInclude,
        payments: { orderBy: [{ paymentDate: "desc" }, { id: "desc" }] },
      },
    });
    return row
      ? {
          ...row,
          outstanding: outstanding(num(row.total), num(row.paidAmount)),
          overdue: isOverdue(row),
        }
      : null;
  }

  @OrgScoped()
  async findBillForPosting(scope: OrgScope, id: number) {
    return this.prisma.scmSupplierBill.findFirst({
      where: tenantWhere(scope, { id }),
      include: {
        supplier: {
          select: {
            id: true,
            supplierCode: true,
            companyName: true,
            gstin: true,
            state: true,
          },
        },
        purchaseOrder: {
          select: {
            id: true,
            poNumber: true,
            items: {
              select: {
                id: true,
                lineNo: true,
                quantity: true,
                unitPrice: true,
                taxRate: true,
                taxAmount: true,
                total: true,
                product: {
                  select: {
                    id: true,
                    productCode: true,
                    name: true,
                    hsn: true,
                  },
                },
              },
            },
          },
        },
        goodsReceipt: { select: { id: true, grnNumber: true } },
      },
    });
  }

  /** Per-supplier payables position for the Bills / Payments tab headers. */
  @OrgScoped()
  async supplierSummary(scope: OrgScope, supplierId: number) {
    const [bills, payments] = await Promise.all([
      this.prisma.scmSupplierBill.findMany({
        where: tenantWhere(scope, { supplierId, status: { not: "CANCELLED" } }),
        select: { total: true, paidAmount: true, status: true, dueDate: true },
      }),
      this.prisma.scmSupplierPayment.aggregate({
        where: tenantWhere(scope, { supplierId, status: "POSTED" }),
        _sum: { amount: true },
        _count: true,
      }),
    ]);
    let billed = 0;
    let paidAgainstBills = 0;
    let overdueAmount = 0;
    let overdueCount = 0;
    let openCount = 0;
    for (const b of bills) {
      billed += num(b.total);
      paidAgainstBills += num(b.paidAmount);
      if (b.status === "OPEN" || b.status === "PARTIALLY_PAID") {
        openCount += 1;
        if (isOverdue(b)) {
          overdueCount += 1;
          overdueAmount += outstanding(num(b.total), num(b.paidAmount));
        }
      }
    }
    const totalPaid = num(payments._sum.amount);
    return {
      billCount: bills.length,
      openBillCount: openCount,
      totalBilled: round2(billed),
      totalPaid: round2(totalPaid),
      outstanding: round2(billed - paidAgainstBills),
      overdueCount,
      overdueAmount: round2(overdueAmount),
      /** Payments not applied to any bill (advances / on-account). */
      unappliedPaid: round2(Math.max(0, totalPaid - paidAgainstBills)),
      paymentCount: payments._count,
    };
  }

  // ---- bills: writes ----------------------------------------------------------

  @OrgScoped()
  async createBill(scope: OrgScope, dto: CreateBillDto, actorId: number) {
    return this.prisma.$transaction(async (tx) => {
      const org = scope.organizationId;
      const supplier = await tx.supplier.findFirst({
        where: { id: dto.supplierId, organizationId: org, deletedAt: null },
      });
      if (!supplier)
        throw new ResourceNotFoundException("Supplier", dto.supplierId);
      if (supplier.status === "Blocked") {
        throw rule(
          "Bills cannot be raised against a blocked supplier.",
          "BILL_SUPPLIER_BLOCKED",
        );
      }

      let currency = supplier.currency;
      let purchaseOrderId: number | null = null;
      if (dto.purchaseOrderId) {
        const po = await tx.scmPurchaseOrder.findFirst({
          where: { id: dto.purchaseOrderId, organizationId: org },
        });
        if (!po || po.supplierId !== supplier.id) {
          throw rule(
            "The purchase order does not belong to this supplier.",
            "BILL_PO_MISMATCH",
          );
        }
        if (po.status === "CANCELLED" || po.status === "DRAFT") {
          throw rule(
            `A ${po.status.toLowerCase()} purchase order cannot be billed.`,
            "BILL_PO_STATE",
          );
        }
        purchaseOrderId = po.id;
        currency = po.currency;
      }
      let goodsReceiptId: number | null = null;
      if (dto.goodsReceiptId) {
        const grn = await tx.scmGoodsReceipt.findFirst({
          where: { id: dto.goodsReceiptId, organizationId: org },
        });
        if (!grn || grn.supplierId !== supplier.id) {
          throw rule(
            "The goods receipt does not belong to this supplier.",
            "BILL_GRN_MISMATCH",
          );
        }
        if (purchaseOrderId && grn.purchaseOrderId !== purchaseOrderId) {
          throw rule(
            "The goods receipt is not against the selected purchase order.",
            "BILL_GRN_MISMATCH",
          );
        }
        purchaseOrderId ??= grn.purchaseOrderId;
        goodsReceiptId = grn.id;
      }

      const supplierBillNumber = dto.supplierBillNumber?.trim() || null;
      if (supplierBillNumber)
        await this.assertInvoiceNumberFree(
          tx,
          org,
          supplier.id,
          supplierBillNumber,
        );

      const tax = dto.taxAmount ?? 0;
      const total = round2(dto.subtotal + tax);
      if (!(total > 0))
        throw rule(
          "A bill must have an amount greater than zero.",
          "BILL_AMOUNT",
        );
      const dueDate =
        dto.dueDate ?? dueDateFrom(dto.billDate, supplier.paymentTerms);
      if (dueDate && dueDate < dto.billDate) {
        throw rule(
          "The due date cannot be before the bill date.",
          "BILL_DATES",
        );
      }

      const billNumber = await this.numbering.next(tx, org, "supplierBill");
      const created = await tx.scmSupplierBill.create({
        data: {
          organizationId: org,
          billNumber,
          supplierBillNumber,
          supplierId: supplier.id,
          purchaseOrderId,
          goodsReceiptId,
          billDate: new Date(dto.billDate),
          dueDate: toDate(dueDate),
          currency,
          subtotal: dto.subtotal,
          taxAmount: tax,
          total,
          notes: dto.notes?.trim() || null,
          createdBy: actorId,
          updatedBy: actorId,
        },
        include: billInclude,
      });
      await this.audit.write(tx, {
        entityType: "scm_supplier_bill",
        entityId: created.id,
        action: "create",
        after: { billNumber, supplierId: supplier.id, total },
      });
      await this.audit.write(tx, {
        entityType: SUPPLIER_ENTITY_TYPE,
        entityId: supplier.id,
        action: "bill_create",
        after: { billNumber, total },
      });
      return withDerived(created);
    });
  }

  @OrgScoped()
  async updateBill(
    scope: OrgScope,
    id: number,
    dto: UpdateBillDto,
    actorId: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const bill = await this.lockBill(tx, scope, id);
      if (!bill) return null;
      if (bill.status !== "OPEN" || num(bill.paidAmount) > 0) {
        throw rule(
          "Only an open bill with no payments can be edited.",
          "BILL_LOCKED",
        );
      }
      const supplierBillNumber =
        dto.supplierBillNumber === undefined
          ? bill.supplierBillNumber
          : dto.supplierBillNumber.trim() || null;
      if (
        supplierBillNumber &&
        supplierBillNumber !== bill.supplierBillNumber
      ) {
        await this.assertInvoiceNumberFree(
          tx,
          scope.organizationId,
          bill.supplierId,
          supplierBillNumber,
          id,
        );
      }
      const subtotal = dto.subtotal ?? num(bill.subtotal);
      const tax = dto.taxAmount ?? num(bill.taxAmount);
      const total = round2(subtotal + tax);
      if (!(total > 0))
        throw rule(
          "A bill must have an amount greater than zero.",
          "BILL_AMOUNT",
        );
      const billDate = dto.billDate ?? bill.billDate.toISOString().slice(0, 10);
      const dueDate =
        dto.dueDate ??
        (bill.dueDate ? bill.dueDate.toISOString().slice(0, 10) : null);
      if (dueDate && dueDate < billDate) {
        throw rule(
          "The due date cannot be before the bill date.",
          "BILL_DATES",
        );
      }
      const after = await tx.scmSupplierBill.update({
        where: { id },
        data: {
          supplierBillNumber,
          billDate: new Date(billDate),
          dueDate: toDate(dueDate),
          subtotal,
          taxAmount: tax,
          total,
          notes:
            dto.notes === undefined ? bill.notes : dto.notes.trim() || null,
          updatedBy: actorId,
        },
        include: billInclude,
      });
      await this.audit.write(tx, {
        entityType: "scm_supplier_bill",
        entityId: id,
        action: "update",
        before: { total: num(bill.total) },
        after: { total },
      });
      return withDerived(after);
    });
  }

  @OrgScoped()
  async cancelBill(
    scope: OrgScope,
    id: number,
    reason: string,
    actorId: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const bill = await this.lockBill(tx, scope, id);
      if (!bill) return null;
      if (bill.status === "CANCELLED") {
        throw rule("This bill is already cancelled.", "BILL_LOCKED");
      }
      const posted = await tx.scmSupplierPayment.count({
        where: { billId: id, status: "POSTED" },
      });
      if (posted > 0 || num(bill.paidAmount) > 0) {
        throw rule(
          "A bill with payments cannot be cancelled — void the payments first.",
          "BILL_HAS_PAYMENTS",
        );
      }
      const after = await tx.scmSupplierBill.update({
        where: { id },
        data: {
          status: "CANCELLED",
          cancelledAt: new Date(),
          cancellationReason: reason,
          updatedBy: actorId,
        },
        include: billInclude,
      });
      await this.audit.write(tx, {
        entityType: "scm_supplier_bill",
        entityId: id,
        action: "status_change",
        before: { status: bill.status },
        after: { status: "CANCELLED" },
        reason,
      });
      return withDerived(after);
    });
  }

  // ---- payments ---------------------------------------------------------------

  @OrgScoped()
  async findPayments(scope: OrgScope, f: PaymentFilter, page: PaginationDto) {
    const where = tenantWhere<Prisma.ScmSupplierPaymentWhereInput>(scope, {
      ...(f.supplierId ? { supplierId: f.supplierId } : {}),
      ...(f.billId ? { billId: f.billId } : {}),
      ...(f.status ? { status: f.status } : {}),
      ...(f.q
        ? {
            OR: [
              { paymentNumber: { contains: f.q, mode: "insensitive" } },
              { referenceNumber: { contains: f.q, mode: "insensitive" } },
              {
                supplier: {
                  companyName: { contains: f.q, mode: "insensitive" },
                },
              },
            ],
          }
        : {}),
    });
    const [rows, total] = await Promise.all([
      this.prisma.scmSupplierPayment.findMany({
        where,
        include: paymentInclude,
        skip: page.skip,
        take: page.limit,
        orderBy: [{ paymentDate: "desc" }, { id: "desc" }],
      }),
      this.prisma.scmSupplierPayment.count({ where }),
    ]);
    return { items: rows, total };
  }

  /**
   * Creates a supplier payment (optionally applied to a bill, with row-locked
   * overpayment protection). Pass `externalTx` to run inside a transaction a
   * caller already opened — e.g. Finance Payments Made posting its GL
   * journal and this SCM payment atomically in one commit
   * (Docs/CODING_STANDARDS.md §11 synchronous cross-module write exception).
   * Omit it to open a dedicated transaction, as every existing caller does.
   */
  @OrgScoped()
  async createPayment(
    scope: OrgScope,
    dto: CreatePaymentDto,
    actorId: number,
    externalTx?: Prisma.TransactionClient,
  ) {
    const run = async (tx: Prisma.TransactionClient) => {
      const org = scope.organizationId;
      const supplier = await tx.supplier.findFirst({
        where: { id: dto.supplierId, organizationId: org, deletedAt: null },
      });
      if (!supplier)
        throw new ResourceNotFoundException("Supplier", dto.supplierId);

      let currency = supplier.currency;
      if (dto.billId) {
        const bill = await this.lockBill(tx, scope, dto.billId);
        if (!bill || bill.supplierId !== supplier.id) {
          throw rule(
            "The bill does not belong to this supplier.",
            "PAYMENT_BILL_MISMATCH",
          );
        }
        if (bill.status !== "OPEN" && bill.status !== "PARTIALLY_PAID") {
          throw rule(
            `A ${bill.status.toLowerCase().replace("_", " ")} bill cannot take a payment.`,
            "PAYMENT_BILL_STATE",
          );
        }
        const due = outstanding(num(bill.total), num(bill.paidAmount));
        if (Math.round(dto.amount * 100) > Math.round(due * 100)) {
          throw rule(
            `The payment exceeds the ${due.toFixed(2)} still outstanding on ${bill.billNumber}.`,
            "PAYMENT_OVERPAY",
          );
        }
        currency = bill.currency;
        const paid = round2(num(bill.paidAmount) + dto.amount);
        await tx.scmSupplierBill.update({
          where: { id: bill.id },
          data: {
            paidAmount: paid,
            status: billStatusFor(num(bill.total), paid),
            updatedBy: actorId,
          },
        });
      }

      const paymentNumber = await this.numbering.next(
        tx,
        org,
        "supplierPayment",
      );
      const created = await tx.scmSupplierPayment.create({
        data: {
          organizationId: org,
          paymentNumber,
          supplierId: supplier.id,
          billId: dto.billId ?? null,
          paymentDate: new Date(dto.paymentDate),
          mode: dto.mode,
          referenceNumber: dto.referenceNumber?.trim() || null,
          amount: dto.amount,
          currency,
          notes: dto.notes?.trim() || null,
          createdBy: actorId,
        },
        include: paymentInclude,
      });
      await this.audit.write(tx, {
        entityType: "scm_supplier_payment",
        entityId: created.id,
        action: "create",
        after: {
          paymentNumber,
          supplierId: supplier.id,
          billId: dto.billId ?? null,
          amount: dto.amount,
        },
      });
      await this.audit.write(tx, {
        entityType: SUPPLIER_ENTITY_TYPE,
        entityId: supplier.id,
        action: "payment_create",
        after: { paymentNumber, amount: dto.amount },
      });
      return created;
    };
    return externalTx ? run(externalTx) : this.prisma.$transaction(run);
  }

  /** See `createPayment`'s `externalTx` doc — same atomicity exception. */
  @OrgScoped()
  async voidPayment(
    scope: OrgScope,
    id: number,
    reason: string,
    actorId: number,
    externalTx?: Prisma.TransactionClient,
  ) {
    const run = async (tx: Prisma.TransactionClient) => {
      const org = scope.organizationId;
      await tx.$queryRaw`SELECT id FROM scm.supplier_payments WHERE id = ${id} AND organization_id = ${org} FOR UPDATE`;
      const payment = await tx.scmSupplierPayment.findFirst({
        where: { id, organizationId: org },
      });
      if (!payment) return null;
      if (payment.status !== "POSTED") {
        throw rule("This payment is already void.", "PAYMENT_VOID");
      }
      if (payment.billId) {
        const bill = await this.lockBill(tx, scope, payment.billId);
        if (bill) {
          const paid = round2(
            Math.max(0, num(bill.paidAmount) - num(payment.amount)),
          );
          await tx.scmSupplierBill.update({
            where: { id: bill.id },
            data: {
              paidAmount: paid,
              status: billStatusFor(num(bill.total), paid),
              updatedBy: actorId,
            },
          });
        }
      }
      const after = await tx.scmSupplierPayment.update({
        where: { id },
        data: { status: "VOIDED", voidedAt: new Date(), voidReason: reason },
        include: paymentInclude,
      });
      await this.audit.write(tx, {
        entityType: "scm_supplier_payment",
        entityId: id,
        action: "status_change",
        before: { status: "POSTED" },
        after: { status: "VOIDED" },
        reason,
      });
      return after;
    };
    return externalTx ? run(externalTx) : this.prisma.$transaction(run);
  }

  // ---- documents ---------------------------------------------------------------

  @OrgScoped()
  listDocuments(scope: OrgScope, supplierId: number) {
    return this.prisma.scmSupplierDocument.findMany({
      where: tenantWhere(scope, { supplierId, deletedAt: null }),
      orderBy: { id: "desc" },
    });
  }

  @OrgScoped()
  findDocument(scope: OrgScope, supplierId: number, id: number) {
    return this.prisma.scmSupplierDocument.findFirst({
      where: tenantWhere(scope, { id, supplierId, deletedAt: null }),
    });
  }

  @OrgScoped()
  async createDocument(
    scope: OrgScope,
    data: {
      supplierId: number;
      name: string;
      documentType: string | null;
      fileName: string;
      storageKey: string;
      mimeType: string;
      sizeBytes: number;
    },
    actorId: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const created = await tx.scmSupplierDocument.create({
        data: {
          ...data,
          organizationId: scope.organizationId,
          uploadedBy: actorId,
        },
      });
      await this.audit.write(tx, {
        entityType: SUPPLIER_ENTITY_TYPE,
        entityId: data.supplierId,
        action: "document_upload",
        after: { name: data.name, documentType: data.documentType },
      });
      return created;
    });
  }

  @OrgScoped()
  async softDeleteDocument(scope: OrgScope, supplierId: number, id: number) {
    return this.prisma.$transaction(async (tx) => {
      const doc = await tx.scmSupplierDocument.findFirst({
        where: tenantWhere(scope, { id, supplierId, deletedAt: null }),
      });
      if (!doc) return null;
      await tx.scmSupplierDocument.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
      await this.audit.write(tx, {
        entityType: SUPPLIER_ENTITY_TYPE,
        entityId: supplierId,
        action: "document_remove",
        after: { name: doc.name },
      });
      return doc;
    });
  }

  // ---- internals ---------------------------------------------------------------

  private async lockBill(
    tx: Prisma.TransactionClient,
    scope: OrgScope,
    id: number,
  ) {
    await tx.$queryRaw`SELECT id FROM scm.supplier_bills WHERE id = ${id} AND organization_id = ${scope.organizationId} FOR UPDATE`;
    return tx.scmSupplierBill.findFirst({
      where: { id, organizationId: scope.organizationId },
    });
  }

  /** The same supplier invoice must not be booked twice (cancelled bills excepted). */
  private async assertInvoiceNumberFree(
    tx: Prisma.TransactionClient,
    organizationId: number,
    supplierId: number,
    supplierBillNumber: string,
    exceptId?: number,
  ) {
    const clash = await tx.scmSupplierBill.findFirst({
      where: {
        organizationId,
        supplierId,
        status: { not: "CANCELLED" },
        supplierBillNumber: { equals: supplierBillNumber, mode: "insensitive" },
        ...(exceptId ? { id: { not: exceptId } } : {}),
      },
    });
    if (clash) {
      throw new ResourceConflictException(
        `Invoice "${supplierBillNumber}" is already recorded as ${clash.billNumber}.`,
      );
    }
  }
}
