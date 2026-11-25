import { Injectable } from "@nestjs/common";
import { OrgScoped } from "../../../common/decorators/org-scoped.decorator.js";
import type { OrgScope } from "../../../common/tenancy/org-scope.js";
import { tenantWhere } from "../../../common/tenancy/tenant-where.js";
import { businessToday } from "../../../common/dates/business-date.js";
import { PrismaService } from "../../../shared/prisma/prisma.service.js";
import {
  COMMITTED_PO_STATUSES,
  bucketMonthlySpend,
  mergeApprovalQueue,
  trendMonths,
} from "./procurement-dashboard.trend.js";

/** Months of committed PO spend returned for the trend chart. */
const SPEND_MONTHS = 7;
/** Documents listed in the approval queue. */
const APPROVAL_LIMIT = 5;

/** Committed purchase orders whose goods have not fully arrived. */
const OPEN_PO_STATUSES = ["APPROVED", "SENT", "PARTIALLY_RECEIVED"] as const;

const group = (rows: { status: string; _count: { _all: number } }[]) =>
  Object.fromEntries(rows.map((r) => [r.status, r._count._all]));

@Injectable()
export class ProcurementDashboardRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Counts per status for each document type in the pipeline, plus the
   * value of open (committed, not yet received) purchase orders and the
   * soonest/overdue deliveries against them (IST business date), committed
   * spend per month and the documents waiting longest for approval. */
  @OrgScoped()
  async summary(scope: OrgScope) {
    const where = tenantWhere(scope, {});
    const todayIso = businessToday();
    const today = new Date(`${todayIso}T00:00:00.000Z`);
    const months = trendMonths(todayIso, SPEND_MONTHS);
    const spendFrom = new Date(`${months[0] as string}-01T00:00:00.000Z`);
    const openPo = { status: { in: [...OPEN_PO_STATUSES] } };
    const [
      req,
      rfq,
      quo,
      po,
      grnCount,
      openValue,
      upcoming,
      overdueDeliveries,
      committed,
      pendingRequisitions,
      pendingOrders,
    ] = await Promise.all([
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
        where: tenantWhere(scope, openPo),
        _sum: { total: true },
      }),
      this.prisma.scmPurchaseOrder.findMany({
        where: tenantWhere(scope, {
          ...openPo,
          expectedDeliveryDate: { not: null },
        }),
        orderBy: [{ expectedDeliveryDate: "asc" }, { id: "asc" }],
        take: 5,
        select: {
          id: true,
          poNumber: true,
          vendorNameSnapshot: true,
          expectedDeliveryDate: true,
          total: true,
          status: true,
        },
      }),
      this.prisma.scmPurchaseOrder.count({
        where: tenantWhere(scope, {
          ...openPo,
          expectedDeliveryDate: { lt: today },
        }),
      }),
      this.prisma.scmPurchaseOrder.findMany({
        where: tenantWhere(scope, {
          status: { in: [...COMMITTED_PO_STATUSES] },
          poDate: { gte: spendFrom },
        }),
        select: { poDate: true, total: true },
      }),
      this.prisma.scmPurchaseRequisition.findMany({
        where: tenantWhere(scope, { status: "SUBMITTED" }),
        orderBy: [{ requestDate: "asc" }, { id: "asc" }],
        take: APPROVAL_LIMIT,
        select: {
          id: true,
          requisitionNumber: true,
          requestedByName: true,
          requestDate: true,
          total: true,
        },
      }),
      this.prisma.scmPurchaseOrder.findMany({
        where: tenantWhere(scope, { status: "PENDING_APPROVAL" }),
        orderBy: [{ poDate: "asc" }, { id: "asc" }],
        take: APPROVAL_LIMIT,
        select: {
          id: true,
          poNumber: true,
          vendorNameSnapshot: true,
          poDate: true,
          total: true,
        },
      }),
    ]);
    return {
      requisitions: group(req),
      rfqs: group(rfq),
      quotations: group(quo),
      purchaseOrders: group(po),
      goodsReceipts: grnCount,
      openPurchaseOrderValue: Number(openValue._sum.total ?? 0),
      /** Open POs with a delivery date, soonest (including overdue) first, max 5. */
      upcomingDeliveries: upcoming.map((p) => ({
        id: p.id,
        poNumber: p.poNumber,
        vendorName: p.vendorNameSnapshot,
        expectedDeliveryDate:
          p.expectedDeliveryDate?.toISOString().slice(0, 10) ?? null,
        total: Number(p.total),
        status: p.status,
      })),
      overdueDeliveries,
      /** Committed (approved onwards) PO value per month of PO date, oldest first. */
      monthlySpend: bucketMonthlySpend(committed, months),
      /** Submitted requisitions and POs pending approval, oldest first, max 5. */
      awaitingApproval: mergeApprovalQueue(
        [
          ...pendingRequisitions.map((r) => ({
            type: "REQUISITION" as const,
            id: r.id,
            number: r.requisitionNumber,
            party: r.requestedByName,
            date: r.requestDate.toISOString().slice(0, 10),
            total: Number(r.total),
          })),
          ...pendingOrders.map((p) => ({
            type: "PURCHASE_ORDER" as const,
            id: p.id,
            number: p.poNumber,
            party: p.vendorNameSnapshot,
            date: p.poDate.toISOString().slice(0, 10),
            total: Number(p.total),
          })),
        ],
        APPROVAL_LIMIT,
      ),
    };
  }
}
