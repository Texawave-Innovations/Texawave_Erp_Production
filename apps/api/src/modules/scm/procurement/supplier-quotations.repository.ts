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
import {
  RFQ_OPEN_FOR_RESPONSES,
  SELECTABLE_QUOTATION_STATUSES,
} from "./procurement.helpers.js";
import { RfqsRepository } from "./rfqs.repository.js";

export interface QuotationLineData {
  productId: number;
  productName: string;
  uom: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  promisedDeliveryDate?: string | undefined;
  notes?: string | undefined;
}

export interface QuotationData {
  supplierQuotationNumber?: string | undefined;
  rfqId: number;
  supplierId: number;
  vendorName: string;
  vendorGstin: string | null;
  quotationDate: string;
  validUntil?: string | undefined;
  currency: string;
  paymentTerms?: string | undefined;
  deliveryTerms?: string | undefined;
  freight: number;
  discount: number;
  tax: number;
  subtotal: number;
  total: number;
  notes?: string | undefined;
  lines: QuotationLineData[];
}

const include = {
  items: { orderBy: { lineNo: "asc" } },
  rfq: { select: { id: true, rfqNumber: true, status: true } },
  supplier: { select: { id: true, supplierCode: true, companyName: true } },
} satisfies Prisma.ScmSupplierQuotationInclude;

