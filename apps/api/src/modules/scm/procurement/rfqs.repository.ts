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
import { RFQ_OPEN_FOR_RESPONSES } from "./procurement.helpers.js";

export interface RfqData {
  requisitionId?: number | undefined;
  issueDate: string;
  responseDueDate?: string | undefined;
  warehouseId: number;
  deliveryLocation?: string | undefined;
  currency: string;
  paymentTerms?: string | undefined;
  deliveryTerms?: string | undefined;
  notes?: string | undefined;
  suppliers: { supplierId: number; name: string }[];
  lines: {
    productId: number;
    productName: string;
    uom: string;
    quantity: number;
    notes?: string | undefined;
  }[];
}

const include = {
  items: { orderBy: { lineNo: "asc" } },
  suppliers: true,
  warehouse: { select: { id: true, name: true, code: true } },
  requisition: { select: { id: true, requisitionNumber: true } },
  _count: { select: { quotations: true } },
} satisfies Prisma.ScmRfqInclude;

const INACTIVE_QUOTATION = ["CANCELLED", "REJECTED"];

@Injectable()
export class RfqsRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditWriter,
    private readonly numbering: ScmNumberingService,
  ) {}

  @OrgScoped()
  async findMany(
    scope: OrgScope,
    f: { q?: string | undefined; status?: string | undefined },
    page: PaginationDto,
  ) {
    const where = tenantWhere<Prisma.ScmRfqWhereInput>(scope, {
      ...(f.status ? { status: f.status } : {}),
      ...(f.q
        ? {
            OR: [
              { rfqNumber: { contains: f.q, mode: "insensitive" } },
              {
                suppliers: {
                  some: {
                    supplierNameSnapshot: {
                      contains: f.q,
                      mode: "insensitive",
                    },
                  },
                },
              },
            ],
          }
        : {}),
    });
    const [items, total] = await Promise.all([
      this.prisma.scmRfq.findMany({
        where,
        skip: page.skip,
        take: page.limit,
        orderBy: { id: "desc" },
        include,
      }),
      this.prisma.scmRfq.count({ where }),
    ]);
    return { items, total };
  }

  @OrgScoped()
  findOne(scope: OrgScope, id: number) {
    return this.prisma.scmRfq.findFirst({
      where: tenantWhere(scope, { id }),
      include,
    });
  }

  /** RFQs that already have at least one quotation (comparison picker). */
  @OrgScoped()
  findWithQuotations(scope: OrgScope) {
    return this.prisma.scmRfq.findMany({
      where: tenantWhere<Prisma.ScmRfqWhereInput>(scope, {
        quotations: { some: {} },
      }),
      orderBy: { id: "desc" },
      select: { id: true, rfqNumber: true, status: true },
    });
  }

  /** Creates the RFQ and, when it converts a requisition, claims that
   * requisition (APPROVED -> CONVERTED) in the same transaction, so a
   * requisition can never be converted twice and a failed create leaves it
   * APPROVED. */
  @OrgScoped()
  async create(scope: OrgScope, data: RfqData, actorId: number) {
    return this.prisma.$transaction(async (tx) => {
      let requisitionNumber: string | undefined;
      if (data.requisitionId) {
        const claimed = await tx.scmPurchaseRequisition.updateMany({
          where: {
            id: data.requisitionId,
            organizationId: scope.organizationId,
            status: "APPROVED",
          },
          data: { status: "CONVERTED", updatedBy: actorId },
        });
        if (claimed.count === 0) {
          throw new BusinessRuleViolationException(
            "Only an approved requisition can be converted to an RFQ.",
            "REQUISITION_NOT_APPROVED",
          );
        }
        const req = await tx.scmPurchaseRequisition.findUniqueOrThrow({
          where: { id: data.requisitionId },
          select: { requisitionNumber: true },
        });
        requisitionNumber = req.requisitionNumber;
      }
      const rfqNumber = await this.numbering.next(
        tx,
        scope.organizationId,
        "rfq",
      );
      const created = await tx.scmRfq.create({
        data: {
          organizationId: scope.organizationId,
          rfqNumber,
          requisitionId: data.requisitionId ?? null,
          issueDate: new Date(data.issueDate),
          responseDueDate: toDate(data.responseDueDate),
          warehouseId: data.warehouseId,
          deliveryLocation: data.deliveryLocation?.trim() || null,
          currency: data.currency,
          paymentTerms: data.paymentTerms?.trim() || null,
          deliveryTerms: data.deliveryTerms?.trim() || null,
          notes: data.notes?.trim() || null,
          createdBy: actorId,
          updatedBy: actorId,
          items: {
            create: data.lines.map((l, i) => ({
              lineNo: i + 1,
              productId: l.productId,
              productNameSnapshot: l.productName,
              uom: l.uom,
              quantity: l.quantity,
              notes: l.notes?.trim() || null,
            })),
          },
          suppliers: {
            create: data.suppliers.map((s) => ({
              supplierId: s.supplierId,
              supplierNameSnapshot: s.name,
            })),
          },
        },
        include,
      });
      await this.audit.write(tx, {
        entityType: "scm_rfq",
        entityId: created.id,
        action: "create",
        after: { rfqNumber, suppliers: data.suppliers.length },
      });
      if (data.requisitionId) {
        await this.audit.write(tx, {
          entityType: "scm_purchase_requisition",
          entityId: data.requisitionId,
          action: "convert",
          after: { rfqNumber, requisitionNumber },
        });
      }
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
      const current = await tx.scmRfq.findFirst({
        where: tenantWhere(scope, { id }),
      });
      if (!current) return null;
      if (!from.includes(current.status)) {
        throw new InvalidStateTransitionException("RFQ", current.status, to);
      }
      const claimed = await tx.scmRfq.updateMany({
        where: {
          id,
          organizationId: scope.organizationId,
          status: { in: [...from] },
        },
        data: { status: to, updatedBy: actorId },
      });
      if (claimed.count === 0) {
        throw new InvalidStateTransitionException("RFQ", "changed", to);
      }
      await this.audit.write(tx, {
        entityType: "scm_rfq",
        entityId: id,
        action: to.toLowerCase(),
        before: { status: current.status },
        after: { status: to },
      });
      return tx.scmRfq.findUniqueOrThrow({ where: { id }, include });
    });
  }

  /** Recomputes an open RFQ's response status from fresh quotation data: a
   * supplier counts as having responded only if it was invited and has a live
   * (not cancelled/rejected) quotation. Runs inside the caller's transaction. */
  async refreshResponseStatus(tx: Prisma.TransactionClient, rfqId: number) {
    const rfq = await tx.scmRfq.findUniqueOrThrow({
      where: { id: rfqId },
      include: { suppliers: true },
    });
    if (!(RFQ_OPEN_FOR_RESPONSES as readonly string[]).includes(rfq.status)) {
      return rfq.status;
    }
    const invited = new Set(rfq.suppliers.map((s) => s.supplierId));
    const live = await tx.scmSupplierQuotation.findMany({
      where: { rfqId, status: { notIn: INACTIVE_QUOTATION } },
      select: { supplierId: true },
    });
    const responded = new Set(
      live.map((q) => q.supplierId).filter((id) => invited.has(id)),
    );
    const next =
      responded.size === 0
        ? "RESPONSES_PENDING"
        : responded.size >= invited.size
          ? "RESPONDED"
          : "PARTIALLY_RESPONDED";
    if (next !== rfq.status) {
      await tx.scmRfq.update({ where: { id: rfqId }, data: { status: next } });
    }
    return next;
  }
}
