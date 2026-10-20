import { Injectable } from "@nestjs/common";
import { Prisma } from "@texawave-erp/database";
import { OrgScoped } from "../../../common/decorators/org-scoped.decorator.js";
import type { PaginationDto } from "../../../common/dto/pagination.dto.js";
import {
  BusinessRuleViolationException,
  InvalidStateTransitionException,
} from "../../../common/exceptions/business.exception.js";
import type { OrgScope } from "../../../common/tenancy/org-scope.js";
import { tenantWhere } from "../../../common/tenancy/tenant-where.js";
import { AuditWriter } from "../../../platform/audit/audit-writer.js";
import { PrismaService } from "../../../shared/prisma/prisma.service.js";
import { toDate } from "../common/scm-actor.helpers.js";
import { ScmNumberingService } from "../common/scm-numbering.service.js";
import { computeRemainingByLine } from "./sales.helpers.js";

export interface SalesOrderData {
  customerId: number;
  orderDate: string;
  expectedDate?: string | undefined;
  shipToAddress?: string | undefined;
  billToAddress?: string | undefined;
  currency: string;
  notes?: string | undefined;
  lines: {
    productId: number;
    itemCode: string;
    itemDescription: string;
    uom: string;
    salesQty: number;
    unitPrice: number;
    taxRate: number;
    total: number;
  }[];
  subtotal: number;
  taxAmount: number;
  total: number;
}

const include = {
  items: { orderBy: { lineNo: "asc" } },
  customer: { select: { id: true, customerCode: true, name: true } },
  _count: { select: { fulfillments: true } },
} satisfies Prisma.ScmSalesOrderInclude;

@Injectable()
export class SalesOrdersRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditWriter,
    private readonly numbering: ScmNumberingService,
  ) {}

  @OrgScoped()
  async findMany(
    scope: OrgScope,
    f: {
      q?: string | undefined;
      status?: string | undefined;
      customerId?: number | undefined;
    },
    page: PaginationDto,
  ) {
    const where = tenantWhere<Prisma.ScmSalesOrderWhereInput>(scope, {
      ...(f.status ? { status: f.status } : {}),
      ...(f.customerId ? { customerId: f.customerId } : {}),
      ...(f.q
        ? {
            OR: [
              { soNumber: { contains: f.q, mode: "insensitive" } },
              { customerName: { contains: f.q, mode: "insensitive" } },
            ],
          }
        : {}),
    });
    const [items, total] = await Promise.all([
      this.prisma.scmSalesOrder.findMany({
        where,
        skip: page.skip,
        take: page.limit,
        orderBy: { id: "desc" },
        include,
      }),
      this.prisma.scmSalesOrder.count({ where }),
    ]);
    return { items, total };
  }

  @OrgScoped()
  async findOne(scope: OrgScope, id: number) {
    const so = await this.prisma.scmSalesOrder.findFirst({
      where: tenantWhere(scope, { id }),
      include: {
        ...include,
        fulfillments: {
          select: {
            id: true,
            fulfillmentNumber: true,
            status: true,
            items: {
              select: {
                salesOrderItemId: true,
                orderedQty: true,
                issuedQty: true,
              },
            },
          },
          orderBy: { id: "desc" },
        },
      },
    });
    if (!so) return null;
    const remaining = computeRemainingByLine(
      so.items.map((i) => ({ id: i.id, salesQty: Number(i.salesQty) })),
      so.fulfillments.map((f) => ({
        status: f.status,
        items: f.items.map((i) => ({
          salesOrderItemId: i.salesOrderItemId,
          orderedQty: Number(i.orderedQty),
          issuedQty: Number(i.issuedQty),
        })),
      })),
    );
    return {
      ...so,
      fulfillments: so.fulfillments.map((f) => ({
        id: f.id,
        fulfillmentNumber: f.fulfillmentNumber,
        status: f.status,
      })),
      items: so.items.map((i) => ({
        ...i,
        remainingQty: remaining.get(i.id) ?? 0,
      })),
    };
  }

  @OrgScoped()
  async create(scope: OrgScope, data: SalesOrderData, actorId: number) {
    return this.prisma.$transaction(async (tx) => {
      const customer = await tx.scmCustomer.findFirst({
        where: tenantWhere(scope, { id: data.customerId, deletedAt: null }),
      });
      if (!customer) {
        throw new BusinessRuleViolationException(
          "Customer not found.",
          "CUSTOMER_NOT_FOUND",
        );
      }
      if (customer.status !== "Active") {
        throw new BusinessRuleViolationException(
          "Sales orders can only be raised for active customers.",
          "CUSTOMER_INACTIVE",
        );
      }
      const soNumber = await this.numbering.next(
        tx,
        scope.organizationId,
        "salesOrder",
      );
      const created = await tx.scmSalesOrder.create({
        data: {
          organizationId: scope.organizationId,
          soNumber,
          customerId: customer.id,
          customerName: customer.name,
          orderDate: new Date(data.orderDate),
          expectedDate: toDate(data.expectedDate),
          shipToAddress: data.shipToAddress?.trim() || customer.shippingAddress,
          billToAddress: data.billToAddress?.trim() || customer.billingAddress,
          currency: data.currency,
          subtotal: data.subtotal,
          taxAmount: data.taxAmount,
          total: data.total,
          notes: data.notes?.trim() || null,
          createdBy: actorId,
          updatedBy: actorId,
          items: {
            create: data.lines.map((l, i) => ({
              lineNo: i + 1,
              productId: l.productId,
              itemCode: l.itemCode,
              itemDescription: l.itemDescription,
              uom: l.uom,
              salesQty: l.salesQty,
              unitPrice: l.unitPrice,
              taxRate: l.taxRate,
              total: l.total,
            })),
          },
        },
        include,
      });
      await this.audit.write(tx, {
        entityType: "scm_sales_order",
        entityId: created.id,
        action: "create",
        after: { soNumber, customer: customer.name, total: data.total },
      });
      return created;
    });
  }

  @OrgScoped()
  async transition(
    scope: OrgScope,
    id: number,
    from: readonly string[],
    to: string,
    actorId: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.scmSalesOrder.findFirst({
        where: tenantWhere(scope, { id }),
      });
      if (!current) return null;
      if (!from.includes(current.status)) {
        throw new InvalidStateTransitionException(
          "Sales order",
          current.status,
          to,
        );
      }
      if (to === "CANCELLED") {
        const live = await tx.scmFulfillment.count({
          where: { salesOrderId: id, status: { not: "CANCELLED" } },
        });
        if (live > 0) {
          throw new BusinessRuleViolationException(
            "This sales order has active fulfillments. Cancel them first.",
            "SO_HAS_FULFILLMENTS",
          );
        }
      }
      const claimed = await tx.scmSalesOrder.updateMany({
        where: {
          id,
          organizationId: scope.organizationId,
          status: { in: [...from] },
        },
        data: { status: to, updatedBy: actorId },
      });
      if (claimed.count === 0) {
        throw new InvalidStateTransitionException("Sales order", "changed", to);
      }
      await this.audit.write(tx, {
        entityType: "scm_sales_order",
        entityId: id,
        action: to.toLowerCase(),
        before: { status: current.status },
        after: { status: to },
      });
      return tx.scmSalesOrder.findUniqueOrThrow({ where: { id }, include });
    });
  }
}
