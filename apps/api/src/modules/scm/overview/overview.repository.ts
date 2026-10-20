import { Injectable } from "@nestjs/common";
import { Prisma } from "@texawave-erp/database";
import { OrgScoped } from "../../../common/decorators/org-scoped.decorator.js";
import type { OrgScope } from "../../../common/tenancy/org-scope.js";
import { PrismaService } from "../../../shared/prisma/prisma.service.js";

const num = (d: Prisma.Decimal | number | bigint | null | undefined) =>
  d === null || d === undefined ? 0 : Number(d);

export interface MasterHit {
  type: string;
  id: number;
  label: string;
  sublabel: string | null;
  path: string;
}

/** Read-only cross-cutting views: the supply-chain-stage Overview, a
 * Master Data search across every master, a barcode/code resolver, the
 * Control Tower exception feed and deterministic Replenishment
 * recommendations. Nothing here owns data — every row is a projection of
 * another domain's tables (same rule as Reports). */
@Injectable()
export class OverviewRepository {
  constructor(private readonly prisma: PrismaService) {}

  // ---- overview -----------------------------------------------------------

  @OrgScoped()
  async overview(scope: OrgScope) {
    const org = scope.organizationId;
    const [
      suppliers,
      products,
      requisitions,
      rfqs,
      quotations,
      purchaseOrders,
      goodsReceipts,
      salesOrders,
      fulfillments,
      shipments,
      returns,
      inspections,
    ] = await Promise.all([
      this.prisma.supplier.count({ where: { organizationId: org } }),
      this.prisma.scmProduct.count({
        where: { organizationId: org, isActive: true },
      }),
      this.prisma.scmPurchaseRequisition.count({
        where: { organizationId: org },
      }),
      this.prisma.scmRfq.count({ where: { organizationId: org } }),
      this.prisma.scmSupplierQuotation.count({
        where: { organizationId: org },
      }),
      this.prisma.scmPurchaseOrder.count({ where: { organizationId: org } }),
      this.prisma.scmGoodsReceipt.count({ where: { organizationId: org } }),
      this.prisma.scmSalesOrder.count({ where: { organizationId: org } }),
      this.prisma.scmFulfillment.count({ where: { organizationId: org } }),
      this.prisma.scmShipment.count({ where: { organizationId: org } }),
      this.prisma.scmReturn.count({ where: { organizationId: org } }),
      this.prisma.scmQualityInspection.count({
        where: { organizationId: org },
      }),
    ]);
    const metrics = await this.flowMetrics(org);
    return {
      metrics,
      stages: [
        { stage: "Suppliers", count: suppliers, path: "/scm/suppliers" },
        { stage: "Products", count: products, path: "/scm/products" },
        {
          stage: "Requisitions",
          count: requisitions,
          path: "/scm/procurement/requisitions",
        },
        { stage: "RFQs", count: rfqs, path: "/scm/procurement/rfqs" },
        {
          stage: "Quotations",
          count: quotations,
          path: "/scm/procurement/quotations",
        },
        {
          stage: "Purchase Orders",
          count: purchaseOrders,
          path: "/scm/procurement/purchase-orders",
        },
        {
          stage: "Goods Receipts",
          count: goodsReceipts,
          path: "/scm/procurement/goods-receipts",
        },
        {
          stage: "Sales Orders",
          count: salesOrders,
          path: "/scm/orders/sales-orders",
        },
        {
          stage: "Fulfillments",
          count: fulfillments,
          path: "/scm/orders/fulfillment",
        },
        {
          stage: "Shipments",
          count: shipments,
          path: "/scm/logistics/shipments",
        },
        { stage: "Returns", count: returns, path: "/scm/returns/all" },
        {
          stage: "QC Inspections",
          count: inspections,
          path: "/scm/quality/inspections",
        },
      ],
    };
  }

