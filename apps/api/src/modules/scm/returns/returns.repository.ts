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
import { ScmNumberingService } from "../common/scm-numbering.service.js";
import { StockPostingService } from "../inventory/stock-posting.service.js";
import { QuarantineRepository } from "../quality/quarantine.repository.js";
import type {
  CompleteReturnInspectionDto,
  CreateCustomerReturnDto,
  CreateVendorReturnDto,
  DispositionDto,
  ReceiveReturnDto,
  ReturnShipmentDto,
  ShipVendorReturnDto,
} from "./dto/returns.dto.js";
import {
  RELEASED_RETURN_STATUSES,
  RETURNABLE_FULFILLMENT_STATUSES,
  dispositionError,
  isFullyDispositioned,
  remainingToDisposition,
  returnStatusesLeadingTo,
  type DispositionLine,
  type ReturnDisposition,
} from "./returns.helpers.js";

const num = (d: Prisma.Decimal | number | null | undefined) =>
  d === null || d === undefined ? 0 : Number(d);
const rule = (message: string, code: string) =>
  new BusinessRuleViolationException(message, code);
const label = (s: string) =>
  s
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

export interface ReturnFilter {
  q?: string | undefined;
  returnType?: string | undefined;
  status?: string | undefined;
  supplierId?: number | undefined;
}

type LockedReturn = NonNullable<Awaited<ReturnType<ReturnsRepository["lock"]>>>;

const listInclude = {
  items: { orderBy: { lineNo: "asc" } },
  warehouse: { select: { id: true, name: true, code: true } },
} satisfies Prisma.ScmReturnInclude;

/** Statuses before any stock moved or disposition completed. */
const DELETABLE_RETURN_STATUSES = [
  "REQUESTED",
  "PENDING_APPROVAL",
  "APPROVED",
  "REJECTED",
  "CANCELLED",
];

