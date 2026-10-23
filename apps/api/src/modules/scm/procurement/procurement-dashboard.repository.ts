import { Injectable } from "@nestjs/common";
import { OrgScoped } from "../../../common/decorators/org-scoped.decorator.js";
import type { OrgScope } from "../../../common/tenancy/org-scope.js";
import { tenantWhere } from "../../../common/tenancy/tenant-where.js";
import { PrismaService } from "../../../shared/prisma/prisma.service.js";

const group = (rows: { status: string; _count: { _all: number } }[]) =>
  Object.fromEntries(rows.map((r) => [r.status, r._count._all]));

@Injectable()
export class ProcurementDashboardRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Counts per status for each document type in the pipeline, plus the
   * value of open (committed, not yet received) purchase orders. */
  @OrgScoped()
  async summary(scope: OrgScope) {
    const where = tenantWhere(scope, {});
    const [req, rfq, quo, po, grnCount, openValue] = await Promise.all([
      this.prisma.scmPurchaseRequisition.groupBy({
        by: ["status"],
        where,
        _count: { _all: true },
      }),
      this.prisma.scmRfq.groupBy({
        by: ["status"],
        where,
        _count: { _all: true },
      }),
      this.prisma.scmSupplierQuotation.groupBy({
        by: ["status"],
        where,
        _count: { _all: true },
      }),
      this.prisma.scmPurchaseOrder.groupBy({
        by: ["status"],
        where,
        _count: { _all: true },
      }),
      this.prisma.scmGoodsReceipt.count({
        where: tenantWhere(scope, { status: "COMPLETED" }),
      }),
      this.prisma.scmPurchaseOrder.aggregate({
        where: tenantWhere(scope, {
          status: { in: ["APPROVED", "SENT", "PARTIALLY_RECEIVED"] },
        }),
        _sum: { total: true },
      }),
    ]);
    return {
      requisitions: group(req),
      rfqs: group(rfq),
      quotations: group(quo),
      purchaseOrders: group(po),
      goodsReceipts: grnCount,
      openPurchaseOrderValue: Number(openValue._sum.total ?? 0),
    };
  }
}
