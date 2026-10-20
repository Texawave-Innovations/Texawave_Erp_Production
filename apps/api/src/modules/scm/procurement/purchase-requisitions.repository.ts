import { Injectable } from "@nestjs/common";
import { Prisma } from "@texawave-erp/database";
import { OrgScoped } from "../../../common/decorators/org-scoped.decorator.js";
import type { PaginationDto } from "../../../common/dto/pagination.dto.js";
import { InvalidStateTransitionException } from "../../../common/exceptions/business.exception.js";
import type { OrgScope } from "../../../common/tenancy/org-scope.js";
import { tenantWhere } from "../../../common/tenancy/tenant-where.js";
import { AuditWriter } from "../../../platform/audit/audit-writer.js";
import { PrismaService } from "../../../shared/prisma/prisma.service.js";
import { actorName, toDate } from "../common/scm-actor.helpers.js";
import { ScmNumberingService } from "../common/scm-numbering.service.js";

export interface RequisitionLineData {
  productId: number;
  productName: string;
  uom: string;
  quantity: number;
  estimatedUnitCost: number;
  estimatedTotal: number;
  requiredDate?: string | undefined;
  notes?: string | undefined;
}

export interface RequisitionData {
  department?: string | undefined;
  requestDate: string;
  requiredDate?: string | undefined;
  priority: string;
  warehouseId: number;
  purpose?: string | undefined;
  notes?: string | undefined;
  subtotal: number;
  tax: number;
  total: number;
  sourceSalesOrderId?: number | undefined;
  sourceSalesOrderNumber?: string | undefined;
  lines: RequisitionLineData[];
}

export interface RequisitionFilter {
  q?: string | undefined;
  status?: string | undefined;
  from?: string | undefined;
  to?: string | undefined;
}

const include = {
  items: { orderBy: { lineNo: "asc" } },
  warehouse: { select: { id: true, name: true, code: true } },
} satisfies Prisma.ScmPurchaseRequisitionInclude;

const lineCreate = (l: RequisitionLineData, i: number) => ({
  lineNo: i + 1,
  productId: l.productId,
  productNameSnapshot: l.productName,
  uom: l.uom,
  quantity: l.quantity,
  estimatedUnitCost: l.estimatedUnitCost,
  estimatedTotal: l.estimatedTotal,
  requiredDate: toDate(l.requiredDate),
  notes: l.notes?.trim() || null,
});