  /** Headline figures for the Supply Chain Flow and its KPI tiles (legacy
   * `useScmOverviewData`), computed with the same open/closed rules the
   * domain dashboards use. */
  private async flowMetrics(org: number) {
    const [
      activeSuppliers,
      openRequisitions,
      openInspections,
      openPurchaseOrders,
      stock,
      value,
      lowStock,
      openOrders,
      awaitingReceipt,
      openShipments,
    ] = await Promise.all([
      this.prisma.supplier.count({
        where: { organizationId: org, status: "Active", deletedAt: null },
      }),
      this.prisma.scmPurchaseRequisition.count({
        where: {
          organizationId: org,
          status: { in: ["DRAFT", "SUBMITTED", "APPROVED"] },
        },
      }),
      this.prisma.scmQualityInspection.count({
        where: {
          organizationId: org,
          status: { in: ["PENDING_INSPECTION", "IN_PROGRESS"] },
        },
      }),
      this.prisma.scmPurchaseOrder.count({
        where: {
          organizationId: org,
          status: { in: ["APPROVED", "SENT", "PARTIALLY_RECEIVED"] },
        },
      }),
      this.prisma.$queryRaw<{ rows: bigint; units: Prisma.Decimal | null }[]>`
        SELECT COUNT(*) AS rows, SUM(GREATEST(on_hand - reserved, 0)) AS units
        FROM scm.stock_balances WHERE organization_id = ${org}`,
      this.prisma.$queryRaw<{ value: Prisma.Decimal | null; costed: bigint }[]>`
        SELECT SUM(sb.on_hand * p.cost_price) AS value, COUNT(*) AS costed
        FROM scm.stock_balances sb JOIN scm.products p ON p.id = sb.product_id
        WHERE sb.organization_id = ${org} AND p.cost_price > 0`,
      this.prisma.$queryRaw<{ n: bigint }[]>`
        SELECT COUNT(*) AS n
        FROM scm.stock_balances sb JOIN scm.products p ON p.id = sb.product_id
        WHERE sb.organization_id = ${org} AND p.reorder_level IS NOT NULL
          AND (sb.on_hand - sb.reserved) <= p.reorder_level`,
      this.prisma.$queryRaw<{ n: bigint }[]>`
        SELECT COUNT(*) AS n FROM scm.sales_orders so
        WHERE so.organization_id = ${org} AND so.status = 'CONFIRMED'
          AND NOT EXISTS (
            SELECT 1 FROM scm.fulfillments f
            WHERE f.sales_order_id = so.id AND f.status = 'FULFILLED')`,
      this.prisma.$queryRaw<{ n: bigint }[]>`
        SELECT COUNT(*) AS n FROM scm.purchase_orders po
        WHERE po.organization_id = ${org} AND po.status IN ('SENT', 'PARTIALLY_RECEIVED')
          AND EXISTS (
            SELECT 1 FROM scm.purchase_order_items i
            WHERE i.purchase_order_id = po.id AND i.received_quantity < i.quantity)`,
      this.prisma.scmShipment.count({
        where: {
          organizationId: org,
          status: { notIn: ["DELIVERED", "CANCELLED"] },
        },
      }),
    ]);
    return {
      activeSuppliers,
      openRequisitions,
      openInspections,
      openPurchaseOrders,
      unitsAvailable: num(stock[0]?.units),
      stockRows: num(stock[0]?.rows),
      inventoryValue: num(value[0]?.value),
      costedRows: num(value[0]?.costed),
      lowStockItems: num(lowStock[0]?.n),
      openSalesOrders: num(openOrders[0]?.n),
      posAwaitingReceipt: num(awaitingReceipt[0]?.n),
      openShipments,
    };
  }

  // ---- master data search --------------------------------------------------

