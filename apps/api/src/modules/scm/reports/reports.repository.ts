import { Injectable } from "@nestjs/common";
import { Prisma } from "@texawave-erp/database";
import { OrgScoped } from "../../../common/decorators/org-scoped.decorator.js";
import type { OrgScope } from "../../../common/tenancy/org-scope.js";
import { PrismaService } from "../../../shared/prisma/prisma.service.js";
import type { ReportQueryDto } from "./dto/reports.dto.js";

const num = (d: Prisma.Decimal | number | null | undefined) =>
  d === null || d === undefined ? 0 : Number(d);
const CAP = 500;

function dateRange(f: ReportQueryDto) {
  if (!f.from && !f.to) return undefined;
  return {
    ...(f.from ? { gte: new Date(f.from) } : {}),
    ...(f.to ? { lte: new Date(`${f.to}T23:59:59.999Z`) } : {}),
  };
}

/** Every method is a flat, capped row list ready for a table and a CSV
 * export — reports are read-only snapshots across every other SCM domain,
 * so this repository only ever reads (Docs/SCM_LEGACY_PARITY.md section
 * 10: "Reports must never invent a path for anything that already has a
 * home"). */
@Injectable()
export class ReportsRepository {
  constructor(private readonly prisma: PrismaService) {}

  @OrgScoped()
  async overview(scope: OrgScope) {
    const org = scope.organizationId;
    const [
      openPOs,
      openPOValue,
      lowStock,
      openFulfillments,
      shipmentsInTransit,
      openReturns,
      pendingInspections,
      activeSuppliers,
    ] = await Promise.all([
      this.prisma.scmPurchaseOrder.count({
        where: {
          organizationId: org,
          status: { in: ["APPROVED", "SENT", "PARTIALLY_RECEIVED"] },
        },
      }),
      this.prisma.scmPurchaseOrder.aggregate({
        where: {
          organizationId: org,
          status: { in: ["APPROVED", "SENT", "PARTIALLY_RECEIVED"] },
        },
        _sum: { total: true },
      }),
      this.prisma.$queryRaw<{ count: bigint }[]>`
        SELECT count(*)::bigint AS count FROM scm.stock_balances sb
        JOIN scm.products p ON p.id = sb.product_id
        WHERE sb.organization_id = ${org} AND p.reorder_level IS NOT NULL
          AND (sb.on_hand - sb.reserved) <= p.reorder_level
      `,
      this.prisma.scmFulfillment.count({
        where: {
          organizationId: org,
          status: { notIn: ["FULFILLED", "CANCELLED"] },
        },
      }),
      this.prisma.scmShipment.count({
        where: {
          organizationId: org,
          status: { in: ["DISPATCHED", "IN_TRANSIT", "OUT_FOR_DELIVERY"] },
        },
      }),
      this.prisma.scmReturn.count({
        where: {
          organizationId: org,
          status: { notIn: ["COMPLETED", "CANCELLED", "REJECTED"] },
        },
      }),
      this.prisma.scmQualityInspection.count({
        where: {
          organizationId: org,
          status: { in: ["PENDING_INSPECTION", "IN_PROGRESS"] },
        },
      }),
      this.prisma.supplier.count({
        where: { organizationId: org, status: "Active" },
      }),
    ]);
    return {
      openPOs,
      openPOValue: num(openPOValue._sum.total),
      lowStockProducts: Number(lowStock[0]?.count ?? 0),
      openFulfillments,
      shipmentsInTransit,
      openReturns,
      pendingInspections,
      activeSuppliers,
    };
  }

  @OrgScoped()
  async procurement(scope: OrgScope, f: ReportQueryDto) {
    const where: Prisma.ScmPurchaseOrderWhereInput = {
      organizationId: scope.organizationId,
      ...(f.supplierId ? { supplierId: f.supplierId } : {}),
      ...(f.warehouseId ? { warehouseId: f.warehouseId } : {}),
      ...(dateRange(f) ? { poDate: dateRange(f)! } : {}),
    };
    const rows = await this.prisma.scmPurchaseOrder.findMany({
      where,
      orderBy: { id: "desc" },
      take: CAP,
      include: { items: true, receipts: { select: { id: true } } },
    });
    return rows.map((po) => ({
      poNumber: po.poNumber,
      supplier: po.vendorNameSnapshot,
      poDate: po.poDate,
      status: po.status,
      lines: po.items.length,
      orderedQty: po.items.reduce((s, i) => s + num(i.quantity), 0),
      receivedQty: po.items.reduce((s, i) => s + num(i.receivedQuantity), 0),
      total: num(po.total),
      goodsReceipts: po.receipts.length,
    }));
  }

