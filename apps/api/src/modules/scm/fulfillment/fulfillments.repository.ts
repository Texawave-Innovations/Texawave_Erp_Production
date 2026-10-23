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
import { actorName } from "../common/scm-actor.helpers.js";
import { ScmNumberingService } from "../common/scm-numbering.service.js";
import { StockPostingService } from "../inventory/stock-posting.service.js";
import { round2 } from "../procurement/procurement.helpers.js";
import { computeRemainingByLine } from "../sales/sales.helpers.js";
import {
  CLOSED_REQUISITION_STATUSES,
  IN_PROGRESS_STATUSES,
  issuableByProduct,
  nextProgressStatus,
  PRE_RESERVE_STATUSES,
} from "./fulfillment.helpers.js";

export interface FulfillmentFilter {
  q?: string | undefined;
  status?: string | undefined;
  view?: string | undefined;
  salesOrderId?: number | undefined;
}

const listInclude = {
  items: { orderBy: { lineNo: "asc" } },
  warehouse: { select: { id: true, name: true, code: true } },
  requisitions: { select: { id: true, requisitionNumber: true, status: true } },
} satisfies Prisma.ScmFulfillmentInclude;

const num = (d: Prisma.Decimal | number) => Number(d);

@Injectable()
export class FulfillmentsRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditWriter,
    private readonly numbering: ScmNumberingService,
    private readonly stock: StockPostingService,
  ) {}

  // ---- reads --------------------------------------------------------------

  @OrgScoped()
  async findMany(scope: OrgScope, f: FulfillmentFilter, page: PaginationDto) {
    let ids: number[] | undefined;
    if (f.view === "backorders") {
      const rows = await this.prisma.$queryRaw<{ fulfillment_id: number }[]>`
        SELECT DISTINCT fi.fulfillment_id
        FROM scm.fulfillment_items fi
        JOIN scm.fulfillments f ON f.id = fi.fulfillment_id
        WHERE f.organization_id = ${scope.organizationId} AND fi.ordered_qty > fi.reserved_qty`;
      ids = rows.map((r) => r.fulfillment_id);
    }
    const viewStatuses: Record<string, string[]> = {
      allocation: ["AVAILABLE", "PARTIALLY_AVAILABLE"],
      reserved: [...IN_PROGRESS_STATUSES],
    };
    const where = tenantWhere<Prisma.ScmFulfillmentWhereInput>(scope, {
      ...(f.status ? { status: f.status } : {}),
      ...(f.salesOrderId ? { salesOrderId: f.salesOrderId } : {}),
      ...(f.view && viewStatuses[f.view]
        ? { status: { in: viewStatuses[f.view]! } }
        : {}),
      ...(f.view === "backorders" || f.view === "active"
        ? { status: { notIn: ["CANCELLED", "FULFILLED"] } }
        : {}),
      ...(ids ? { id: { in: ids } } : {}),
      ...(f.q
        ? {
            OR: [
              { fulfillmentNumber: { contains: f.q, mode: "insensitive" } },
              { salesOrderNumber: { contains: f.q, mode: "insensitive" } },
              { customerName: { contains: f.q, mode: "insensitive" } },
            ],
          }
        : {}),
    });
    const [items, total] = await Promise.all([
      this.prisma.scmFulfillment.findMany({
        where,
        skip: page.skip,
        take: page.limit,
        orderBy: { id: "desc" },
        include: listInclude,
      }),
      this.prisma.scmFulfillment.count({ where }),
    ]);
    return { items, total };
  }

  @OrgScoped()
  async findOne(scope: OrgScope, id: number) {
    const f = await this.prisma.scmFulfillment.findFirst({
      where: tenantWhere(scope, { id }),
      include: {
        ...listInclude,
        pickings: { include: { items: true }, orderBy: { id: "asc" } },
        packings: {
          include: { packages: { include: { items: true } } },
          orderBy: { id: "asc" },
        },
        shipments: {
          select: {
            id: true,
            shipmentNumber: true,
            status: true,
            trackingNumber: true,
          },
          orderBy: { id: "asc" },
        },
      },
    });
    if (!f) return null;
    const [reservations, ledger] = await Promise.all([
      this.prisma.scmStockReservation.findMany({
        where: { fulfillmentId: id, organizationId: scope.organizationId },
        orderBy: { id: "asc" },
      }),
      this.prisma.scmStockLedgerEntry.findMany({
        where: tenantWhere(scope, {
          referenceType: "FULFILLMENT",
          referenceId: id,
        }),
        orderBy: { id: "asc" },
      }),
    ]);
    return { ...f, reservations, ledgerEntries: ledger };
  }

  // ---- create -------------------------------------------------------------

  /** Creates a fulfillment covering whatever is still unclaimed on the sales
   * order. The order row is locked and the remainder re-computed from fresh
   * data inside the transaction, so two tabs can never claim the same
   * quantity (legacy used an action-lock node for this). */
  @OrgScoped()
  async create(
    scope: OrgScope,
    input: { salesOrderId: number; warehouseId: number },
    actorId: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM scm.sales_orders WHERE id = ${input.salesOrderId} AND organization_id = ${scope.organizationId} FOR UPDATE`;
      const so = await tx.scmSalesOrder.findFirst({
        where: tenantWhere(scope, { id: input.salesOrderId }),
        include: {
          items: true,
          fulfillments: {
            select: {
              status: true,
              items: {
                select: {
                  salesOrderItemId: true,
                  orderedQty: true,
                  issuedQty: true,
                },
              },
            },
          },
        },
      });
      if (!so) {
        throw new BusinessRuleViolationException(
          "Sales order not found.",
          "SO_NOT_FOUND",
        );
      }
      if (so.status !== "CONFIRMED") {
        throw new BusinessRuleViolationException(
          `Sales order ${so.soNumber} is ${so.status.toLowerCase()} — only confirmed orders can be fulfilled.`,
          "SO_NOT_FULFILLABLE",
        );
      }
      const warehouse = await tx.scmWarehouse.findFirst({
        where: tenantWhere(scope, { id: input.warehouseId, deletedAt: null }),
      });
      if (!warehouse || warehouse.status !== "Active") {
        throw new BusinessRuleViolationException(
          "Select an active warehouse.",
          "WAREHOUSE_INVALID",
        );
      }

      const remaining = computeRemainingByLine(
        so.items.map((i) => ({ id: i.id, salesQty: num(i.salesQty) })),
        so.fulfillments.map((f) => ({
          status: f.status,
          items: f.items.map((i) => ({
            salesOrderItemId: i.salesOrderItemId,
            orderedQty: num(i.orderedQty),
            issuedQty: num(i.issuedQty),
          })),
        })),
      );
      const lines = so.items.filter((i) => (remaining.get(i.id) ?? 0) > 0);
      if (lines.length === 0) {
        throw new BusinessRuleViolationException(
          "This sales order has no remaining quantity to fulfill.",
          "SO_NOTHING_REMAINING",
        );
      }
      const balances = await tx.scmStockBalance.findMany({
        where: {
          warehouseId: warehouse.id,
          productId: { in: lines.map((l) => l.productId) },
        },
      });
      const avail = new Map(
        balances.map((b) => [
          b.productId,
          Math.max(0, num(b.onHand) - num(b.reserved)),
        ]),
      );
      const allAvailable = lines.every(
        (l) => (avail.get(l.productId) ?? 0) >= (remaining.get(l.id) ?? 0),
      );

      const fulfillmentNumber = await this.numbering.next(
        tx,
        scope.organizationId,
        "fulfillment",
      );
      const created = await tx.scmFulfillment.create({
        data: {
          organizationId: scope.organizationId,
          fulfillmentNumber,
          salesOrderId: so.id,
          salesOrderNumber: so.soNumber,
          customerId: so.customerId,
          customerName: so.customerName,
          warehouseId: warehouse.id,
          status: allAvailable ? "AVAILABLE" : "PARTIALLY_AVAILABLE",
          createdBy: actorId,
          updatedBy: actorId,
          items: {
            create: lines.map((l, i) => ({
              lineNo: i + 1,
              salesOrderItemId: l.id,
              productId: l.productId,
              itemCode: l.itemCode,
              itemDescription: l.itemDescription,
              uom: l.uom,
              orderedQty: remaining.get(l.id) ?? 0,
            })),
          },
        },
        include: listInclude,
      });
      await this.audit.write(tx, {
        entityType: "scm_fulfillment",
        entityId: created.id,
        action: "create",
        after: { fulfillmentNumber, salesOrder: so.soNumber },
      });
      return created;
    });
  }

  // ---- shared tx helpers ----------------------------------------------------

  /** Loads and locks a fulfillment for the rest of the transaction. */
  private async lock(
    tx: Prisma.TransactionClient,
    scope: OrgScope,
    id: number,
  ) {
    await tx.$queryRaw`SELECT id FROM scm.fulfillments WHERE id = ${id} AND organization_id = ${scope.organizationId} FOR UPDATE`;
    return tx.scmFulfillment.findFirst({
      where: tenantWhere(scope, { id }),
      include: { items: { orderBy: { lineNo: "asc" } } },
    });
  }

  private async settleReservations(
    tx: Prisma.TransactionClient,
    scope: OrgScope,
    fulfillmentId: number,
    to: "RELEASED" | "FULFILLED",
    actorId: number,
  ) {
    const active = await tx.scmStockReservation.findMany({
      where: {
        fulfillmentId,
        organizationId: scope.organizationId,
        status: "ACTIVE",
      },
    });
    for (const r of active) {
      const claimed = await tx.scmStockReservation.updateMany({
        where: { id: r.id, status: "ACTIVE" },
        data: { status: to, releasedBy: actorId, releasedAt: new Date() },
      });
      if (claimed.count > 0) {
        await this.stock.applyReservationDelta(
          tx,
          scope.organizationId,
          r.productId,
          r.warehouseId,
          -num(r.quantity),
        );
      }
    }
  }

  /** Takes `quantity` of a product out of a fulfillment's reservation
   * (records, line and balance together) so a QC hold/damage posting may use
   * those units without reducing `available` twice. Returns the quantity
   * actually released. Runs inside the caller's transaction. */
  async shrinkReservation(
    tx: Prisma.TransactionClient,
    scope: OrgScope,
    fulfillmentId: number,
    productId: number,
    quantity: number,
    actorId: number,
  ): Promise<number> {
    const reservations = await tx.scmStockReservation.findMany({
      where: {
        organizationId: scope.organizationId,
        fulfillmentId,
        productId,
        status: "ACTIVE",
      },
      orderBy: { id: "asc" },
    });
    let remaining = quantity;
    let released = 0;
    for (const r of reservations) {
      if (remaining <= 0) break;
      const take = Math.min(remaining, num(r.quantity));
      if (take >= num(r.quantity)) {
        await tx.scmStockReservation.update({
          where: { id: r.id },
          data: {
            status: "RELEASED",
            releasedBy: actorId,
            releasedAt: new Date(),
          },
        });
      } else {
        await tx.scmStockReservation.update({
          where: { id: r.id },
          data: { quantity: { decrement: take } },
        });
      }
      await this.stock.applyReservationDelta(
        tx,
        scope.organizationId,
        productId,
        r.warehouseId,
        -take,
      );
      remaining -= take;
      released += take;
    }
    if (released > 0) {
      const item = await tx.scmFulfillmentItem.findFirst({
        where: { fulfillmentId, productId },
      });
      if (item) {
        await tx.scmFulfillmentItem.update({
          where: { id: item.id },
          data: {
            reservedQty: Math.max(
              num(item.issuedQty),
              num(item.reservedQty) - released,
            ),
          },
        });
      }
    }
    return released;
  }

  /** Recomputes an in-progress fulfillment's status from its live pick and
   * pack documents. Called from the pick/pack repositories inside their own
   * transactions, so a cancelled pick/pack can never strand the fulfillment.
   * Never touches a cancelled or fulfilled fulfillment. */
  async syncProgress(tx: Prisma.TransactionClient, fulfillmentId: number) {
    const f = await tx.scmFulfillment.findUnique({
      where: { id: fulfillmentId },
    });
    if (!f || !(IN_PROGRESS_STATUSES as readonly string[]).includes(f.status))
      return;
    const [picks, packs] = await Promise.all([
      tx.scmPicking.findMany({
        where: { fulfillmentId, status: { not: "CANCELLED" } },
        select: { status: true },
      }),
      tx.scmPacking.findMany({
        where: { fulfillmentId, status: { not: "CANCELLED" } },
        select: { status: true },
      }),
    ]);
    const next = nextProgressStatus(picks, packs);
    if (next !== f.status) {
      await tx.scmFulfillment.update({
        where: { id: fulfillmentId },
        data: { status: next },
      });
    }
  }

  // ---- reserve / release ----------------------------------------------------

  /** Reserves whatever is currently available for each line (partial
   * reservation supported). The whole thing is one transaction: if no stock can
   * be reserved, or any line fails, nothing is left half-reserved. */
  @OrgScoped()
  async reserve(scope: OrgScope, id: number, actorId: number) {
    return this.prisma.$transaction(async (tx) => {
      const f = await this.lock(tx, scope, id);
      if (!f) return null;
      if (!(PRE_RESERVE_STATUSES as readonly string[]).includes(f.status)) {
        throw new InvalidStateTransitionException(
          "Fulfillment",
          f.status,
          "RESERVED",
        );
      }
      const existing = await tx.scmStockReservation.count({
        where: { fulfillmentId: id, status: "ACTIVE" },
      });
      if (existing > 0) {
        throw new BusinessRuleViolationException(
          "Stock has already been reserved for this fulfillment.",
          "ALREADY_RESERVED",
        );
      }
      let reservedAny = false;
      for (const item of f.items) {
        const balance = await this.stock.lockBalance(
          tx,
          scope.organizationId,
          item.productId,
          f.warehouseId,
        );
        const available = Math.max(
          0,
          num(balance.onHand) - num(balance.reserved),
        );
        const toReserve = Math.min(num(item.orderedQty), available);
        if (toReserve <= 0) continue;
        await this.stock.applyReservationDelta(
          tx,
          scope.organizationId,
          item.productId,
          f.warehouseId,
          toReserve,
        );
        await tx.scmStockReservation.create({
          data: {
            organizationId: scope.organizationId,
            productId: item.productId,
            warehouseId: f.warehouseId,
            salesOrderId: f.salesOrderId,
            salesOrderNumber: f.salesOrderNumber,
            fulfillmentId: id,
            quantity: toReserve,
            createdBy: actorId,
          },
        });
        await tx.scmFulfillmentItem.update({
          where: { id: item.id },
          data: { reservedQty: toReserve },
        });
        reservedAny = true;
      }
      if (!reservedAny) {
        throw new BusinessRuleViolationException(
          "No stock is currently available to reserve for this fulfillment.",
          "NOTHING_TO_RESERVE",
        );
      }
      await tx.scmFulfillment.update({
        where: { id },
        data: { status: "RESERVED", updatedBy: actorId },
      });
      await this.audit.write(tx, {
        entityType: "scm_fulfillment",
        entityId: id,
        action: "reserve",
        before: { status: f.status },
        after: { status: "RESERVED" },
      });
      return this.findFresh(tx, id);
    });
  }

  /** Releases every active reservation on a reserved fulfillment that has no
   * live pick list, so stock can be reserved again later. */
  @OrgScoped()
  async release(scope: OrgScope, id: number, actorId: number) {
    return this.prisma.$transaction(async (tx) => {
      const f = await this.lock(tx, scope, id);
      if (!f) return null;
      if (f.status !== "RESERVED") {
        throw new InvalidStateTransitionException(
          "Fulfillment",
          f.status,
          "AVAILABLE",
        );
      }
      const issued = await tx.scmStockLedgerEntry.count({
        where: { referenceType: "FULFILLMENT", referenceId: id },
      });
      if (issued > 0) {
        throw new BusinessRuleViolationException(
          "Stock has already been issued for this fulfillment; reservations cannot be released.",
          "ALREADY_ISSUED",
        );
      }
      const livePicks = await tx.scmPicking.count({
        where: { fulfillmentId: id, status: { not: "CANCELLED" } },
      });
      if (livePicks > 0) {
        throw new BusinessRuleViolationException(
          "Cancel the pick list before releasing the reservation.",
          "PICK_EXISTS",
        );
      }
      await this.settleReservations(tx, scope, id, "RELEASED", actorId);
      await tx.scmFulfillmentItem.updateMany({
        where: { fulfillmentId: id },
        data: { reservedQty: 0 },
      });
      const balances = await tx.scmStockBalance.findMany({
        where: {
          warehouseId: f.warehouseId,
          productId: { in: f.items.map((i) => i.productId) },
        },
      });
      const avail = new Map(
        balances.map((b) => [
          b.productId,
          Math.max(0, num(b.onHand) - num(b.reserved)),
        ]),
      );
      const full = f.items.every(
        (i) => (avail.get(i.productId) ?? 0) >= num(i.orderedQty),
      );
      await tx.scmFulfillment.update({
        where: { id },
        data: {
          status: full ? "AVAILABLE" : "PARTIALLY_AVAILABLE",
          updatedBy: actorId,
        },
      });
      await this.audit.write(tx, {
        entityType: "scm_fulfillment",
        entityId: id,
        action: "release",
        before: { status: "RESERVED" },
        after: { status: full ? "AVAILABLE" : "PARTIALLY_AVAILABLE" },
      });
      return this.findFresh(tx, id);
    });
  }

  // ---- pick list ------------------------------------------------------------

  /** The only way a pick list is created. The RESERVED -> PICKING gate runs
   * under the fulfillment lock, so a double click can never create two. */
  @OrgScoped()
  async createPick(scope: OrgScope, id: number, actorId: number) {
    return this.prisma.$transaction(async (tx) => {
      const f = await this.lock(tx, scope, id);
      if (!f) return null;
      if (f.status !== "RESERVED") {
        throw new InvalidStateTransitionException(
          "Fulfillment",
          f.status,
          "PICKING",
        );
      }
      const items = f.items.filter((i) => num(i.reservedQty) > 0);
      if (items.length === 0) {
        throw new BusinessRuleViolationException(
          "Nothing reserved to pick.",
          "NOTHING_RESERVED",
        );
      }
      const products = await tx.scmProduct.findMany({
        where: { id: { in: items.map((i) => i.productId) } },
        select: { id: true, productCode: true, name: true },
      });
      const byId = new Map(products.map((p) => [p.id, p]));
      const pickNumber = await this.numbering.next(
        tx,
        scope.organizationId,
        "pick",
      );
      const pick = await tx.scmPicking.create({
        data: {
          organizationId: scope.organizationId,
          pickNumber,
          salesOrderId: f.salesOrderId,
          salesOrderNumber: f.salesOrderNumber,
          fulfillmentId: id,
          warehouseId: f.warehouseId,
          createdBy: actorId,
          updatedBy: actorId,
          items: {
            create: items.map((i) => ({
              productId: i.productId,
              productCode: byId.get(i.productId)?.productCode ?? i.itemCode,
              productName: byId.get(i.productId)?.name ?? i.itemDescription,
              requestedQuantity: i.reservedQty,
              serialNumbers: [],
            })),
          },
        },
      });
      await tx.scmFulfillment.update({
        where: { id },
        data: { status: "PICKING", updatedBy: actorId },
      });
      await this.audit.write(tx, {
        entityType: "scm_picking",
        entityId: pick.id,
        action: "create",
        after: { pickNumber, fulfillment: f.fulfillmentNumber },
      });
      await this.audit.write(tx, {
        entityType: "scm_fulfillment",
        entityId: id,
        action: "pick_created",
        after: { pickNumber },
      });
      return this.findFresh(tx, id);
    });
  }

  // ---- shortage requisition -------------------------------------------------

  @OrgScoped()
  async createShortageRequisition(
    scope: OrgScope,
    id: number,
    actorId: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const f = await this.lock(tx, scope, id);
      if (!f) return null;
      if (f.status === "CANCELLED" || f.status === "FULFILLED") {
        throw new BusinessRuleViolationException(
          "This fulfillment is closed.",
          "FULFILLMENT_CLOSED",
        );
      }
      const open = await tx.scmPurchaseRequisition.findFirst({
        where: {
          fulfillmentId: id,
          status: { notIn: [...CLOSED_REQUISITION_STATUSES] },
        },
        select: { requisitionNumber: true },
      });
      if (open) {
        throw new BusinessRuleViolationException(
          `Requisition ${open.requisitionNumber} already covers this shortage.`,
          "SHORTAGE_COVERED",
        );
      }
      const short = f.items.filter(
        (i) => num(i.orderedQty) - num(i.reservedQty) > 0,
      );
      if (short.length === 0) {
        throw new BusinessRuleViolationException(
          "No shortage to raise a requisition for.",
          "NO_SHORTAGE",
        );
      }
      const products = await tx.scmProduct.findMany({
        where: { id: { in: short.map((i) => i.productId) } },
      });
      const byId = new Map(products.map((p) => [p.id, p]));
      const lines = short.map((i, idx) => {
        const qty = num(i.orderedQty) - num(i.reservedQty);
        const cost = num(byId.get(i.productId)?.costPrice ?? 0);
        return {
          lineNo: idx + 1,
          productId: i.productId,
          productNameSnapshot: i.itemDescription,
          uom: i.uom,
          quantity: qty,
          estimatedUnitCost: cost,
          estimatedTotal: round2(qty * cost),
        };
      });
      const subtotal = round2(lines.reduce((s, l) => s + l.estimatedTotal, 0));
      const requisitionNumber = await this.numbering.next(
        tx,
        scope.organizationId,
        "purchaseRequisition",
      );
      const req = await tx.scmPurchaseRequisition.create({
        data: {
          organizationId: scope.organizationId,
          requisitionNumber,
          requestedBy: actorId,
          requestedByName: await actorName(tx, scope.organizationId, actorId),
          requestDate: new Date(),
          priority: "Normal",
          warehouseId: f.warehouseId,
          purpose: `Shortage cover for sales order ${f.salesOrderNumber}`,
          subtotal,
          tax: 0,
          total: subtotal,
          status: "DRAFT",
          sourceSalesOrderId: f.salesOrderId,
          sourceSalesOrderNumber: f.salesOrderNumber,
          fulfillmentId: id,
          createdBy: actorId,
          updatedBy: actorId,
          items: { create: lines },
        },
      });
      await this.audit.write(tx, {
        entityType: "scm_fulfillment",
        entityId: id,
        action: "shortage_requisition",
        after: { requisitionNumber },
      });
      return { id: req.id, requisitionNumber };
    });
  }

  // ---- finalize (the only SALES_ISSUE) ---------------------------------------

  /** The one place a fulfillment reduces on-hand stock. Issues what was both
   * picked and packed (never more than reserved) as one SALES_ISSUE per line,
   * then settles the reservations and marks the fulfillment FULFILLED — all in
   * one transaction, so there is no "posted half the lines" state. */
  @OrgScoped()
  async finalize(scope: OrgScope, id: number, actorId: number) {
    return this.prisma.$transaction(async (tx) => {
      const f = await this.lock(tx, scope, id);
      if (!f) return null;
      if (f.status === "FULFILLED") return this.findFresh(tx, id);
      if (!(IN_PROGRESS_STATUSES as readonly string[]).includes(f.status)) {
        throw new BusinessRuleViolationException(
          `Cannot finalize a fulfillment in status ${f.status}.`,
          "FULFILLMENT_STATE",
        );
      }
      const activeRes = await tx.scmStockReservation.count({
        where: { fulfillmentId: id, status: "ACTIVE" },
      });
      if (activeRes === 0) {
        throw new BusinessRuleViolationException(
          "Nothing has been reserved for this fulfillment yet.",
          "NOTHING_RESERVED",
        );
      }
      const [picks, packs] = await Promise.all([
        tx.scmPicking.findMany({
          where: { fulfillmentId: id, status: { not: "CANCELLED" } },
          include: { items: true },
        }),
        tx.scmPacking.findMany({
          where: { fulfillmentId: id, status: { not: "CANCELLED" } },
          include: { packages: { include: { items: true } } },
        }),
      ]);
      if (picks.length === 0 || picks.some((p) => p.status !== "COMPLETED")) {
        throw new BusinessRuleViolationException(
          "Every pick list must be completed first.",
          "PICK_INCOMPLETE",
        );
      }
      if (packs.length === 0 || packs.some((p) => p.status !== "PACKED")) {
        throw new BusinessRuleViolationException(
          "Every packing must be packed first.",
          "PACK_INCOMPLETE",
        );
      }

      const issuable = issuableByProduct(
        picks.map((p) => ({
          items: p.items.map((i) => ({
            productId: i.productId,
            pickedQuantity: num(i.pickedQuantity),
          })),
        })),
        packs.map((p) => ({
          packages: p.packages.map((pkg) => ({
            items: pkg.items.map((i) => ({
              productId: i.productId,
              quantity: num(i.quantity),
            })),
          })),
        })),
      );
      const products = await tx.scmProduct.findMany({
        where: { id: { in: f.items.map((i) => i.productId) } },
        select: { id: true, costPrice: true },
      });
      const cost = new Map(products.map((p) => [p.id, num(p.costPrice)]));

      let posted = 0;
      for (const item of f.items) {
        const left = issuable.get(item.productId) ?? 0;
        const issueQty = Math.min(num(item.reservedQty), left);
        issuable.set(item.productId, left - issueQty);
        if (issueQty <= 0) {
          await tx.scmFulfillmentItem.update({
            where: { id: item.id },
            data: { issuedQty: 0 },
          });
          continue;
        }
        await this.stock.post(tx, {
          organizationId: scope.organizationId,
          productId: item.productId,
          warehouseId: f.warehouseId,
          transactionType: "SALES_ISSUE",
          referenceType: "FULFILLMENT",
          referenceId: id,
          referenceNumber: f.fulfillmentNumber,
          quantityOut: issueQty,
          unitCost: cost.get(item.productId) ?? null,
          createdBy: actorId,
          idempotencyKey: `FULFILLMENT_ISSUE:${id}:${item.id}`,
        });
        await tx.scmFulfillmentItem.update({
          where: { id: item.id },
          data: { issuedQty: issueQty },
        });
        posted += 1;
      }
      if (posted === 0) {
        throw new BusinessRuleViolationException(
          "Nothing was picked and packed to issue.",
          "NOTHING_TO_ISSUE",
        );
      }
      await this.settleReservations(tx, scope, id, "FULFILLED", actorId);
      await tx.scmFulfillment.update({
        where: { id },
        data: {
          status: "FULFILLED",
          deliveryStatus: "NOT_DELIVERED",
          updatedBy: actorId,
        },
      });
      await tx.scmPicking.updateMany({
        where: { fulfillmentId: id, status: { not: "CANCELLED" } },
        data: { stockIssuedAt: new Date() },
      });
      await this.audit.write(tx, {
        entityType: "scm_fulfillment",
        entityId: id,
        action: "issue",
        before: { status: f.status },
        after: { status: "FULFILLED", lines: posted },
      });
      return this.findFresh(tx, id);
    });
  }

  // ---- cancel -----------------------------------------------------------------

  /** Cancels a fulfillment before stock is issued: cancels its open pick lists
   * and packings and releases its reservations. Refused while a pick or pack
   * is actively being worked. */
  @OrgScoped()
  async cancel(scope: OrgScope, id: number, reason: string, actorId: number) {
    return this.prisma.$transaction(async (tx) => {
      const f = await this.lock(tx, scope, id);
      if (!f) return null;
      const issued = await tx.scmStockLedgerEntry.count({
        where: { referenceType: "FULFILLMENT", referenceId: id },
      });
      if (f.status === "FULFILLED" || issued > 0) {
        throw new BusinessRuleViolationException(
          "Stock has already been issued for this fulfillment. Cancellation after issue requires a returns/reversal workflow.",
          "ALREADY_ISSUED",
        );
      }
      if (f.status === "CANCELLED") return this.findFresh(tx, id);
      const [picks, packs] = await Promise.all([
        tx.scmPicking.findMany({
          where: { fulfillmentId: id, status: { not: "CANCELLED" } },
        }),
        tx.scmPacking.findMany({
          where: { fulfillmentId: id, status: { not: "CANCELLED" } },
        }),
      ]);
      if (
        picks.some(
          (p) => p.status === "IN_PROGRESS" || p.status === "PARTIALLY_PICKED",
        ) ||
        packs.some((p) => p.status === "IN_PROGRESS")
      ) {
        throw new BusinessRuleViolationException(
          "Picking or packing is in progress — finish or cancel it in the warehouse workspace first.",
          "WORK_IN_PROGRESS",
        );
      }
      await tx.scmPicking.updateMany({
        where: { fulfillmentId: id, status: { not: "CANCELLED" } },
        data: { status: "CANCELLED" },
      });
      await tx.scmPacking.updateMany({
        where: { fulfillmentId: id, status: { not: "CANCELLED" } },
        data: { status: "CANCELLED" },
      });
      await this.settleReservations(tx, scope, id, "RELEASED", actorId);
      await tx.scmFulfillmentItem.updateMany({
        where: { fulfillmentId: id },
        data: { reservedQty: 0 },
      });
      await tx.scmFulfillment.update({
        where: { id },
        data: {
          status: "CANCELLED",
          cancelledBy: actorId,
          cancelledAt: new Date(),
          cancellationReason: reason,
          updatedBy: actorId,
        },
      });
      await this.audit.write(tx, {
        entityType: "scm_fulfillment",
        entityId: id,
        action: "cancel",
        before: { status: f.status },
        after: { status: "CANCELLED", reason },
      });
      return this.findFresh(tx, id);
    });
  }

  private findFresh(tx: Prisma.TransactionClient, id: number) {
    return tx.scmFulfillment.findUniqueOrThrow({
      where: { id },
      include: listInclude,
    });
  }
}