  @OrgScoped()
  async search(scope: OrgScope, q: string): Promise<MasterHit[]> {
    const org = scope.organizationId;
    const like = { contains: q, mode: "insensitive" as const };
    const [suppliers, products, warehouses, customers, carriers] =
      await Promise.all([
        this.prisma.supplier.findMany({
          where: {
            organizationId: org,
            OR: [{ companyName: like }, { supplierCode: like }],
          },
          take: 10,
        }),
        this.prisma.scmProduct.findMany({
          where: {
            organizationId: org,
            OR: [{ name: like }, { productCode: like }],
          },
          take: 10,
        }),
        this.prisma.scmWarehouse.findMany({
          where: { organizationId: org, OR: [{ name: like }, { code: like }] },
          take: 10,
        }),
        this.prisma.scmCustomer.findMany({
          where: {
            organizationId: org,
            OR: [{ name: like }, { customerCode: like }],
          },
          take: 10,
        }),
        this.prisma.scmCarrier.findMany({
          where: {
            organizationId: org,
            OR: [{ carrierName: like }, { carrierCode: like }],
          },
          take: 10,
        }),
      ]);
    return [
      ...suppliers.map((s) => ({
        type: "Supplier",
        id: s.id,
        label: s.companyName,
        sublabel: s.supplierCode,
        path: `/scm/suppliers/${s.id}`,
      })),
      ...products.map((p) => ({
        type: "Product",
        id: p.id,
        label: p.name,
        sublabel: p.productCode,
        path: `/scm/products`,
      })),
      ...warehouses.map((w) => ({
        type: "Warehouse",
        id: w.id,
        label: w.name,
        sublabel: w.code,
        path: `/scm/warehouses`,
      })),
      ...customers.map((c) => ({
        type: "Customer",
        id: c.id,
        label: c.name,
        sublabel: c.customerCode,
        path: `/scm/customers`,
      })),
      ...carriers.map((c) => ({
        type: "Carrier",
        id: c.id,
        label: c.carrierName,
        sublabel: c.carrierCode,
        path: `/scm/logistics/carriers`,
      })),
    ];
  }

  // ---- barcode / code resolver ----------------------------------------------

