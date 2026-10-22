import { Injectable } from "@nestjs/common";
import { Prisma } from "@texawave-erp/database";
import { OrgScoped } from "../../../common/decorators/org-scoped.decorator.js";
import type { OrgScope } from "../../../common/tenancy/org-scope.js";
import { PrismaService } from "../../../shared/prisma/prisma.service.js";
import { isOverdue, outstanding } from "../finance/finance.helpers.js";
import type { AssistantFacts, AssistantIntent } from "./assistant.intents.js";
import { OverviewRepository } from "./overview.repository.js";

const num = (d: Prisma.Decimal | number | bigint | null | undefined) =>
  d === null || d === undefined ? 0 : Number(d);

const OPEN_PO = [
  "DRAFT",
  "PENDING_APPROVAL",
  "APPROVED",
  "SENT",
  "PARTIALLY_RECEIVED",
];
const AWAITING_DELIVERY_PO = ["APPROVED", "SENT", "PARTIALLY_RECEIVED"];
const OPEN_REQUISITION = ["DRAFT", "SUBMITTED", "APPROVED"];
const CLOSED_RETURN = ["COMPLETED", "CANCELLED", "REJECTED"];

/** Reads the live figures the Copilot answers from — one `gather` per intent,
 * so a question only pays for the numbers it needs. Read-only projections of
 * other domains' tables (same rule as Reports / Overview). */