@Injectable()
export class SupplierQuotationsRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditWriter,
    private readonly numbering: ScmNumberingService,
    private readonly rfqs: RfqsRepository,
  ) {}

  @OrgScoped()
  async findMany(
    scope: OrgScope,
    f: {
      q?: string | undefined;
      status?: string | undefined;
      rfqId?: number | undefined;
      supplierId?: number | undefined;
    },
    page: PaginationDto,
  ) {
    const where = tenantWhere<Prisma.ScmSupplierQuotationWhereInput>(scope, {
      ...(f.status ? { status: f.status } : {}),
      ...(f.rfqId ? { rfqId: f.rfqId } : {}),
      ...(f.supplierId ? { supplierId: f.supplierId } : {}),
      ...(f.q
        ? {
            OR: [
              { quotationNumber: { contains: f.q, mode: "insensitive" } },
              {
                supplierQuotationNumber: { contains: f.q, mode: "insensitive" },
              },
              { vendorNameSnapshot: { contains: f.q, mode: "insensitive" } },
              { rfq: { rfqNumber: { contains: f.q, mode: "insensitive" } } },
            ],
          }
        : {}),
    });
    const [items, total] = await Promise.all([
      this.prisma.scmSupplierQuotation.findMany({
        where,
        skip: page.skip,
        take: page.limit,
        orderBy: { id: "desc" },
        include,
      }),
      this.prisma.scmSupplierQuotation.count({ where }),
    ]);
    return { items, total };
  }

  @OrgScoped()
  findOne(scope: OrgScope, id: number) {
    return this.prisma.scmSupplierQuotation.findFirst({
      where: tenantWhere(scope, { id }),
      include,
    });
  }

  /** All non-cancelled quotations of an RFQ, cheapest first (comparison). */
  @OrgScoped()
  findForComparison(scope: OrgScope, rfqId: number) {
    return this.prisma.scmSupplierQuotation.findMany({
      where: tenantWhere<Prisma.ScmSupplierQuotationWhereInput>(scope, {
        rfqId,
        status: { not: "CANCELLED" },
      }),
      orderBy: [{ total: "asc" }, { id: "asc" }],
      include,
    });
  }

  @OrgScoped()
  async create(scope: OrgScope, data: QuotationData, actorId: number) {
    return this.prisma.$transaction(async (tx) => {
      // Fresh read: the RFQ may have been closed or cancelled since the form
      // was opened, and the supplier must actually have been invited.
      const rfq = await tx.scmRfq.findFirst({
        where: tenantWhere(scope, { id: data.rfqId }),
        include: { suppliers: true },
      });
      if (!rfq) {
        throw new BusinessRuleViolationException(
          "RFQ not found.",
          "RFQ_NOT_FOUND",
        );
      }
      if (!(RFQ_OPEN_FOR_RESPONSES as readonly string[]).includes(rfq.status)) {
        throw new BusinessRuleViolationException(
          `RFQ ${rfq.rfqNumber} is not accepting quotations.`,
          "RFQ_NOT_OPEN",
        );
      }
      if (!rfq.suppliers.some((s) => s.supplierId === data.supplierId)) {
        throw new BusinessRuleViolationException(
          "This supplier was not invited on the selected RFQ",
          "SUPPLIER_NOT_INVITED",
        );
      }
      const quotationNumber = await this.numbering.next(
        tx,
        scope.organizationId,
        "supplierQuotation",
      );
      const created = await tx.scmSupplierQuotation.create({
        data: {
          organizationId: scope.organizationId,
          quotationNumber,
          supplierQuotationNumber: data.supplierQuotationNumber?.trim() || null,
          rfqId: data.rfqId,
          supplierId: data.supplierId,
          vendorNameSnapshot: data.vendorName,
          vendorGstinSnapshot: data.vendorGstin,
          quotationDate: new Date(data.quotationDate),
          validUntil: toDate(data.validUntil),
          currency: data.currency,
          paymentTerms: data.paymentTerms?.trim() || null,
          deliveryTerms: data.deliveryTerms?.trim() || null,
          freight: data.freight,
          discount: data.discount,
          tax: data.tax,
          subtotal: data.subtotal,
          total: data.total,
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
              unitPrice: l.unitPrice,
              discount: l.discount,
              taxRate: l.taxRate,
              taxAmount: l.taxAmount,
              total: l.total,
              promisedDeliveryDate: toDate(l.promisedDeliveryDate),
              notes: l.notes?.trim() || null,
            })),
          },
        },
        include,
      });
      await this.rfqs.refreshResponseStatus(tx, data.rfqId);
      await this.audit.write(tx, {
        entityType: "scm_supplier_quotation",
        entityId: created.id,
        action: "create",
        after: {
          quotationNumber,
          supplier: data.vendorName,
          total: data.total,
        },
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
      const current = await tx.scmSupplierQuotation.findFirst({
        where: tenantWhere(scope, { id }),
      });
      if (!current) return null;
      if (!from.includes(current.status)) {
        throw new InvalidStateTransitionException(
          "Quotation",
          current.status,
          to,
        );
      }
      const claimed = await tx.scmSupplierQuotation.updateMany({
        where: {
          id,
          organizationId: scope.organizationId,
          status: { in: [...from] },
        },
        data: { status: to, updatedBy: actorId },
      });
      if (claimed.count === 0) {
        throw new InvalidStateTransitionException("Quotation", "changed", to);
      }
      await this.rfqs.refreshResponseStatus(tx, current.rfqId);
      await this.audit.write(tx, {
        entityType: "scm_supplier_quotation",
        entityId: id,
        action: to.toLowerCase(),
        before: { status: current.status },
        after: { status: to },
      });
      return tx.scmSupplierQuotation.findUniqueOrThrow({
        where: { id },
        include,
      });
    });
  }

  // ---- comparison ---------------------------------------------------------

  @OrgScoped()
  findComparisons(scope: OrgScope, rfqId: number) {
    return this.prisma.scmQuotationComparison.findMany({
      where: tenantWhere(scope, { rfqId }),
      orderBy: { id: "desc" },
    });
  }

  /** Records a comparison. Selecting a quotation moves it to SELECTED and every
   * other still-selectable quotation on the RFQ to REJECTED — all in one
   * transaction (legacy did this best-effort and non-atomically). */
  @OrgScoped()
  async saveComparison(
    scope: OrgScope,
    input: {
      rfqId: number;
      selectedQuotationId?: number | undefined;
      remarks?: string | undefined;
    },
    actorId: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const quotations = await tx.scmSupplierQuotation.findMany({
        where: tenantWhere<Prisma.ScmSupplierQuotationWhereInput>(scope, {
          rfqId: input.rfqId,
          status: { not: "CANCELLED" },
        }),
      });
      if (quotations.length === 0) {
        throw new BusinessRuleViolationException(
          "No quotations to compare for this RFQ",
          "NO_QUOTATIONS",
        );
      }
      const decided = quotations.find((q) => q.status === "SELECTED");
      if (input.selectedQuotationId) {
        if (decided) {
          throw new BusinessRuleViolationException(
            `${decided.quotationNumber} is already selected for this RFQ`,
            "ALREADY_DECIDED",
          );
        }
        const claimed = await tx.scmSupplierQuotation.updateMany({
          where: {
            id: input.selectedQuotationId,
            organizationId: scope.organizationId,
            rfqId: input.rfqId,
            status: { in: [...SELECTABLE_QUOTATION_STATUSES] },
          },
          data: { status: "SELECTED", updatedBy: actorId },
        });
        if (claimed.count === 0) {
          throw new BusinessRuleViolationException(
            "That quotation can no longer be selected.",
            "QUOTATION_NOT_SELECTABLE",
          );
        }
        await tx.scmSupplierQuotation.updateMany({
          where: {
            organizationId: scope.organizationId,
            rfqId: input.rfqId,
            id: { not: input.selectedQuotationId },
            status: { in: [...SELECTABLE_QUOTATION_STATUSES] },
          },
          data: { status: "REJECTED", updatedBy: actorId },
        });
      }
      const created = await tx.scmQuotationComparison.create({
        data: {
          organizationId: scope.organizationId,
          rfqId: input.rfqId,
          quotationIds: quotations.map((q) => q.id),
          selectedQuotationIds: input.selectedQuotationId
            ? [input.selectedQuotationId]
            : [],
          selectedBy: input.selectedQuotationId ? actorId : null,
          selectedAt: input.selectedQuotationId ? new Date() : null,
          remarks: input.remarks?.trim() || null,
          status: input.selectedQuotationId ? "DECIDED" : "OPEN",
          createdBy: actorId,
        },
      });
      await this.audit.write(tx, {
        entityType: "scm_quotation_comparison",
        entityId: created.id,
        action: input.selectedQuotationId ? "decide" : "create",
        after: {
          rfqId: input.rfqId,
          compared: quotations.length,
          selected: input.selectedQuotationId ?? null,
        },
      });
      return created;
    });
  }
}