@Injectable()
export class ReturnsRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditWriter,
    private readonly numbering: ScmNumberingService,
    private readonly stock: StockPostingService,
    private readonly quarantine: QuarantineRepository,
  ) {}

  // ---- reads ------------------------------------------------------------------

  @OrgScoped()
  async findMany(scope: OrgScope, f: ReturnFilter, page: PaginationDto) {
    const where = tenantWhere<Prisma.ScmReturnWhereInput>(scope, {
      ...(f.returnType ? { returnType: f.returnType } : {}),
      ...(f.status ? { status: f.status } : {}),
      ...(f.supplierId ? { supplierId: f.supplierId } : {}),
      ...(f.q
        ? {
            OR: [
              { returnNumber: { contains: f.q, mode: "insensitive" } },
              { customerName: { contains: f.q, mode: "insensitive" } },
              { supplierName: { contains: f.q, mode: "insensitive" } },
              { salesOrderNumber: { contains: f.q, mode: "insensitive" } },
              { fulfillmentNumber: { contains: f.q, mode: "insensitive" } },
              { grnNumber: { contains: f.q, mode: "insensitive" } },
              {
                items: {
                  some: {
                    OR: [
                      { productCode: { contains: f.q, mode: "insensitive" } },
                      { batchNumber: { contains: f.q, mode: "insensitive" } },
                      { serialNumbers: { has: f.q } },
                    ],
                  },
                },
              },
            ],
          }
        : {}),
    });
    const [items, total] = await Promise.all([
      this.prisma.scmReturn.findMany({
        where,
        skip: page.skip,
        take: page.limit,
        orderBy: { id: "desc" },
        include: listInclude,
      }),
      this.prisma.scmReturn.count({ where }),
    ]);
    return { items, total };
  }

  @OrgScoped()
  async findOne(scope: OrgScope, id: number) {
    const ret = await this.prisma.scmReturn.findFirst({
      where: tenantWhere(scope, { id }),
      include: {
        ...listInclude,
        inspections: { orderBy: { id: "desc" } },
        dispositions: { orderBy: { id: "asc" } },
      },
    });
    if (!ret) return null;
    const [ledgerEntries, qc] = await Promise.all([
      this.prisma.scmStockLedgerEntry.findMany({
        where: {
          organizationId: scope.organizationId,
          referenceType: ret.returnType,
          referenceId: id,
        },
        orderBy: { id: "asc" },
      }),
      ret.qualityInspectionId
        ? this.prisma.scmQualityInspection.findFirst({
            where: {
              id: ret.qualityInspectionId,
              organizationId: scope.organizationId,
            },
            select: { id: true, inspectionNumber: true, status: true },
          })
        : null,
    ]);
    const items = ret.items.map((it) => {
      const line = this.toLine(it, ret.dispositions);
      return {
        ...it,
        dispositionQuantities: line.done,
        remainingToDisposition: remainingToDisposition(line),
      };
    });
    return { ...ret, items, ledgerEntries, qualityInspection: qc };
  }

  /** Fulfilled orders with the per-product quantity still returnable. */
  @OrgScoped()
  async customerSources(scope: OrgScope) {
    const org = scope.organizationId;
    const fulfillments = await this.prisma.scmFulfillment.findMany({
      where: {
        organizationId: org,
        status: { in: [...RETURNABLE_FULFILLMENT_STATUSES] },
      },
      orderBy: { id: "desc" },
      take: 200,
      include: {
        items: { orderBy: { lineNo: "asc" } },
        shipments: {
          where: { status: { not: "CANCELLED" } },
          select: { id: true, shipmentNumber: true },
        },
      },
    });
    const ids = fulfillments.map((f) => f.id);
    const open = ids.length
      ? await this.prisma.scmReturnItem.findMany({
          where: {
            return: {
              organizationId: org,
              returnType: "CUSTOMER_RETURN",
              fulfillmentId: { in: ids },
              status: { notIn: [...RELEASED_RETURN_STATUSES] },
            },
          },
          select: {
            productId: true,
            requestedQty: true,
            return: { select: { fulfillmentId: true } },
          },
        })
      : [];
    return fulfillments.map((f) => ({
      fulfillmentId: f.id,
      fulfillmentNumber: f.fulfillmentNumber,
      salesOrderNumber: f.salesOrderNumber,
      customerName: f.customerName,
      warehouseId: f.warehouseId,
      shipments: f.shipments,
      lines: f.items
        .filter((i) => num(i.issuedQty) > 0)
        .map((i) => {
          const returned = open
            .filter(
              (o) =>
                o.return.fulfillmentId === f.id && o.productId === i.productId,
            )
            .reduce((s, o) => s + num(o.requestedQty), 0);
          const fulfilled = f.items
            .filter((x) => x.productId === i.productId)
            .reduce((s, x) => s + num(x.issuedQty), 0);
          return {
            productId: i.productId,
            productCode: i.itemCode,
            productName: i.itemDescription,
            uom: i.uom,
            orderedQty: num(i.orderedQty),
            fulfilledQty: fulfilled,
            returnedQty: returned,
            eligibleQty: Math.max(0, fulfilled - returned),
          };
        }),
    }));
  }

  /** Received GRNs with the per-line quantity still returnable. */
  @OrgScoped()
  async vendorSources(scope: OrgScope) {
    const org = scope.organizationId;
    const grns = await this.prisma.scmGoodsReceipt.findMany({
      where: { organizationId: org, status: "COMPLETED" },
      orderBy: { id: "desc" },
      take: 200,
      include: {
        purchaseOrder: { select: { poNumber: true } },
        items: { include: { product: true }, orderBy: { id: "asc" } },
      },
    });
    const ids = grns.map((g) => g.id);
    const open = ids.length
      ? await this.prisma.scmReturnItem.findMany({
          where: {
            return: {
              organizationId: org,
              returnType: "VENDOR_RETURN",
              grnId: { in: ids },
              status: { notIn: [...RELEASED_RETURN_STATUSES] },
            },
          },
          select: {
            productId: true,
            batchNumber: true,
            requestedQty: true,
            return: { select: { grnId: true } },
          },
        })
      : [];
    return grns.map((g) => ({
      grnId: g.id,
      grnNumber: g.grnNumber,
      poNumber: g.purchaseOrder.poNumber,
      supplierName: g.vendorNameSnapshot,
      warehouseId: g.warehouseId,
      lines: g.items
        .filter((i) => num(i.acceptedQuantity) > 0)
        .map((i) => {
          const sameGroup = g.items.filter(
            (x) =>
              x.productId === i.productId &&
              (x.batchNumber ?? "") === (i.batchNumber ?? ""),
          );
          const received = sameGroup.reduce(
            (s, x) => s + num(x.acceptedQuantity),
            0,
          );
          const returned = open
            .filter(
              (o) =>
                o.return.grnId === g.id &&
                o.productId === i.productId &&
                (o.batchNumber ?? "") === (i.batchNumber ?? ""),
            )
            .reduce((s, o) => s + num(o.requestedQty), 0);
          return {
            grnItemId: i.id,
            productId: i.productId,
            productCode: i.product.productCode,
            productName: i.productNameSnapshot,
            uom: i.uom,
            batchNumber: i.batchNumber,
            serialNumbers: i.serialNumbers,
            receivedQty: received,
            returnedQty: returned,
            eligibleQty: Math.max(0, received - returned),
            unitCost: num(i.unitCost),
          };
        }),
    }));
  }

  @OrgScoped()
  async typeOf(scope: OrgScope, id: number) {
    const r = await this.prisma.scmReturn.findFirst({
      where: tenantWhere(scope, { id }),
      select: { returnType: true },
    });
    return r?.returnType ?? null;
  }

  @OrgScoped()
  async dashboard(scope: OrgScope) {
    const org = scope.organizationId;
    const [byStatus, byType, dispositions, recent] = await Promise.all([
      this.prisma.scmReturn.groupBy({
        by: ["status"],
        where: { organizationId: org },
        _count: { _all: true },
      }),
      this.prisma.scmReturn.groupBy({
        by: ["returnType"],
        where: { organizationId: org },
        _count: { _all: true },
      }),
      this.prisma.scmReturnDisposition.groupBy({
        by: ["disposition"],
        where: { organizationId: org },
        _sum: { quantity: true },
      }),
      this.prisma.scmReturn.findMany({
        where: { organizationId: org },
        orderBy: { updatedAt: "desc" },
        take: 10,
      }),
    ]);
    return {
      byStatus: Object.fromEntries(
        byStatus.map((r) => [r.status, r._count._all]),
      ),
      byType: Object.fromEntries(
        byType.map((r) => [r.returnType, r._count._all]),
      ),
      dispositionedQty: Object.fromEntries(
        dispositions.map((d) => [d.disposition, num(d._sum.quantity)]),
      ),
      recent,
    };
  }

  // ---- shared tx helpers ------------------------------------------------------

  async lock(tx: Prisma.TransactionClient, scope: OrgScope, id: number) {
    await tx.$queryRaw`SELECT id FROM scm.returns WHERE id = ${id} AND organization_id = ${scope.organizationId} FOR UPDATE`;
    return tx.scmReturn.findFirst({
      where: tenantWhere(scope, { id }),
      include: { items: { orderBy: { lineNo: "asc" } } },
    });
  }

  private toLine(
    item: {
      id: number;
      acceptedQty: Prisma.Decimal | null;
      rejectedQty: Prisma.Decimal | null;
      condition: string | null;
    },
    dispositions: {
      returnItemId: number;
      disposition: string;
      quantity: Prisma.Decimal;
    }[],
  ): DispositionLine {
    const done: Partial<Record<ReturnDisposition, number>> = {};
    for (const d of dispositions) {
      if (d.returnItemId !== item.id) continue;
      const k = d.disposition as ReturnDisposition;
      done[k] = (done[k] ?? 0) + num(d.quantity);
    }
    return {
      acceptedQty: num(item.acceptedQty),
      rejectedQty: num(item.rejectedQty),
      condition: item.condition,
      done,
    };
  }

  /** Atomically moves the return to `to` (checking the lifecycle map) and
   * audits. Throws on a wrong source status. */
  private async move(
    tx: Prisma.TransactionClient,
    scope: OrgScope,
    ret: LockedReturn,
    to: string,
    data: Prisma.ScmReturnUncheckedUpdateInput,
    actorId: number,
    reason?: string,
  ) {
    if (!returnStatusesLeadingTo(ret.returnType, to).includes(ret.status)) {
      throw new InvalidStateTransitionException("Return", ret.status, to);
    }
    const after = await tx.scmReturn.update({
      where: { id: ret.id },
      data: { ...data, status: to, updatedBy: actorId },
      include: listInclude,
    });
    await this.audit.write(tx, {
      entityType: "scm_return",
      entityId: ret.id,
      action: "status_change",
      before: { status: ret.status },
      after: { status: to },
      reason,
    });
    return after;
  }

  private async run<T>(
    scope: OrgScope,
    id: number,
    fn: (tx: Prisma.TransactionClient, ret: LockedReturn) => Promise<T>,
  ): Promise<T | null> {
    return this.prisma.$transaction(async (tx) => {
      const ret = await this.lock(tx, scope, id);
      if (!ret) return null;
      return fn(tx, ret);
    });
  }

  private requireStatus(ret: LockedReturn, status: string) {
    if (ret.status !== status) {
      throw rule(
        `Return is ${label(ret.status)}, not ${label(status)}.`,
        "RETURN_STATE",
      );
    }
  }

  // ---- create -----------------------------------------------------------------

  /** Creates a customer return at REQUESTED. Eligibility is recomputed here
   * from the fulfillment (issued quantity) and every other open return under
   * a row lock on the fulfillment — never from client-passed quantities. */
  @OrgScoped()
  async createCustomer(
    scope: OrgScope,
    dto: CreateCustomerReturnDto,
    actorId: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const org = scope.organizationId;
      if (
        new Set(dto.items.map((i) => i.productId)).size !== dto.items.length
      ) {
        throw rule(
          "Each product may appear only once per return.",
          "RETURN_DUP",
        );
      }
      await tx.$queryRaw`SELECT id FROM scm.fulfillments WHERE id = ${dto.fulfillmentId} AND organization_id = ${org} FOR UPDATE`;
      const f = await tx.scmFulfillment.findFirst({
        where: { id: dto.fulfillmentId, organizationId: org },
        include: { items: true },
      });
      if (!f) throw rule("Source fulfillment not found.", "RETURN_SOURCE");
      if (
        !(RETURNABLE_FULFILLMENT_STATUSES as readonly string[]).includes(
          f.status,
        )
      ) {
        throw rule(
          "Only fulfilled (shipped) orders can be returned.",
          "RETURN_SOURCE",
        );
      }
      let shipmentNumber: string | null = null;
      if (dto.shipmentId) {
        const s = await tx.scmShipment.findFirst({
          where: {
            id: dto.shipmentId,
            organizationId: org,
            fulfillmentId: f.id,
          },
          select: { shipmentNumber: true },
        });
        if (!s)
          throw rule(
            "Shipment does not belong to this fulfillment.",
            "RETURN_SOURCE",
          );
        shipmentNumber = s.shipmentNumber;
      }

      const rows: Prisma.ScmReturnItemCreateWithoutReturnInput[] = [];
      let lineNo = 0;
      for (const it of dto.items) {
        const lines = f.items.filter((l) => l.productId === it.productId);
        const fulfilled = lines.reduce((s, l) => s + num(l.issuedQty), 0);
        const first = lines[0];
        if (!first || fulfilled <= 0) {
          const p = await tx.scmProduct.findFirst({
            where: { id: it.productId, organizationId: org },
            select: { productCode: true },
          });
          throw rule(
            `${p?.productCode ?? `Product ${it.productId}`} was not issued on ${f.fulfillmentNumber}.`,
            "RETURN_SOURCE",
          );
        }
        const prior = await tx.scmReturnItem.aggregate({
          _sum: { requestedQty: true },
          where: {
            productId: it.productId,
            return: {
              organizationId: org,
              returnType: "CUSTOMER_RETURN",
              fulfillmentId: f.id,
              status: { notIn: [...RELEASED_RETURN_STATUSES] },
            },
          },
        });
        const previously = num(prior._sum.requestedQty);
        const eligible = fulfilled - previously;
        if (it.requestedQuantity > eligible + 1e-9) {
          throw rule(
            `Cannot return ${it.requestedQuantity} of ${first.itemCode} — only ${Math.max(0, eligible)} eligible (source ${fulfilled}, already returned ${previously}).`,
            "OVER_RETURN",
          );
        }
        const product = await tx.scmProduct.findFirst({
          where: { id: it.productId, organizationId: org },
          select: { costPrice: true },
        });
        if (it.batchId) {
          await this.stock.loadAndValidateBatch(
            tx,
            org,
            it.batchId,
            it.productId,
          );
        }
        rows.push({
          lineNo: ++lineNo,
          product: { connect: { id: it.productId } },
          productCode: first.itemCode,
          productName: first.itemDescription,
          uom: first.uom,
          orderedQty: lines.reduce((s, l) => s + num(l.orderedQty), 0),
          sourceQty: fulfilled,
          previouslyReturnedQty: previously,
          requestedQty: it.requestedQuantity,
          batchId: it.batchId ?? null,
          serialNumbers: it.serialNumbers ?? [],
          warehouseId: f.warehouseId,
          unitCost: product ? num(product.costPrice) : null,
          notes: it.notes?.trim() || null,
        });
      }

      const returnNumber = await this.numbering.next(tx, org, "customerReturn");
      const created = await tx.scmReturn.create({
        data: {
          organizationId: org,
          returnNumber,
          returnType: "CUSTOMER_RETURN",
          salesOrderId: f.salesOrderId,
          salesOrderNumber: f.salesOrderNumber,
          fulfillmentId: f.id,
          fulfillmentNumber: f.fulfillmentNumber,
          shipmentId: dto.shipmentId ?? null,
          shipmentNumber,
          customerId: f.customerId,
          customerName: f.customerName,
          warehouseId: f.warehouseId,
          reasonCode: dto.reasonCode,
          reasonDescription: dto.reasonDescription?.trim() || null,
          status: "REQUESTED",
          notes: dto.notes?.trim() || null,
          createdBy: actorId,
          items: { create: rows },
        },
        include: listInclude,
      });
      await this.audit.write(tx, {
        entityType: "scm_return",
        entityId: created.id,
        action: "create",
        after: { returnNumber, fulfillment: f.fulfillmentNumber },
      });
      return created;
    });
  }

  /** Creates a vendor return at REQUESTED. Eligibility is recomputed from
   * the GRN's accepted quantity (per product + batch) and every other open
   * return, under a row lock on the GRN. */
  @OrgScoped()
  async createVendor(
    scope: OrgScope,
    dto: CreateVendorReturnDto,
    actorId: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const org = scope.organizationId;
      if (
        new Set(dto.items.map((i) => i.grnItemId)).size !== dto.items.length
      ) {
        throw rule(
          "Each GRN line may appear only once per return.",
          "RETURN_DUP",
        );
      }
      await tx.$queryRaw`SELECT id FROM scm.goods_receipts WHERE id = ${dto.grnId} AND organization_id = ${org} FOR UPDATE`;
      const grn = await tx.scmGoodsReceipt.findFirst({
        where: { id: dto.grnId, organizationId: org },
        include: {
          purchaseOrder: { select: { poNumber: true } },
          items: { include: { product: true } },
        },
      });
      if (!grn) throw rule("Source GRN not found.", "RETURN_SOURCE");
      if (grn.status !== "COMPLETED") {
        throw rule(
          "Only received GRNs can be returned against.",
          "RETURN_SOURCE",
        );
      }

      const rows: Prisma.ScmReturnItemCreateWithoutReturnInput[] = [];
      let lineNo = 0;
      for (const it of dto.items) {
        const line = grn.items.find((l) => l.id === it.grnItemId);
        if (!line) throw rule("GRN line not found.", "RETURN_SOURCE");
        const code = line.product.productCode;
        const serials = it.serialNumbers?.length ? it.serialNumbers : undefined;
        if (line.serialNumbers.length > 0) {
          if (!serials || serials.length !== Math.round(it.requestedQuantity)) {
            throw rule(
              `${code}: select exactly ${it.requestedQuantity} serial number(s) to return.`,
              "RETURN_SERIALS",
            );
          }
          const bad = serials.find((sn) => !line.serialNumbers.includes(sn));
          if (bad) {
            throw rule(
              `Serial ${bad} was not received on ${grn.grnNumber}.`,
              "RETURN_SERIALS",
            );
          }
        }
        const batchKey = line.batchNumber ?? "";
        const sourceQty = grn.items
          .filter(
            (l) =>
              l.productId === line.productId &&
              (l.batchNumber ?? "") === batchKey,
          )
          .reduce((s, l) => s + num(l.acceptedQuantity), 0);
        const prior = await tx.scmReturnItem.aggregate({
          _sum: { requestedQty: true },
          where: {
            productId: line.productId,
            ...(line.batchNumber === null
              ? { batchNumber: null }
              : { batchNumber: line.batchNumber }),
            return: {
              organizationId: org,
              returnType: "VENDOR_RETURN",
              grnId: grn.id,
              status: { notIn: [...RELEASED_RETURN_STATUSES] },
            },
          },
        });
        const previously = num(prior._sum.requestedQty);
        const eligible = sourceQty - previously;
        if (it.requestedQuantity > eligible + 1e-9) {
          throw rule(
            `Cannot return ${it.requestedQuantity} of ${code} — only ${Math.max(0, eligible)} eligible (source ${sourceQty}, already returned ${previously}).`,
            "OVER_RETURN",
          );
        }
        const batch = line.batchNumber
          ? await tx.scmStockBatch.findFirst({
              where: {
                organizationId: org,
                batchNumber: line.batchNumber,
                productId: line.productId,
                warehouseId: grn.warehouseId,
              },
            })
          : null;
        rows.push({
          lineNo: ++lineNo,
          product: { connect: { id: line.productId } },
          productCode: code,
          productName: line.productNameSnapshot,
          uom: line.uom,
          sourceQty,
          previouslyReturnedQty: previously,
          requestedQty: it.requestedQuantity,
          grnItemId: line.id,
          batchId: batch?.id ?? null,
          batchNumber: line.batchNumber,
          serialNumbers: serials ?? [],
          warehouseId: grn.warehouseId,
          locationId: grn.locationId,
          unitCost: num(line.unitCost),
          notes: it.notes?.trim() || null,
        });
      }

      const returnNumber = await this.numbering.next(tx, org, "vendorReturn");
      const created = await tx.scmReturn.create({
        data: {
          organizationId: org,
          returnNumber,
          returnType: "VENDOR_RETURN",
          purchaseOrderId: grn.purchaseOrderId,
          purchaseOrderNumber: grn.purchaseOrder.poNumber,
          grnId: grn.id,
          grnNumber: grn.grnNumber,
          supplierId: grn.supplierId,
          supplierName: grn.vendorNameSnapshot,
          warehouseId: grn.warehouseId,
          reasonCode: dto.reasonCode,
          reasonDescription: dto.reasonDescription?.trim() || null,
          status: "REQUESTED",
          notes: dto.notes?.trim() || null,
          createdBy: actorId,
          items: { create: rows },
        },
        include: listInclude,
      });
      await this.audit.write(tx, {
        entityType: "scm_return",
        entityId: created.id,
        action: "create",
        after: { returnNumber, grn: grn.grnNumber },
      });
      return created;
    });
  }

  // ---- approval / cancellation ------------------------------------------------

  @OrgScoped()
  submit(scope: OrgScope, id: number, actorId: number) {
    return this.run(scope, id, (tx, ret) =>
      this.move(tx, scope, ret, "PENDING_APPROVAL", {}, actorId),
    );
  }

  @OrgScoped()
  approve(scope: OrgScope, id: number, actorId: number) {
    return this.run(scope, id, (tx, ret) =>
      this.move(
        tx,
        scope,
        ret,
        "APPROVED",
        { approvedBy: actorId, approvedAt: new Date() },
        actorId,
      ),
    );
  }

  @OrgScoped()
  reject(scope: OrgScope, id: number, reason: string, actorId: number) {
    return this.run(scope, id, (tx, ret) =>
      this.move(
        tx,
        scope,
        ret,
        "REJECTED",
        { rejectionReason: reason },
        actorId,
        reason,
      ),
    );
  }

  /** Blocked once any inventory has been posted — a reversal is a separate
   * controlled transaction. */
  @OrgScoped()
  cancel(scope: OrgScope, id: number, reason: string, actorId: number) {
    return this.run(scope, id, async (tx, ret) => {
      const posted = await tx.scmStockLedgerEntry.count({
        where: {
          organizationId: scope.organizationId,
          referenceType: ret.returnType,
          referenceId: ret.id,
        },
      });
      if (posted > 0) {
        throw rule(
          "This return has already posted inventory movements and cannot be cancelled — a reversal must be a separate controlled transaction.",
          "RETURN_POSTED",
        );
      }
      const why = reason || "Cancelled by user";
      return this.move(
        tx,
        scope,
        ret,
        "CANCELLED",
        {
          cancelledBy: actorId,
          cancelledAt: new Date(),
          cancellationReason: why,
        },
        actorId,
        why,
      );
    });
  }

  // ---- customer return flow ---------------------------------------------------

  @OrgScoped()
  markInTransit(
    scope: OrgScope,
    id: number,
    info: ReturnShipmentDto,
    actorId: number,
  ) {
    return this.run(scope, id, (tx, ret) =>
      this.move(
        tx,
        scope,
        ret,
        "IN_TRANSIT",
        {
          returnShipment: {
            ...((ret.returnShipment as object | null) ?? {}),
            ...info,
          } as Prisma.InputJsonValue,
        },
        actorId,
      ),
    );
  }

  @OrgScoped()
  receive(scope: OrgScope, id: number, dto: ReceiveReturnDto, actorId: number) {
    return this.run(scope, id, async (tx, ret) => {
      this.requireStatus(ret, "IN_TRANSIT");
      const byItem = new Map(
        (dto.receivedQuantities ?? []).map((r) => [r.itemId, r.quantity]),
      );
      let total = 0;
      for (const it of ret.items) {
        const qty = byItem.get(it.id) ?? num(it.requestedQty);
        if (!Number.isFinite(qty) || qty < 0) {
          throw rule(
            `${it.productCode}: received quantity cannot be negative.`,
            "RETURN_QTY",
          );
        }
        if (qty > num(it.requestedQty)) {
          throw rule(
            `${it.productCode}: received ${qty} exceeds the requested ${num(it.requestedQty)}.`,
            "RETURN_QTY",
          );
        }
        total += qty;
        await tx.scmReturnItem.update({
          where: { id: it.id },
          data: { receivedReturnQty: qty },
        });
      }
      if (total <= 0) {
        throw rule(
          "Enter the quantity received for at least one line.",
          "RETURN_QTY",
        );
      }
      if (dto.warehouseId) {
        const wh = await tx.scmWarehouse.findFirst({
          where: { id: dto.warehouseId, organizationId: scope.organizationId },
        });
        if (!wh) throw rule("Warehouse not found.", "RETURN_WAREHOUSE");
      }
      return this.move(
        tx,
        scope,
        ret,
        "RECEIVED",
        {
          receivedBy: actorId,
          receivedAt: new Date(),
          warehouseId: dto.warehouseId ?? ret.warehouseId,
          notes: dto.notes?.trim() || ret.notes,
          returnShipment: {
            ...((ret.returnShipment as object | null) ?? {}),
            receivedDate: new Date().toISOString(),
          } as Prisma.InputJsonValue,
        },
        actorId,
        `${total} unit(s) across ${ret.items.length} line(s)`,
      );
    });
  }

  @OrgScoped()
  startInspection(scope: OrgScope, id: number, actorId: number) {
    return this.run(scope, id, (tx, ret) =>
      this.move(tx, scope, ret, "INSPECTION_PENDING", {}, actorId),
    );
  }

  /** Basic return inspection: every line's accepted + rejected must equal
   * what was received. Disposition is a separate, later decision. */
  @OrgScoped()
  completeInspection(
    scope: OrgScope,
    id: number,
    dto: CompleteReturnInspectionDto,
    actorId: number,
  ) {
    return this.run(scope, id, async (tx, ret) => {
      this.requireStatus(ret, "INSPECTION_PENDING");
      const byItem = new Map(dto.itemResults.map((r) => [r.itemId, r]));
      let accepted = 0;
      let rejected = 0;
      const lines: {
        itemId: number;
        condition: string;
        acceptedQuantity: number;
        rejectedQuantity: number;
      }[] = [];
      for (const it of ret.items) {
        const r = byItem.get(it.id);
        if (!r) {
          throw rule(
            `${it.productCode}: record an inspection result for every line.`,
            "RETURN_INSPECTION",
          );
        }
        const received =
          it.receivedReturnQty === null
            ? num(it.requestedQty)
            : num(it.receivedReturnQty);
        if (
          Math.abs(r.acceptedQuantity + r.rejectedQuantity - received) > 1e-9
        ) {
          throw rule(
            `${it.productCode}: accepted + rejected must equal the ${received} received.`,
            "RETURN_INSPECTION",
          );
        }
        accepted += r.acceptedQuantity;
        rejected += r.rejectedQuantity;
        lines.push({
          itemId: it.id,
          condition: r.condition,
          acceptedQuantity: r.acceptedQuantity,
          rejectedQuantity: r.rejectedQuantity,
        });
        await tx.scmReturnItem.update({
          where: { id: it.id },
          data: {
            condition: r.condition,
            acceptedQty: r.acceptedQuantity,
            rejectedQty: r.rejectedQuantity,
          },
        });
      }
      if (accepted + rejected <= 0) {
        throw rule(
          "Nothing was received on this return to inspect.",
          "RETURN_INSPECTION",
        );
      }
      const result =
        rejected === 0
          ? "ACCEPTED"
          : accepted === 0
            ? "REJECTED"
            : "PARTIALLY_ACCEPTED";
      const conditions = new Set(lines.map((l) => l.condition));
      await tx.scmReturnInspection.create({
        data: {
          organizationId: scope.organizationId,
          returnId: ret.id,
          inspectorId: actorId,
          condition: conditions.size === 1 ? lines[0]!.condition : "UNKNOWN",
          acceptedQty: accepted,
          rejectedQty: rejected,
          result,
          items: lines,
          notes: dto.notes?.trim() || null,
        },
      });
      return this.move(
        tx,
        scope,
        ret,
        "INSPECTED",
        { inspectedBy: actorId, inspectedAt: new Date() },
        actorId,
        `${result} — accepted ${accepted}, rejected ${rejected}`,
      );
    });
  }

  @OrgScoped()
  moveToDisposition(scope: OrgScope, id: number, actorId: number) {
    return this.run(scope, id, (tx, ret) =>
      this.move(tx, scope, ret, "DISPOSITION_PENDING", {}, actorId),
    );
  }

  /** Dispositions `quantity` of one line. RESTOCK posts SALES_RETURN;
   * QUARANTINE/DAMAGED/SCRAP post SALES_RETURN then QUARANTINE/DAMAGE
   * (QUARANTINE also opens a quarantine-register record); REJECT posts
   * nothing. The return is row-locked, so two dispositions of one line can
   * never both pass the cap. */
  @OrgScoped()
  disposition(
    scope: OrgScope,
    id: number,
    dto: DispositionDto,
    actorId: number,
  ) {
    return this.run(scope, id, async (tx, ret) => {
      const org = scope.organizationId;
      this.requireStatus(ret, "DISPOSITION_PENDING");
      if (ret.returnType !== "CUSTOMER_RETURN") {
        throw rule(
          "Dispositions apply to customer returns only.",
          "RETURN_TYPE",
        );
      }
      const item = ret.items.find((i) => i.id === dto.itemId);
      if (!item) throw rule("Return line not found.", "RETURN_ITEM");
      const existing = await tx.scmReturnDisposition.findMany({
        where: { returnItemId: item.id },
      });
      const line = this.toLine(item, existing);
      const error = dispositionError(
        item.productCode,
        line,
        dto.disposition,
        dto.quantity,
      );
      if (error) throw rule(error, "RETURN_DISPOSITION");

      const warehouseId =
        dto.warehouseId ?? item.warehouseId ?? ret.warehouseId;
      const wh = await tx.scmWarehouse.findFirst({
        where: { id: warehouseId, organizationId: org },
      });
      if (!wh)
        throw rule(
          "Select a warehouse for this disposition.",
          "RETURN_WAREHOUSE",
        );
      const locationId = dto.locationId ?? item.locationId ?? null;
      if (locationId) {
        const loc = await tx.scmWarehouseLocation.findFirst({
          where: { id: locationId, organizationId: org, warehouseId },
        });
        if (!loc)
          throw rule(
            "Location does not belong to that warehouse.",
            "RETURN_WAREHOUSE",
          );
      }

      const ledgerIds: number[] = [];
      let quarantineRecordId: number | null = null;
      if (dto.disposition !== "REJECT") {
        const serials = await this.stock.loadAndValidateSerials(
          tx,
          org,
          item.serialNumbers,
          item.productId,
        );
        const batch = item.batchId
          ? await this.stock.loadAndValidateBatch(
              tx,
              org,
              item.batchId,
              item.productId,
            )
          : null;
        const seq =
          existing.filter((d) => d.returnItemId === item.id).length + 1;
        const base = `CUSTOMER_RETURN:${ret.id}:${item.id}:${seq}`;
        const common = {
          organizationId: org,
          productId: item.productId,
          warehouseId,
          locationId,
          batchId: item.batchId,
          referenceType: "CUSTOMER_RETURN",
          referenceId: ret.id,
          referenceNumber: ret.returnNumber,
          unitCost: item.unitCost === null ? null : num(item.unitCost),
          notes: dto.notes ?? null,
          createdBy: actorId,
        };
        // Returned units physically come back, so on-hand (and the batch) go
        // up first whatever the disposition; non-restock dispositions then
        // move them out of sellable stock.
        const inbound = await this.stock.post(tx, {
          ...common,
          transactionType: "SALES_RETURN",
          quantityIn: dto.quantity,
          idempotencyKey: `${base}:in`,
        });
        ledgerIds.push(inbound.id);
        if (dto.disposition === "RESTOCK") {
          await this.stock.setSerialStatuses(
            tx,
            serials.map((s) => s.id),
            "AVAILABLE",
            ret.returnNumber,
            { warehouseId, locationId },
          );
        }
        if (batch) {
          await this.stock.adjustBatchQuantity(tx, org, batch.id, dto.quantity);
        }
        if (dto.disposition !== "RESTOCK") {
          const quarantine = dto.disposition === "QUARANTINE";
          const outbound = await this.stock.post(tx, {
            ...common,
            transactionType: quarantine ? "QUARANTINE" : "DAMAGE",
            quantityOut: dto.quantity,
            idempotencyKey: `${base}:out`,
          });
          ledgerIds.push(outbound.id);
          await this.stock.setSerialStatuses(
            tx,
            serials.map((s) => s.id),
            quarantine ? "QUARANTINED" : "DAMAGED",
            ret.returnNumber,
            { warehouseId },
          );
          if (batch) {
            const fresh = await this.stock.loadAndValidateBatch(
              tx,
              org,
              batch.id,
              item.productId,
            );
            await this.stock.setBatchStatusIfWhole(
              tx,
              fresh,
              dto.quantity,
              quarantine ? "QUARANTINED" : "BLOCKED",
            );
          }
          if (quarantine) {
            const rec = await this.quarantine.createRecord(
              tx,
              org,
              {
                productId: item.productId,
                productCode: item.productCode,
                productName: item.productName,
                batchId: item.batchId,
                batchNumber: item.batchNumber,
                serialNumbers: item.serialNumbers,
                warehouseId,
                locationId,
                quantity: dto.quantity,
                sourceType: "RETURN",
                sourceId: ret.id,
                sourceNumber: ret.returnNumber,
                inspectionId: ret.qualityInspectionId,
                reason: dto.notes || `Customer return ${ret.returnNumber}`,
              },
              actorId,
            );
            quarantineRecordId = rec.id;
          }
        }
      }
      await tx.scmReturnDisposition.create({
        data: {
          organizationId: org,
          returnId: ret.id,
          returnItemId: item.id,
          productId: item.productId,
          disposition: dto.disposition,
          quantity: dto.quantity,
          warehouseId,
          locationId,
          notes: dto.notes?.trim() || null,
          ledgerEntryIds: ledgerIds,
          quarantineRecordId,
          createdBy: actorId,
        },
      });
      await this.audit.write(tx, {
        entityType: "scm_return",
        entityId: ret.id,
        action: "disposition",
        after: {
          product: item.productCode,
          disposition: dto.disposition,
          quantity: dto.quantity,
          posted: ledgerIds.length > 0,
        },
      });
      return tx.scmReturn.findUniqueOrThrow({
        where: { id: ret.id },
        include: listInclude,
      });
    });
  }

  @OrgScoped()
  completeCustomer(scope: OrgScope, id: number, actorId: number) {
    return this.run(scope, id, async (tx, ret) => {
      this.requireStatus(ret, "DISPOSITION_PENDING");
      const all = await tx.scmReturnDisposition.findMany({
        where: { returnId: ret.id },
      });
      const open = ret.items.find(
        (i) => !isFullyDispositioned(this.toLine(i, all)),
      );
      if (open) {
        throw rule(
          `${open.productCode}: every inspected unit must be dispositioned before the return can be completed.`,
          "RETURN_DISPOSITION",
        );
      }
      return this.move(
        tx,
        scope,
        ret,
        "COMPLETED",
        { completedBy: actorId, completedAt: new Date() },
        actorId,
      );
    });
  }

  // ---- vendor return flow -----------------------------------------------------

  @OrgScoped()
  markReadyToShip(scope: OrgScope, id: number, actorId: number) {
    return this.run(scope, id, (tx, ret) =>
      this.move(tx, scope, ret, "READY_TO_SHIP", {}, actorId),
    );
  }

  /** Posts PURCHASE_RETURN per line (stock physically leaves now), then moves
   * to SHIPPED. Every line is validated before anything posts; the whole
   * thing is one transaction, so a failure leaves no half-posted return. */
  @OrgScoped()
  shipVendor(
    scope: OrgScope,
    id: number,
    dto: ShipVendorReturnDto,
    actorId: number,
  ) {
    return this.run(scope, id, async (tx, ret) => {
      const org = scope.organizationId;
      this.requireStatus(ret, "READY_TO_SHIP");
      const prepared: {
        item: (typeof ret.items)[number];
        serials: Awaited<
          ReturnType<StockPostingService["loadAndValidateSerials"]>
        >;
      }[] = [];
      for (const item of ret.items) {
        if (item.postedLedgerEntryId) continue;
        const quantity = num(item.requestedQty);
        if (item.batchId) {
          const batch = await this.stock.loadAndValidateBatch(
            tx,
            org,
            item.batchId,
            item.productId,
          );
          if (quantity > num(batch.quantity)) {
            throw rule(
              `Cannot return ${quantity} of ${item.productCode} — batch ${batch.batchNumber} only has ${num(batch.quantity)} on hand.`,
              "RETURN_STOCK",
            );
          }
        }
        const serials = await this.stock.loadAndValidateSerials(
          tx,
          org,
          item.serialNumbers,
          item.productId,
          ["TRANSFERRED", "SOLD"],
        );
        prepared.push({ item, serials });
      }
      for (const { item, serials } of prepared) {
        const quantity = num(item.requestedQty);
        const posted = await this.stock.post(tx, {
          organizationId: org,
          productId: item.productId,
          warehouseId: item.warehouseId,
          locationId: item.locationId,
          batchId: item.batchId,
          transactionType: "PURCHASE_RETURN",
          referenceType: "VENDOR_RETURN",
          referenceId: ret.id,
          referenceNumber: ret.returnNumber,
          quantityOut: quantity,
          unitCost: item.unitCost === null ? null : num(item.unitCost),
          createdBy: actorId,
          idempotencyKey: `VENDOR_RETURN:${ret.id}:${item.id}`,
        });
        await this.stock.setSerialStatuses(
          tx,
          serials.map((s) => s.id),
          "TRANSFERRED",
          ret.returnNumber,
        );
        if (item.batchId) {
          await this.stock.adjustBatchQuantity(
            tx,
            org,
            item.batchId,
            -quantity,
          );
        }
        await tx.scmReturnItem.update({
          where: { id: item.id },
          data: { postedLedgerEntryId: posted.id, receivedReturnQty: quantity },
        });
      }
      return this.move(
        tx,
        scope,
        ret,
        "SHIPPED",
        {
          shippedBy: actorId,
          shippedAt: new Date(),
          returnShipment: {
            carrier: dto.carrier,
            trackingNumber: dto.trackingNumber,
            notes: dto.notes ?? null,
            shippedDate: new Date().toISOString(),
          },
        },
        actorId,
        `${dto.carrier} — ${dto.trackingNumber}`,
      );
    });
  }

  @OrgScoped()
  markVendorReceived(scope: OrgScope, id: number, actorId: number) {
    return this.run(scope, id, (tx, ret) =>
      this.move(
        tx,
        scope,
        ret,
        "VENDOR_RECEIVED",
        {
          vendorReceivedAt: new Date(),
          returnShipment: {
            ...((ret.returnShipment as object | null) ?? {}),
            receivedDate: new Date().toISOString(),
          } as Prisma.InputJsonValue,
        },
        actorId,
      ),
    );
  }

  @OrgScoped()
  completeVendor(scope: OrgScope, id: number, actorId: number) {
    return this.run(scope, id, (tx, ret) =>
      this.move(
        tx,
        scope,
        ret,
        "COMPLETED",
        { completedBy: actorId, completedAt: new Date() },
        actorId,
      ),
    );
  }

  /** A return that has not moved stock yet (nothing received/shipped and no
   * disposition posted) can be deleted; anything past that has ledger
   * history behind it. */
  @OrgScoped()
  async remove(scope: OrgScope, id: number, actorId: number) {
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.scmReturn.findFirst({
        where: tenantWhere(scope, { id }),
      });
      if (!row) return false;
      if (!DELETABLE_RETURN_STATUSES.includes(row.status)) {
        throw new BusinessRuleViolationException(
          "Cannot delete: this return has already moved stock or completed disposition.",
          "RETURN_ALREADY_PROCESSED",
        );
      }
      await tx.scmReturn.delete({ where: { id } });
      await this.audit.write(tx, {
        entityType: "scm_return",
        entityId: id,
        action: "delete",
        before: {
          returnNumber: row.returnNumber,
          status: row.status,
          by: actorId,
        },
      });
      return true;
    });
  }
}