  /** Checks a scanned/typed code against every document number and master
   * code, in the order an operator would scan them most often. Returns the
   * first match, or null. */
  @OrgScoped()
  async resolveCode(scope: OrgScope, code: string): Promise<MasterHit | null> {
    const org = scope.organizationId;
    const exact = { equals: code, mode: "insensitive" as const };

    const product = await this.prisma.scmProduct.findFirst({
      where: { organizationId: org, productCode: exact },
    });
    if (product) {
      return {
        type: "Product",
        id: product.id,
        label: product.name,
        sublabel: product.productCode,
        path: "/scm/products",
      };
    }
    const batch = await this.prisma.scmStockBatch.findFirst({
      where: { organizationId: org, batchNumber: exact },
      include: { product: true },
    });
    if (batch) {
      return {
        type: "Batch",
        id: batch.id,
        label: `${batch.batchNumber} — ${batch.product.name}`,
        sublabel: `${num(batch.quantity)} on hand`,
        path: "/scm/inventory/batches",
      };
    }
    const serial = await this.prisma.scmSerialNumber.findFirst({
      where: { organizationId: org, serialNumber: exact },
      include: { product: true },
    });
    if (serial) {
      return {
        type: "Serial",
        id: serial.id,
        label: `${serial.serialNumber} — ${serial.product.name}`,
        sublabel: serial.status,
        path: "/scm/inventory/serials",
      };
    }
    const grn = await this.prisma.scmGoodsReceipt.findFirst({
      where: { organizationId: org, grnNumber: exact },
    });
    if (grn) {
      return {
        type: "Goods Receipt",
        id: grn.id,
        label: grn.grnNumber,
        sublabel: grn.status,
        path: "/scm/procurement/goods-receipts",
      };
    }
    const po = await this.prisma.scmPurchaseOrder.findFirst({
      where: { organizationId: org, poNumber: exact },
    });
    if (po) {
      return {
        type: "Purchase Order",
        id: po.id,
        label: po.poNumber,
        sublabel: po.status,
        path: "/scm/procurement/purchase-orders",
      };
    }
    const so = await this.prisma.scmSalesOrder.findFirst({
      where: { organizationId: org, soNumber: exact },
    });
    if (so) {
      return {
        type: "Sales Order",
        id: so.id,
        label: so.soNumber,
        sublabel: so.status,
        path: "/scm/orders/sales-orders",
      };
    }
    const fulfillment = await this.prisma.scmFulfillment.findFirst({
      where: { organizationId: org, fulfillmentNumber: exact },
    });
    if (fulfillment) {
      return {
        type: "Fulfillment",
        id: fulfillment.id,
        label: fulfillment.fulfillmentNumber,
        sublabel: fulfillment.status,
        path: "/scm/orders/fulfillment",
      };
    }
    const shipment = await this.prisma.scmShipment.findFirst({
      where: {
        organizationId: org,
        OR: [{ shipmentNumber: exact }, { trackingNumber: exact }],
      },
    });
    if (shipment) {
      return {
        type: "Shipment",
        id: shipment.id,
        label: shipment.shipmentNumber,
        sublabel: shipment.status,
        path: "/scm/logistics/shipments",
      };
    }
    const ret = await this.prisma.scmReturn.findFirst({
      where: { organizationId: org, returnNumber: exact },
    });
    if (ret) {
      return {
        type: "Return",
        id: ret.id,
        label: ret.returnNumber,
        sublabel: ret.status,
        path: "/scm/returns/all",
      };
    }
    const inspection = await this.prisma.scmQualityInspection.findFirst({
      where: { organizationId: org, inspectionNumber: exact },
    });
    if (inspection) {
      return {
        type: "QC Inspection",
        id: inspection.id,
        label: inspection.inspectionNumber,
        sublabel: inspection.status,
        path: "/scm/quality/inspections",
      };
    }
    const supplier = await this.prisma.supplier.findFirst({
      where: { organizationId: org, supplierCode: exact },
    });
    if (supplier) {
      return {
        type: "Supplier",
        id: supplier.id,
        label: supplier.companyName,
        sublabel: supplier.supplierCode,
        path: `/scm/suppliers/${supplier.id}`,
      };
    }
    return null;
  }

  // ---- control tower --------------------------------------------------------