  @OrgScoped()
  async inventory(scope: OrgScope, f: ReportQueryDto) {
    const where: Prisma.ScmStockBalanceWhereInput = {
      organizationId: scope.organizationId,
      ...(f.warehouseId ? { warehouseId: f.warehouseId } : {}),
    };
    const rows = await this.prisma.scmStockBalance.findMany({
      where,
      orderBy: { id: "desc" },
      take: CAP,
      include: {
        product: {
          select: {
            productCode: true,
            name: true,
            reorderLevel: true,
            costPrice: true,
          },
        },
        warehouse: { select: { name: true } },
      },
    });
    return rows.map((b) => {
      const available = num(b.onHand) - num(b.reserved);
      const reorder =
        b.product.reorderLevel === null ? null : num(b.product.reorderLevel);
      return {
        productCode: b.product.productCode,
        productName: b.product.name,
        warehouse: b.warehouse.name,
        onHand: num(b.onHand),
        reserved: num(b.reserved),
        available,
        incoming: num(b.incoming),
        damaged: num(b.damaged),
        quarantine: num(b.quarantine),
        valuation: available * num(b.product.costPrice),
        status:
          reorder !== null && available <= reorder
            ? "Low Stock"
            : available <= 0
              ? "Out of Stock"
              : "Healthy",
      };
    });
  }

  @OrgScoped()
  async warehouse(scope: OrgScope) {
    const org = scope.organizationId;
    const warehouses = await this.prisma.scmWarehouse.findMany({
      where: { organizationId: org },
      orderBy: { id: "asc" },
    });
    const [locationCounts, occupied, putaways, movements] = await Promise.all([
      this.prisma.scmWarehouseLocation.groupBy({
        by: ["warehouseId"],
        where: { organizationId: org, status: "Active" },
        _count: { _all: true },
      }),
      this.prisma.scmLocationStock.groupBy({
        by: ["warehouseId"],
        where: { organizationId: org, quantity: { gt: 0 } },
        _count: { _all: true },
      }),
      this.prisma.scmPutaway.groupBy({
        by: ["warehouseId", "status"],
        where: { organizationId: org },
        _count: { _all: true },
      }),
      this.prisma.scmWarehouseMovement.groupBy({
        by: ["warehouseId", "status"],
        where: { organizationId: org },
        _count: { _all: true },
      }),
    ]);
    const locBy = new Map(
      locationCounts.map((l) => [l.warehouseId, l._count._all]),
    );
    const occBy = new Map(occupied.map((o) => [o.warehouseId, o._count._all]));
    return warehouses.map((w) => ({
      warehouse: w.name,
      code: w.code,
      status: w.status,
      activeLocations: locBy.get(w.id) ?? 0,
      occupiedLocations: occBy.get(w.id) ?? 0,
      pendingPutaways: putaways
        .filter(
          (p) =>
            p.warehouseId === w.id &&
            ["PENDING", "IN_PROGRESS"].includes(p.status),
        )
        .reduce((s, p) => s + p._count._all, 0),
      openMovements: movements
        .filter(
          (m) =>
            m.warehouseId === w.id &&
            m.status !== "COMPLETED" &&
            m.status !== "CANCELLED",
        )
        .reduce((s, m) => s + m._count._all, 0),
    }));
  }

  @OrgScoped()
  async fulfillment(scope: OrgScope, f: ReportQueryDto) {
    const where: Prisma.ScmFulfillmentWhereInput = {
      organizationId: scope.organizationId,
      ...(f.warehouseId ? { warehouseId: f.warehouseId } : {}),
      ...(dateRange(f) ? { createdAt: dateRange(f)! } : {}),
    };
    const rows = await this.prisma.scmFulfillment.findMany({
      where,
      orderBy: { id: "desc" },
      take: CAP,
      include: { items: true },
    });
    return rows.map((r) => ({
      fulfillmentNumber: r.fulfillmentNumber,
      salesOrder: r.salesOrderNumber,
      customer: r.customerName,
      status: r.status,
      deliveryStatus: r.deliveryStatus,
      orderedQty: r.items.reduce((s, i) => s + num(i.orderedQty), 0),
      issuedQty: r.items.reduce((s, i) => s + num(i.issuedQty), 0),
      createdAt: r.createdAt,
      deliveredAt: r.deliveredAt,
    }));
  }