@Injectable()
export class AssistantRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly overview: OverviewRepository,
  ) {}

  @OrgScoped()
  async gather(
    scope: OrgScope,
    intent: AssistantIntent,
  ): Promise<AssistantFacts> {
    switch (intent) {
      case "suppliers":
        return { suppliers: await this.suppliers(scope) };
      case "supplier_performance":
        return { supplierPerformance: await this.supplierPerformance(scope) };
      case "pending_purchase_orders":
        return { purchaseOrders: await this.purchaseOrders(scope) };
      case "purchase_requisitions":
        return { requisitions: await this.requisitions(scope) };
      case "rfqs_quotations":
        return { rfqs: await this.rfqs(scope) };
      case "low_stock_inventory":
        return { lowStock: await this.lowStock(scope) };
      case "inventory_status":
        return { inventory: await this.inventory(scope) };
      case "warehouse_status":
        return { warehouse: await this.warehouse(scope) };
      case "fulfillment_status":
        return { fulfillment: await this.fulfillment(scope) };
      case "logistics_shipments":
        return { logistics: await this.logistics(scope) };
      case "returns_status":
        return { returns: await this.returns(scope) };
      case "quality_status":
        return { quality: await this.quality(scope) };
      case "supplier_bills":
        return { bills: await this.bills(scope) };
      case "advanced_scm":
        return { controlTower: await this.controlTower(scope) };
      case "scm_summary": {
        const [
          suppliers,
          purchaseOrders,
          inventory,
          logistics,
          returns,
          quality,
          bills,
        ] = await Promise.all([
          this.suppliers(scope),
          this.purchaseOrders(scope),
          this.inventory(scope),
          this.logistics(scope),
          this.returns(scope),
          this.quality(scope),
          this.bills(scope),
        ]);
        return {
          suppliers,
          purchaseOrders,
          inventory,
          logistics,
          returns,
          quality,
          bills,
        };
      }
      default:
        return {};
    }
  }

  private async suppliers(scope: OrgScope) {
    const groups = await this.prisma.supplier.groupBy({
      by: ["status"],
      where: { organizationId: scope.organizationId, deletedAt: null },
      _count: true,
    });
    const byStatus = Object.fromEntries(
      groups.map((g) => [g.status, g._count]),
    );
    return { total: groups.reduce((s, g) => s + g._count, 0), byStatus };
  }

  private async supplierPerformance(scope: OrgScope) {
    const org = scope.organizationId;
    const [orders, returns, inspections] = await Promise.all([
      this.prisma.scmPurchaseOrder.groupBy({
        by: ["supplierId"],
        where: { organizationId: org, status: { not: "CANCELLED" } },
        _count: true,
        _sum: { total: true },
      }),
      this.prisma.scmReturn.groupBy({
        by: ["supplierId"],
        where: {
          organizationId: org,
          returnType: "VENDOR_RETURN",
          supplierId: { not: null },
        },
        _count: true,
      }),
      this.prisma.scmQualityInspection.groupBy({
        by: ["supplierId"],
        where: {
          organizationId: org,
          supplierId: { not: null },
          result: { in: ["FAILED", "PARTIALLY_PASSED", "ON_HOLD"] },
        },
        _count: true,
      }),
    ]);
    if (orders.length === 0) return [];
    const suppliers = await this.prisma.supplier.findMany({
      where: {
        organizationId: org,
        id: { in: orders.map((o) => o.supplierId) },
      },
      select: { id: true, companyName: true },
    });
    const names = new Map(suppliers.map((s) => [s.id, s.companyName]));
    const returnsBy = new Map(returns.map((r) => [r.supplierId, r._count]));
    const failuresBy = new Map(
      inspections.map((i) => [i.supplierId, i._count]),
    );
    return orders
      .map((o) => ({
        name: names.get(o.supplierId) ?? `Supplier ${o.supplierId}`,
        poCount: o._count,
        poValue: num(o._sum.total),
        returnCount: returnsBy.get(o.supplierId) ?? 0,
        qcFailureCount: failuresBy.get(o.supplierId) ?? 0,
      }))
      .sort((a, b) => b.poValue - a.poValue);
  }

  private async purchaseOrders(scope: OrgScope) {
    const org = scope.organizationId;
    const today = new Date();
    const todayUtc = new Date(
      Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()),
    );
    const [open, overdue, total] = await Promise.all([
      this.prisma.scmPurchaseOrder.count({
        where: { organizationId: org, status: { in: OPEN_PO } },
      }),
      this.prisma.scmPurchaseOrder.count({
        where: {
          organizationId: org,
          status: { in: AWAITING_DELIVERY_PO },
          expectedDeliveryDate: { lt: todayUtc },
        },
      }),
      this.prisma.scmPurchaseOrder.count({ where: { organizationId: org } }),
    ]);
    return { open, overdue, total };
  }

  private async requisitions(scope: OrgScope) {
    const org = scope.organizationId;
    const [total, open] = await Promise.all([
      this.prisma.scmPurchaseRequisition.count({
        where: { organizationId: org },
      }),
      this.prisma.scmPurchaseRequisition.count({
        where: { organizationId: org, status: { in: OPEN_REQUISITION } },
      }),
    ]);
    return { total, open };
  }

  private async rfqs(scope: OrgScope) {
    const org = scope.organizationId;
    const [rfqs, quotations] = await Promise.all([
      this.prisma.scmRfq.count({ where: { organizationId: org } }),
      this.prisma.scmSupplierQuotation.count({
        where: { organizationId: org },
      }),
    ]);
    return { rfqs, quotations };
  }

  private async lowStock(scope: OrgScope) {
    const rows = await this.overview.replenishment(scope);
    return rows.map((r) => ({
      productName: r.productName,
      productCode: r.productCode,
      warehouse: r.warehouse,
      available: r.available,
      recommendedQty: r.recommendedQty,
    }));
  }

  private async inventory(scope: OrgScope) {
    const org = scope.organizationId;
    const [skus, sums, value, outOfStock, low] = await Promise.all([
      this.prisma.scmProduct.count({
        where: { organizationId: org, isActive: true },
      }),
      this.prisma.scmStockBalance.aggregate({
        where: { organizationId: org },
        _sum: { onHand: true, reserved: true, incoming: true },
      }),
      this.prisma.$queryRaw<{ value: Prisma.Decimal | null }[]>`
        SELECT SUM(sb.on_hand * p.cost_price) AS value
        FROM scm.stock_balances sb JOIN scm.products p ON p.id = sb.product_id
        WHERE sb.organization_id = ${org} AND p.cost_price > 0`,
      this.prisma.$queryRaw<{ n: bigint }[]>`
        SELECT COUNT(*) AS n FROM scm.products p
        WHERE p.organization_id = ${org} AND p.is_active
          AND COALESCE((SELECT SUM(sb.on_hand) FROM scm.stock_balances sb WHERE sb.product_id = p.id), 0) <= 0`,
      this.overview.replenishment(scope),
    ]);
    const onHand = num(sums._sum.onHand);
    const reserved = num(sums._sum.reserved);
    const rawValue = value[0]?.value;
    return {
      skus,
      onHand,
      available: onHand - reserved,
      reserved,
      incoming: num(sums._sum.incoming),
      value: rawValue === null || rawValue === undefined ? null : num(rawValue),
      lowStock: low.length,
      outOfStock: num(outOfStock[0]?.n),
    };
  }

  private async warehouse(scope: OrgScope) {
    const org = scope.organizationId;
    const [warehouses, active, locations, putaways, movements, picks, packs] =
      await Promise.all([
        this.prisma.scmWarehouse.count({
          where: { organizationId: org, deletedAt: null },
        }),
        this.prisma.scmWarehouse.count({
          where: { organizationId: org, deletedAt: null, status: "Active" },
        }),
        this.prisma.scmWarehouseLocation.count({
          where: { organizationId: org, deletedAt: null },
        }),
        this.prisma.scmPutaway.count({ where: { organizationId: org } }),
        this.prisma.scmWarehouseMovement.count({
          where: { organizationId: org },
        }),
        this.prisma.scmPicking.count({ where: { organizationId: org } }),
        this.prisma.scmPacking.count({ where: { organizationId: org } }),
      ]);
    return { warehouses, active, locations, putaways, movements, picks, packs };
  }

  private async fulfillment(scope: OrgScope) {
    const org = scope.organizationId;
    const [salesOrders, fulfillments, open, fulfilled, cancelled, backorders] =
      await Promise.all([
        this.prisma.scmSalesOrder.count({ where: { organizationId: org } }),
        this.prisma.scmFulfillment.count({ where: { organizationId: org } }),
        this.prisma.scmFulfillment.count({
          where: {
            organizationId: org,
            status: { notIn: ["FULFILLED", "CANCELLED"] },
          },
        }),
        this.prisma.scmFulfillment.count({
          where: { organizationId: org, status: "FULFILLED" },
        }),
        this.prisma.scmFulfillment.count({
          where: { organizationId: org, status: "CANCELLED" },
        }),
        this.prisma.$queryRaw<{ n: bigint }[]>`
        SELECT COUNT(DISTINCT fi.fulfillment_id) AS n
        FROM scm.fulfillment_items fi JOIN scm.fulfillments f ON f.id = fi.fulfillment_id
        WHERE f.organization_id = ${org} AND f.status NOT IN ('CANCELLED', 'FULFILLED')
          AND fi.ordered_qty > fi.reserved_qty`,
      ]);
    const counted = fulfillments - cancelled;
    return {
      salesOrders,
      fulfillments,
      open,
      backorders: num(backorders[0]?.n),
      completionRate: counted > 0 ? (fulfilled / counted) * 100 : 0,
    };
  }

  private async logistics(scope: OrgScope) {
    const org = scope.organizationId;
    const count = (statuses: string[]) =>
      this.prisma.scmShipment.count({
        where: { organizationId: org, status: { in: statuses } },
      });
    const [shipments, pending, inTransit, delivered, exceptions, recent] =
      await Promise.all([
        this.prisma.scmShipment.count({ where: { organizationId: org } }),
        count(["READY_TO_SHIP", "CARRIER_ASSIGNED", "LABEL_CREATED"]),
        count(["DISPATCHED", "IN_TRANSIT", "OUT_FOR_DELIVERY"]),
        count(["DELIVERED"]),
        this.prisma.scmShipmentException.count({
          where: { organizationId: org, resolvedAt: null },
        }),
        this.prisma.scmShipment.findMany({
          where: { organizationId: org },
          orderBy: { id: "desc" },
          take: 5,
          select: { shipmentNumber: true, status: true },
        }),
      ]);
    return {
      shipments,
      pending,
      inTransit,
      delivered,
      exceptions,
      recent: recent.map((s) => ({
        number: s.shipmentNumber,
        status: s.status,
      })),
    };
  }

  private async returns(scope: OrgScope) {
    const org = scope.organizationId;
    const [total, open, customer, vendor] = await Promise.all([
      this.prisma.scmReturn.count({ where: { organizationId: org } }),
      this.prisma.scmReturn.count({
        where: { organizationId: org, status: { notIn: CLOSED_RETURN } },
      }),
      this.prisma.scmReturn.count({
        where: { organizationId: org, returnType: "CUSTOMER_RETURN" },
      }),
      this.prisma.scmReturn.count({
        where: { organizationId: org, returnType: "VENDOR_RETURN" },
      }),
    ]);
    return { total, open, customer, vendor };
  }

  private async quality(scope: OrgScope) {
    const org = scope.organizationId;
    const byResult = (result: string) =>
      this.prisma.scmQualityInspection.count({
        where: { organizationId: org, result },
      });
    const [inspections, passed, failed, onHold, quarantined, critical] =
      await Promise.all([
        this.prisma.scmQualityInspection.count({
          where: { organizationId: org },
        }),
        byResult("PASSED"),
        byResult("FAILED"),
        byResult("ON_HOLD"),
        this.prisma.scmQuarantineRecord.count({
          where: {
            organizationId: org,
            status: { in: ["QUARANTINED", "UNDER_REVIEW"] },
          },
        }),
        this.prisma.$queryRaw<{ n: bigint }[]>`
        SELECT COUNT(*) AS n
        FROM scm.quality_inspection_items i
        JOIN scm.quality_inspections q ON q.id = i.inspection_id
        JOIN scm.quality_defects d ON d.defect_code = i.defect_code AND d.organization_id = q.organization_id
        WHERE q.organization_id = ${org} AND d.severity IN ('HIGH', 'CRITICAL')`,
      ]);
    return {
      inspections,
      passed,
      failed,
      onHold,
      quarantined,
      critical: num(critical[0]?.n),
    };
  }

  private async bills(scope: OrgScope) {
    const org = scope.organizationId;
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));
    const [unpaid, paid] = await Promise.all([
      this.prisma.scmSupplierBill.findMany({
        where: {
          organizationId: org,
          status: { in: ["OPEN", "PARTIALLY_PAID"] },
        },
        select: { total: true, paidAmount: true, status: true, dueDate: true },
      }),
      this.prisma.scmSupplierPayment.aggregate({
        where: {
          organizationId: org,
          status: "POSTED",
          paymentDate: { gte: monthStart },
        },
        _sum: { amount: true },
      }),
    ]);
    let outstandingTotal = 0;
    let overdue = 0;
    let overdueAmount = 0;
    for (const b of unpaid) {
      const due = outstanding(num(b.total), num(b.paidAmount));
      outstandingTotal += due;
      if (isOverdue(b)) {
        overdue += 1;
        overdueAmount += due;
      }
    }
    return {
      open: unpaid.length,
      outstanding: outstandingTotal,
      overdue,
      overdueAmount,
      paidThisMonth: num(paid._sum.amount),
    };
  }

  private async controlTower(scope: OrgScope) {
    const rows = await this.overview.controlTowerExceptions(scope);
    return rows.map((r) => ({ title: r.title, severity: r.severity }));
  }
}