@Injectable()
export class PurchaseRequisitionsRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditWriter,
    private readonly numbering: ScmNumberingService,
  ) {}

  @OrgScoped()
  async findMany(scope: OrgScope, f: RequisitionFilter, page: PaginationDto) {
    const where = tenantWhere<Prisma.ScmPurchaseRequisitionWhereInput>(scope, {
      ...(f.status ? { status: f.status } : {}),
      ...(f.from || f.to
        ? {
            requestDate: {
              ...(f.from ? { gte: new Date(f.from) } : {}),
              ...(f.to ? { lte: new Date(f.to) } : {}),
            },
          }
        : {}),
      ...(f.q
        ? {
            OR: [
              { requisitionNumber: { contains: f.q, mode: "insensitive" } },
              { requestedByName: { contains: f.q, mode: "insensitive" } },
              { purpose: { contains: f.q, mode: "insensitive" } },
              { department: { contains: f.q, mode: "insensitive" } },
            ],
          }
        : {}),
    });
    const [items, total] = await Promise.all([
      this.prisma.scmPurchaseRequisition.findMany({
        where,
        skip: page.skip,
        take: page.limit,
        orderBy: { id: "desc" },
        include,
      }),
      this.prisma.scmPurchaseRequisition.count({ where }),
    ]);
    return { items, total };
  }

  @OrgScoped()
  findOne(scope: OrgScope, id: number) {
    return this.prisma.scmPurchaseRequisition.findFirst({
      where: tenantWhere(scope, { id }),
      include,
    });
  }

  @OrgScoped()
  async create(scope: OrgScope, data: RequisitionData, actorId: number) {
    return this.prisma.$transaction(async (tx) => {
      const requisitionNumber = await this.numbering.next(
        tx,
        scope.organizationId,
        "purchaseRequisition",
      );
      const created = await tx.scmPurchaseRequisition.create({
        data: {
          organizationId: scope.organizationId,
          requisitionNumber,
          requestedBy: actorId,
          requestedByName: await actorName(tx, scope.organizationId, actorId),
          department: data.department?.trim() || null,
          requestDate: new Date(data.requestDate),
          requiredDate: toDate(data.requiredDate),
          priority: data.priority,
          warehouseId: data.warehouseId,
          purpose: data.purpose?.trim() || null,
          notes: data.notes?.trim() || null,
          subtotal: data.subtotal,
          tax: data.tax,
          total: data.total,
          sourceSalesOrderId: data.sourceSalesOrderId ?? null,
          sourceSalesOrderNumber: data.sourceSalesOrderNumber ?? null,
          createdBy: actorId,
          updatedBy: actorId,
          items: { create: data.lines.map(lineCreate) },
        },
        include,
      });
      await this.audit.write(tx, {
        entityType: "scm_purchase_requisition",
        entityId: created.id,
        action: "create",
        after: { requisitionNumber, total: data.total },
      });
      return created;
    });
  }

  /** Only a DRAFT may be edited; lines are replaced wholesale. */
  @OrgScoped()
  async update(
    scope: OrgScope,
    id: number,
    data: RequisitionData,
    actorId: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.scmPurchaseRequisition.findFirst({
        where: tenantWhere(scope, { id }),
      });
      if (!current) return null;
      if (current.status !== "DRAFT") {
        throw new InvalidStateTransitionException(
          "Requisition",
          current.status,
          "DRAFT",
          "only draft requisitions can be edited",
        );
      }
      await tx.scmPurchaseRequisitionItem.deleteMany({
        where: { requisitionId: id },
      });
      const updated = await tx.scmPurchaseRequisition.update({
        where: { id },
        data: {
          department: data.department?.trim() || null,
          requestDate: new Date(data.requestDate),
          requiredDate: toDate(data.requiredDate),
          priority: data.priority,
          warehouseId: data.warehouseId,
          purpose: data.purpose?.trim() || null,
          notes: data.notes?.trim() || null,
          subtotal: data.subtotal,
          tax: data.tax,
          total: data.total,
          updatedBy: actorId,
          items: { create: data.lines.map(lineCreate) },
        },
        include,
      });
      await this.audit.write(tx, {
        entityType: "scm_purchase_requisition",
        entityId: id,
        action: "update",
        after: { total: data.total },
      });
      return updated;
    });
  }

  /** Moves the requisition between statuses atomically. The status is claimed
   * with a conditional update so two simultaneous approvals cannot both win. */
  @OrgScoped()
  async transition(
    scope: OrgScope,
    id: number,
    from: readonly string[],
    to: string,
    actorId: number,
    extra: { rejectionReason?: string } = {},
  ) {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.scmPurchaseRequisition.findFirst({
        where: tenantWhere(scope, { id }),
      });
      if (!current) return null;
      if (!from.includes(current.status)) {
        throw new InvalidStateTransitionException(
          "Requisition",
          current.status,
          to,
        );
      }
      const approving = to === "APPROVED";
      const claimed = await tx.scmPurchaseRequisition.updateMany({
        where: {
          id,
          organizationId: scope.organizationId,
          status: { in: [...from] },
        },
        data: {
          status: to,
          updatedBy: actorId,
          ...(approving
            ? {
                approvedBy: actorId,
                approvedByName: await actorName(
                  tx,
                  scope.organizationId,
                  actorId,
                ),
                approvedAt: new Date(),
              }
            : {}),
          ...(extra.rejectionReason
            ? { rejectionReason: extra.rejectionReason }
            : {}),
        },
      });
      if (claimed.count === 0) {
        throw new InvalidStateTransitionException("Requisition", "changed", to);
      }
      await this.audit.write(tx, {
        entityType: "scm_purchase_requisition",
        entityId: id,
        action: to.toLowerCase(),
        before: { status: current.status },
        after: { status: to, ...extra },
      });
      return tx.scmPurchaseRequisition.findUniqueOrThrow({
        where: { id },
        include,
      });
    });
  }
}