  @OrgScoped()
  async logistics(scope: OrgScope, f: ReportQueryDto) {
    const where: Prisma.ScmShipmentWhereInput = {
      organizationId: scope.organizationId,
      ...(dateRange(f) ? { createdAt: dateRange(f)! } : {}),
    };
    const rows = await this.prisma.scmShipment.findMany({
      where,
      orderBy: { id: "desc" },
      take: CAP,
      include: { carrier: { select: { carrierName: true } } },
    });
    return rows.map((s) => ({
      shipmentNumber: s.shipmentNumber,
      customer: s.customerName,
      carrier: s.carrier?.carrierName ?? s.carrierName ?? "—",
      status: s.status,
      packages: s.totalPackages,
      shippingCost: s.shippingCost === null ? 0 : num(s.shippingCost),
      dispatchedAt: s.dispatchedAt,
      deliveredAt: s.deliveredAt,
    }));
  }

  @OrgScoped()
  async returns(scope: OrgScope, f: ReportQueryDto) {
    const where: Prisma.ScmReturnWhereInput = {
      organizationId: scope.organizationId,
      ...(dateRange(f) ? { requestedDate: dateRange(f)! } : {}),
    };
    const rows = await this.prisma.scmReturn.findMany({
      where,
      orderBy: { id: "desc" },
      take: CAP,
      include: { dispositions: true, items: true },
    });
    return rows.map((r) => ({
      returnNumber: r.returnNumber,
      type: r.returnType,
      party: r.customerName ?? r.supplierName ?? "—",
      reasonCode: r.reasonCode,
      status: r.status,
      lines: r.items.length,
      dispositionedQty: r.dispositions.reduce((s, d) => s + num(d.quantity), 0),
      requestedDate: r.requestedDate,
      completedAt: r.completedAt,
    }));
  }

  @OrgScoped()
  async quality(scope: OrgScope, f: ReportQueryDto) {
    const where: Prisma.ScmQualityInspectionWhereInput = {
      organizationId: scope.organizationId,
      ...(dateRange(f) ? { inspectionDate: dateRange(f)! } : {}),
    };
    const rows = await this.prisma.scmQualityInspection.findMany({
      where,
      orderBy: { id: "desc" },
      take: CAP,
      include: { items: true },
    });
    return rows.map((i) => ({
      inspectionNumber: i.inspectionNumber,
      type: i.inspectionType,
      source: i.sourceNumber ?? String(i.sourceId),
      status: i.status,
      result: i.result,
      defects: i.items.filter((it) => it.defectCode).length,
      inspectionDate: i.inspectionDate,
      completedAt: i.completedAt,
    }));
  }

  @OrgScoped()
  async suppliers(scope: OrgScope) {
    const org = scope.organizationId;
    const suppliers = await this.prisma.supplier.findMany({
      where: { organizationId: org },
      orderBy: { id: "asc" },
      take: CAP,
    });
    const ids = suppliers.map((s) => s.id);
    const [poAgg, grnCount, returnCount] = await Promise.all([
      this.prisma.scmPurchaseOrder.groupBy({
        by: ["supplierId"],
        where: { organizationId: org, supplierId: { in: ids } },
        _count: { _all: true },
        _sum: { total: true },
      }),
      this.prisma.scmGoodsReceipt.groupBy({
        by: ["supplierId"],
        where: { organizationId: org, supplierId: { in: ids } },
        _count: { _all: true },
      }),
      this.prisma.scmReturn.groupBy({
        by: ["supplierId"],
        where: {
          organizationId: org,
          returnType: "VENDOR_RETURN",
          supplierId: { in: ids.map(Number) },
        },
        _count: { _all: true },
      }),
    ]);
    const poBy = new Map(poAgg.map((p) => [p.supplierId, p]));
    const grnBy = new Map(grnCount.map((g) => [g.supplierId, g._count._all]));
    const retBy = new Map(
      returnCount.map((r) => [r.supplierId, r._count._all]),
    );
    return suppliers.map((s) => ({
      supplier: s.companyName,
      status: s.status,
      purchaseOrders: poBy.get(s.id)?._count._all ?? 0,
      totalSpend: num(poBy.get(s.id)?._sum.total ?? 0),
      goodsReceipts: grnBy.get(s.id) ?? 0,
      vendorReturns: retBy.get(s.id) ?? 0,
    }));
  }
}