  /** Deterministic exceptions, not a learned model: the same hand-rolled
   * rules the legacy exception engine used, just computed server-side. */
  @OrgScoped()
  async controlTowerExceptions(scope: OrgScope) {
    const org = scope.organizationId;
    const staleBefore = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const [
      lowStock,
      stuckPOs,
      agedInspections,
      stuckFulfillments,
      shipmentExceptions,
    ] = await Promise.all([
      this.prisma.$queryRaw<
        {
          product_code: string;
          name: string;
          available: Prisma.Decimal;
          reorder_level: Prisma.Decimal;
        }[]
      >`
          SELECT p.product_code, p.name, (sb.on_hand - sb.reserved) AS available, p.reorder_level
          FROM scm.stock_balances sb
          JOIN scm.products p ON p.id = sb.product_id
          WHERE sb.organization_id = ${org} AND p.reorder_level IS NOT NULL
            AND (sb.on_hand - sb.reserved) <= p.reorder_level
          LIMIT 50
        `,
      this.prisma.scmPurchaseOrder.findMany({
        where: {
          organizationId: org,
          status: { in: ["APPROVED"] },
          updatedAt: { lt: staleBefore },
        },
        take: 20,
      }),
      this.prisma.scmQualityInspection.findMany({
        where: {
          organizationId: org,
          status: "PENDING_INSPECTION",
          createdAt: { lt: staleBefore },
        },
        take: 20,
      }),
      this.prisma.scmFulfillment.findMany({
        where: {
          organizationId: org,
          status: { in: ["RESERVED", "PICKING", "PACKING"] },
          updatedAt: { lt: staleBefore },
        },
        take: 20,
      }),
      this.prisma.scmShipment.findMany({
        where: { organizationId: org, status: "DELIVERY_EXCEPTION" },
        take: 20,
      }),
    ]);
    const rows = [
      ...lowStock.map((r) => ({
        severity: "HIGH" as const,
        type: "LOW_STOCK",
        title: `${r.name} (${r.product_code}) is at or below reorder level`,
        detail: `${num(r.available)} available, reorder at ${num(r.reorder_level)}`,
        path: "/scm/reports/inventory",
      })),
      ...stuckPOs.map((po) => ({
        severity: "MEDIUM" as const,
        type: "PO_NOT_SENT",
        title: `${po.poNumber} approved but not sent for 3+ days`,
        detail: po.vendorNameSnapshot,
        path: "/scm/procurement/purchase-orders",
      })),
      ...agedInspections.map((i) => ({
        severity: "MEDIUM" as const,
        type: "INSPECTION_AGED",
        title: `${i.inspectionNumber} pending inspection for 3+ days`,
        detail: i.sourceNumber ?? String(i.sourceId),
        path: "/scm/quality/inspections",
      })),
      ...stuckFulfillments.map((f) => ({
        severity: "MEDIUM" as const,
        type: "FULFILLMENT_STALLED",
        title: `${f.fulfillmentNumber} stalled in ${f.status} for 3+ days`,
        detail: f.customerName,
        path: "/scm/orders/fulfillment",
      })),
      ...shipmentExceptions.map((s) => ({
        severity: "HIGH" as const,
        type: "DELIVERY_EXCEPTION",
        title: `${s.shipmentNumber} has an unresolved delivery exception`,
        detail: s.customerName,
        path: "/scm/logistics/shipments",
      })),
    ];
    return rows;
  }

  // ---- replenishment ----------------------------------------------------------

  /** Reorder-to quantity brings available stock up to `maximumStock` (or
   * twice the reorder level when no maximum is set) — a deterministic
   * formula, not a forecast. */
  @OrgScoped()
  async replenishment(scope: OrgScope) {
    const org = scope.organizationId;
    const rows = await this.prisma.$queryRaw<
      {
        product_id: number;
        product_code: string;
        name: string;
        warehouse_id: number;
        warehouse_name: string;
        available: Prisma.Decimal;
        reorder_level: Prisma.Decimal;
        maximum_stock: Prisma.Decimal | null;
        cost_price: Prisma.Decimal;
      }[]
    >`
      SELECT p.id AS product_id, p.product_code, p.name, sb.warehouse_id, w.name AS warehouse_name,
        (sb.on_hand - sb.reserved) AS available, p.reorder_level, p.maximum_stock, p.cost_price
      FROM scm.stock_balances sb
      JOIN scm.products p ON p.id = sb.product_id
      JOIN scm.warehouses w ON w.id = sb.warehouse_id
      WHERE sb.organization_id = ${org} AND p.reorder_level IS NOT NULL
        AND (sb.on_hand - sb.reserved) <= p.reorder_level
      ORDER BY (sb.on_hand - sb.reserved) ASC
      LIMIT 100
    `;
    return rows.map((r) => {
      const available = num(r.available);
      const reorderLevel = num(r.reorder_level);
      const target =
        r.maximum_stock !== null ? num(r.maximum_stock) : reorderLevel * 2;
      const recommendedQty = Math.max(0, target - available);
      return {
        productId: r.product_id,
        productCode: r.product_code,
        productName: r.name,
        warehouseId: r.warehouse_id,
        warehouse: r.warehouse_name,
        available,
        reorderLevel,
        target,
        recommendedQty,
        estimatedCost: recommendedQty * num(r.cost_price),
      };
    });
  }
}
