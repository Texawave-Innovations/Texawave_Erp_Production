import { Injectable } from "@nestjs/common";
import { Prisma } from "@texawave-erp/database";
import { OrgScoped } from "../../../common/decorators/org-scoped.decorator.js";
import type { PaginationDto } from "../../../common/dto/pagination.dto.js";
import {
  BusinessRuleViolationException,
  InvalidStateTransitionException,
  ResourceConflictException,
} from "../../../common/exceptions/business.exception.js";
import type { OrgScope } from "../../../common/tenancy/org-scope.js";
import { tenantWhere } from "../../../common/tenancy/tenant-where.js";
import { AuditWriter } from "../../../platform/audit/audit-writer.js";
import { PrismaService } from "../../../shared/prisma/prisma.service.js";
import { ScmNumberingService } from "../common/scm-numbering.service.js";
import type {
  CreateAdjustmentDto,
  CreateBatchDto,
  CreateReservationDto,
  CreateSerialsDto,
  CreateTransferDto,
  OpeningBalanceDto,
} from "./dto/inventory.dto.js";
import { buildInventoryRow, type InventoryRow } from "./inventory.helpers.js";
import { StockPostingService } from "./stock-posting.service.js";

export interface OverviewFilter {
  q?: string | undefined;
  warehouseId?: number | undefined;
}

export interface LedgerFilter {
  q?: string | undefined;
  productId?: number | undefined;
  warehouseId?: number | undefined;
  transactionType?: string | undefined;
  from?: string | undefined;
  to?: string | undefined;
}

export interface DocFilter {
  status?: string | undefined;
  productId?: number | undefined;
  warehouseId?: number | undefined;
  q?: string | undefined;
  expiringSoon?: boolean | undefined;
}

const productSelect = {
  id: true,
  productCode: true,
  name: true,
  uom: true,
} as const;

/** Owns every inventory table. Each stock-affecting action runs in one
 * database transaction that also locks the balance row, so the status move,
 * the ledger entry and the balance change commit or roll back together —
 * replacing legacy's claim nodes, action locks and compensating rollbacks. */
@Injectable()
export class InventoryRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditWriter,
    private readonly stock: StockPostingService,
    private readonly numbering: ScmNumberingService,
  ) {}

  // ---- overview / ledger --------------------------------------------------

  /** One row per active product per warehouse, zero rows included, so every
   * SKU is visible before it has any ledger history (legacy behaviour). */
  @OrgScoped()
  async overviewRows(
    scope: OrgScope,
    f: OverviewFilter,
  ): Promise<InventoryRow[]> {
    const productWhere = tenantWhere<Prisma.ScmProductWhereInput>(scope, {
      deletedAt: null,
      isActive: true,
      ...(f.q
        ? {
            OR: [
              { productCode: { contains: f.q, mode: "insensitive" } },
              { name: { contains: f.q, mode: "insensitive" } },
              { category: { contains: f.q, mode: "insensitive" } },
            ],
          }
        : {}),
    });
    const [products, warehouses, balances] = await Promise.all([
      this.prisma.scmProduct.findMany({
        where: productWhere,
        orderBy: { name: "asc" },
      }),
      this.prisma.scmWarehouse.findMany({
        where: tenantWhere<Prisma.ScmWarehouseWhereInput>(scope, {
          deletedAt: null,
          status: "Active",
          ...(f.warehouseId ? { id: f.warehouseId } : {}),
        }),
        orderBy: { name: "asc" },
      }),
      this.prisma.scmStockBalance.findMany({
        where: tenantWhere<Prisma.ScmStockBalanceWhereInput>(scope, {
          ...(f.warehouseId ? { warehouseId: f.warehouseId } : {}),
        }),
      }),
    ]);
    const byKey = new Map(
      balances.map((b) => [`${b.productId}-${b.warehouseId}`, b]),
    );
    const rows: InventoryRow[] = [];
    for (const p of products) {
      for (const w of warehouses) {
        rows.push(buildInventoryRow(p, w, byKey.get(`${p.id}-${w.id}`)));
      }
    }
    return rows;
  }

  @OrgScoped()
  async productDetail(scope: OrgScope, productId: number) {
    const product = await this.prisma.scmProduct.findFirst({
      where: tenantWhere(scope, { id: productId, deletedAt: null }),
    });
    if (!product) return null;
    const [warehouses, balances, ledger, batches, serialGroups] =
      await Promise.all([
        this.prisma.scmWarehouse.findMany({
          where: tenantWhere(scope, { deletedAt: null }),
          orderBy: { name: "asc" },
        }),
        this.prisma.scmStockBalance.findMany({
          where: tenantWhere(scope, { productId }),
        }),
        this.prisma.scmStockLedgerEntry.findMany({
          where: tenantWhere(scope, { productId }),
          orderBy: { id: "desc" },
          take: 50,
          include: { warehouse: { select: { name: true } } },
        }),
        this.prisma.scmStockBatch.findMany({
          where: tenantWhere(scope, { productId }),
          orderBy: { createdAt: "desc" },
        }),
        this.prisma.scmSerialNumber.groupBy({
          by: ["status"],
          where: tenantWhere(scope, { productId }),
          _count: { _all: true },
        }),
      ]);
    const byWh = new Map(balances.map((b) => [b.warehouseId, b]));
    return {
      product,
      rows: warehouses.map((w) =>
        buildInventoryRow(product, w, byWh.get(w.id)),
      ),
      ledger: ledger.map((l) => ({
        ...l,
        warehouseName: l.warehouse.name,
        warehouse: undefined,
      })),
      batches,
      serialCounts: Object.fromEntries(
        serialGroups.map((g) => [g.status, g._count._all]),
      ),
    };
  }

  @OrgScoped()
  async findLedger(scope: OrgScope, f: LedgerFilter, page: PaginationDto) {
    const where = tenantWhere<Prisma.ScmStockLedgerEntryWhereInput>(scope, {
      ...(f.productId ? { productId: f.productId } : {}),
      ...(f.warehouseId ? { warehouseId: f.warehouseId } : {}),
      ...(f.transactionType ? { transactionType: f.transactionType } : {}),
      ...(f.from || f.to
        ? {
            transactionDate: {
              ...(f.from ? { gte: new Date(f.from) } : {}),
              ...(f.to ? { lte: new Date(f.to) } : {}),
            },
          }
        : {}),
      ...(f.q
        ? {
            OR: [
              { referenceNumber: { contains: f.q, mode: "insensitive" } },
              { notes: { contains: f.q, mode: "insensitive" } },
              {
                product: {
                  productCode: { contains: f.q, mode: "insensitive" },
                },
              },
              { product: { name: { contains: f.q, mode: "insensitive" } } },
            ],
          }
        : {}),
    });
    const [rows, total] = await Promise.all([
      this.prisma.scmStockLedgerEntry.findMany({
        where,
        skip: page.skip,
        take: page.limit,
        orderBy: { id: "desc" },
        include: {
          product: { select: productSelect },
          warehouse: { select: { id: true, name: true } },
        },
      }),
      this.prisma.scmStockLedgerEntry.count({ where }),
    ]);
    return { items: rows, total };
  }

  // ---- shared guards ------------------------------------------------------

  private async requireProduct(
    tx: Prisma.TransactionClient,
    scope: OrgScope,
    productId: number,
  ) {
    const product = await tx.scmProduct.findFirst({
      where: tenantWhere(scope, { id: productId, deletedAt: null }),
    });
    if (!product) {
      throw new BusinessRuleViolationException(
        "Product not found.",
        "PRODUCT_NOT_FOUND",
      );
    }
    return product;
  }

  private async requireWarehouse(
    tx: Prisma.TransactionClient,
    scope: OrgScope,
    warehouseId: number,
  ) {
    const warehouse = await tx.scmWarehouse.findFirst({
      where: tenantWhere(scope, { id: warehouseId, deletedAt: null }),
    });
    if (!warehouse) {
      throw new BusinessRuleViolationException(
        "Warehouse not found.",
        "WAREHOUSE_NOT_FOUND",
      );
    }
    return warehouse;
  }

  // ---- opening balance ----------------------------------------------------

  @OrgScoped()
  async postOpeningBalance(
    scope: OrgScope,
    dto: OpeningBalanceDto,
    actorId: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const product = await this.requireProduct(tx, scope, dto.productId);
      await this.requireWarehouse(tx, scope, dto.warehouseId);
      const entry = await this.stock.post(tx, {
        organizationId: scope.organizationId,
        productId: product.id,
        warehouseId: dto.warehouseId,
        transactionType: "OPENING_BALANCE",
        referenceType: "OPENING_BALANCE",
        quantityIn: dto.quantity,
        unitCost: dto.unitCost,
        notes: dto.notes,
        createdBy: actorId,
      });
      await this.audit.write(tx, {
        entityType: "scm_stock_ledger",
        entityId: entry.id,
        action: "opening_balance",
        after: {
          productCode: product.productCode,
          warehouseId: dto.warehouseId,
          quantity: dto.quantity,
        },
      });
      return entry;
    });
  }

  // ---- reservations -------------------------------------------------------

  @OrgScoped()
  async findReservations(scope: OrgScope, f: DocFilter, page: PaginationDto) {
    const where = tenantWhere<Prisma.ScmStockReservationWhereInput>(scope, {
      ...(f.status ? { status: f.status } : {}),
      ...(f.productId ? { productId: f.productId } : {}),
      ...(f.warehouseId ? { warehouseId: f.warehouseId } : {}),
    });
    const [items, total] = await Promise.all([
      this.prisma.scmStockReservation.findMany({
        where,
        skip: page.skip,
        take: page.limit,
        orderBy: { createdAt: "desc" },
        include: {
          product: { select: productSelect },
          warehouse: { select: { id: true, name: true } },
        },
      }),
      this.prisma.scmStockReservation.count({ where }),
    ]);
    return { items, total };
  }

  @OrgScoped()
  async createReservation(
    scope: OrgScope,
    dto: CreateReservationDto,
    actorId: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await this.requireProduct(tx, scope, dto.productId);
      await this.requireWarehouse(tx, scope, dto.warehouseId);
      await this.stock.applyReservationDelta(
        tx,
        scope.organizationId,
        dto.productId,
        dto.warehouseId,
        dto.quantity,
      );
      const created = await tx.scmStockReservation.create({
        data: {
          organizationId: scope.organizationId,
          productId: dto.productId,
          warehouseId: dto.warehouseId,
          salesOrderId: dto.salesOrderId ?? null,
          quantity: dto.quantity,
          notes: dto.notes?.trim() || null,
          createdBy: actorId,
        },
      });
      await this.audit.write(tx, {
        entityType: "scm_stock_reservation",
        entityId: created.id,
        action: "create",
        after: { quantity: dto.quantity, productId: dto.productId },
      });
      return created;
    });
  }

  @OrgScoped()
  async releaseReservation(
    scope: OrgScope,
    id: number,
    status: "RELEASED" | "CANCELLED",
    actorId: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const res = await tx.scmStockReservation.findFirst({
        where: tenantWhere(scope, { id }),
      });
      if (!res) return null;
      if (res.status !== "ACTIVE") {
        throw new InvalidStateTransitionException(
          "Reservation",
          res.status,
          status,
        );
      }
      const claimed = await tx.scmStockReservation.updateMany({
        where: { id, organizationId: scope.organizationId, status: "ACTIVE" },
        data: { status, releasedBy: actorId, releasedAt: new Date() },
      });
      if (claimed.count === 0) {
        throw new InvalidStateTransitionException(
          "Reservation",
          "changed",
          status,
        );
      }
      await this.stock.applyReservationDelta(
        tx,
        scope.organizationId,
        res.productId,
        res.warehouseId,
        -Number(res.quantity),
      );
      await this.audit.write(tx, {
        entityType: "scm_stock_reservation",
        entityId: id,
        action: status.toLowerCase(),
        before: { status: "ACTIVE" },
        after: { status },
      });
      return tx.scmStockReservation.findUniqueOrThrow({ where: { id } });
    });
  }

  // ---- transfers ----------------------------------------------------------

  @OrgScoped()
  async findTransfers(scope: OrgScope, f: DocFilter, page: PaginationDto) {
    const where = tenantWhere<Prisma.ScmStockTransferWhereInput>(scope, {
      ...(f.status ? { status: f.status } : {}),
      ...(f.productId ? { productId: f.productId } : {}),
      ...(f.q
        ? { transferNumber: { contains: f.q, mode: "insensitive" } }
        : {}),
    });
    const [items, total] = await Promise.all([
      this.prisma.scmStockTransfer.findMany({
        where,
        skip: page.skip,
        take: page.limit,
        orderBy: { createdAt: "desc" },
        include: {
          product: { select: productSelect },
          sourceWarehouse: { select: { id: true, name: true } },
          destinationWarehouse: { select: { id: true, name: true } },
        },
      }),
      this.prisma.scmStockTransfer.count({ where }),
    ]);
    return { items, total };
  }

  @OrgScoped()
  async createTransfer(
    scope: OrgScope,
    dto: CreateTransferDto,
    actorId: number,
  ) {
    if (dto.sourceWarehouseId === dto.destinationWarehouseId) {
      throw new BusinessRuleViolationException(
        "Source and destination warehouse must differ",
        "TRANSFER_SAME_WAREHOUSE",
      );
    }
    return this.prisma.$transaction(async (tx) => {
      const product = await this.requireProduct(tx, scope, dto.productId);
      await this.requireWarehouse(tx, scope, dto.sourceWarehouseId);
      await this.requireWarehouse(tx, scope, dto.destinationWarehouseId);
      // UX hint only — the authoritative check runs when the transfer is dispatched.
      const bal = await tx.scmStockBalance.findUnique({
        where: {
          productId_warehouseId: {
            productId: dto.productId,
            warehouseId: dto.sourceWarehouseId,
          },
        },
      });
      const available = bal ? Number(bal.onHand) - Number(bal.reserved) : 0;
      if (dto.quantity > available) {
        throw new BusinessRuleViolationException(
          `Only ${available} available at source warehouse`,
          "INSUFFICIENT_STOCK",
        );
      }
      const transferNumber = await this.numbering.next(
        tx,
        scope.organizationId,
        "stockTransfer",
      );
      const created = await tx.scmStockTransfer.create({
        data: {
          organizationId: scope.organizationId,
          transferNumber,
          productId: product.id,
          sourceWarehouseId: dto.sourceWarehouseId,
          sourceLocationId: dto.sourceLocationId ?? null,
          destinationWarehouseId: dto.destinationWarehouseId,
          destinationLocationId: dto.destinationLocationId ?? null,
          quantity: dto.quantity,
          status: "REQUESTED",
          notes: dto.notes?.trim() || null,
          requestedBy: actorId,
        },
      });
      await this.audit.write(tx, {
        entityType: "scm_stock_transfer",
        entityId: created.id,
        action: "create",
        after: { transferNumber, quantity: dto.quantity },
      });
      return created;
    });
  }

  @OrgScoped()
  async transitionTransfer(
    scope: OrgScope,
    id: number,
    action: "approve" | "dispatch" | "receive" | "cancel",
    actorId: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const t = await tx.scmStockTransfer.findFirst({
        where: tenantWhere(scope, { id }),
      });
      if (!t) return null;
      const rule = {
        approve: { from: ["REQUESTED"], to: "APPROVED" },
        dispatch: { from: ["APPROVED"], to: "IN_TRANSIT" },
        receive: { from: ["IN_TRANSIT"], to: "RECEIVED" },
        cancel: { from: ["DRAFT", "REQUESTED", "APPROVED"], to: "CANCELLED" },
      }[action];
      if (!rule.from.includes(t.status)) {
        throw new InvalidStateTransitionException(
          "Transfer",
          t.status,
          rule.to,
        );
      }
      const now = new Date();
      const data: Prisma.ScmStockTransferUncheckedUpdateManyInput = {
        status: rule.to,
        ...(action === "approve"
          ? { approvedBy: actorId, approvedAt: now }
          : {}),
        ...(action === "dispatch"
          ? { dispatchedBy: actorId, dispatchedAt: now }
          : {}),
        ...(action === "receive"
          ? { receivedBy: actorId, receivedAt: now }
          : {}),
      };
      const claimed = await tx.scmStockTransfer.updateMany({
        where: {
          id,
          organizationId: scope.organizationId,
          status: { in: rule.from },
        },
        data,
      });
      if (claimed.count === 0) {
        throw new InvalidStateTransitionException(
          "Transfer",
          "changed",
          rule.to,
        );
      }
      if (action === "dispatch") {
        // The ledger guard is the authoritative availability check.
        await this.stock.post(tx, {
          organizationId: scope.organizationId,
          productId: t.productId,
          warehouseId: t.sourceWarehouseId,
          locationId: t.sourceLocationId,
          transactionType: "TRANSFER_OUT",
          referenceType: "TRANSFER",
          referenceId: t.id,
          referenceNumber: t.transferNumber,
          quantityOut: Number(t.quantity),
          createdBy: actorId,
          idempotencyKey: `TRANSFER_OUT:${t.id}`,
        });
      }
      if (action === "receive") {
        await this.stock.post(tx, {
          organizationId: scope.organizationId,
          productId: t.productId,
          warehouseId: t.destinationWarehouseId,
          locationId: t.destinationLocationId,
          transactionType: "TRANSFER_IN",
          referenceType: "TRANSFER",
          referenceId: t.id,
          referenceNumber: t.transferNumber,
          quantityIn: Number(t.quantity),
          createdBy: actorId,
          idempotencyKey: `TRANSFER_IN:${t.id}`,
        });
      }
      await this.audit.write(tx, {
        entityType: "scm_stock_transfer",
        entityId: id,
        action: action === "cancel" ? "cancel" : action,
        before: { status: t.status },
        after: { status: rule.to },
      });
      return tx.scmStockTransfer.findUniqueOrThrow({ where: { id } });
    });
  }

  // ---- adjustments --------------------------------------------------------

  @OrgScoped()
  async findAdjustments(scope: OrgScope, f: DocFilter, page: PaginationDto) {
    const where = tenantWhere<Prisma.ScmStockAdjustmentWhereInput>(scope, {
      ...(f.status ? { status: f.status } : {}),
      ...(f.productId ? { productId: f.productId } : {}),
      ...(f.warehouseId ? { warehouseId: f.warehouseId } : {}),
      ...(f.q
        ? { adjustmentNumber: { contains: f.q, mode: "insensitive" } }
        : {}),
    });
    const [items, total] = await Promise.all([
      this.prisma.scmStockAdjustment.findMany({
        where,
        skip: page.skip,
        take: page.limit,
        orderBy: { createdAt: "desc" },
        include: {
          product: { select: productSelect },
          warehouse: { select: { id: true, name: true } },
        },
      }),
      this.prisma.scmStockAdjustment.count({ where }),
    ]);
    return { items, total };
  }

  @OrgScoped()
  async createAdjustment(
    scope: OrgScope,
    dto: CreateAdjustmentDto,
    actorId: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const product = await this.requireProduct(tx, scope, dto.productId);
      await this.requireWarehouse(tx, scope, dto.warehouseId);
      const adjustmentNumber = await this.numbering.next(
        tx,
        scope.organizationId,
        "stockAdjustment",
      );
      const created = await tx.scmStockAdjustment.create({
        data: {
          organizationId: scope.organizationId,
          adjustmentNumber,
          productId: product.id,
          warehouseId: dto.warehouseId,
          locationId: dto.locationId ?? null,
          quantity: dto.quantity,
          direction: dto.direction,
          reason: dto.reason,
          notes: dto.notes?.trim() || null,
          requestedBy: actorId,
        },
      });
      await this.audit.write(tx, {
        entityType: "scm_stock_adjustment",
        entityId: created.id,
        action: "create",
        after: {
          adjustmentNumber,
          direction: dto.direction,
          quantity: dto.quantity,
          reason: dto.reason,
        },
      });
      return created;
    });
  }

  @OrgScoped()
  async decideAdjustment(
    scope: OrgScope,
    id: number,
    decision: "APPROVED" | "REJECTED",
    actorId: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const a = await tx.scmStockAdjustment.findFirst({
        where: tenantWhere(scope, { id }),
      });
      if (!a) return null;
      if (a.status !== "PENDING") {
        throw new InvalidStateTransitionException(
          "Adjustment",
          a.status,
          decision,
        );
      }
      const claimed = await tx.scmStockAdjustment.updateMany({
        where: { id, organizationId: scope.organizationId, status: "PENDING" },
        data: {
          status: decision,
          ...(decision === "APPROVED"
            ? { approvedBy: actorId, approvedAt: new Date() }
            : {}),
        },
      });
      if (claimed.count === 0) {
        throw new InvalidStateTransitionException(
          "Adjustment",
          "changed",
          decision,
        );
      }
      if (decision === "APPROVED") {
        const isIn = a.direction === "IN";
        await this.stock.post(tx, {
          organizationId: scope.organizationId,
          productId: a.productId,
          warehouseId: a.warehouseId,
          locationId: a.locationId,
          transactionType: isIn ? "ADJUSTMENT_IN" : "ADJUSTMENT_OUT",
          referenceType: "ADJUSTMENT",
          referenceId: a.id,
          referenceNumber: a.adjustmentNumber,
          quantityIn: isIn ? Number(a.quantity) : undefined,
          quantityOut: isIn ? undefined : Number(a.quantity),
          notes: a.reason,
          createdBy: actorId,
          idempotencyKey: `ADJUSTMENT:${a.id}`,
        });
      }
      await this.audit.write(tx, {
        entityType: "scm_stock_adjustment",
        entityId: id,
        action: decision === "APPROVED" ? "approve" : "reject",
        before: { status: "PENDING" },
        after: { status: decision },
      });
      return tx.scmStockAdjustment.findUniqueOrThrow({ where: { id } });
    });
  }

  // ---- batches ------------------------------------------------------------

  @OrgScoped()
  async findBatches(scope: OrgScope, f: DocFilter, page: PaginationDto) {
    const soon = new Date();
    soon.setDate(soon.getDate() + 30);
    const where = tenantWhere<Prisma.ScmStockBatchWhereInput>(scope, {
      ...(f.status ? { status: f.status } : {}),
      ...(f.productId ? { productId: f.productId } : {}),
      ...(f.warehouseId ? { warehouseId: f.warehouseId } : {}),
      ...(f.expiringSoon ? { expiryDate: { lte: soon } } : {}),
      ...(f.q ? { batchNumber: { contains: f.q, mode: "insensitive" } } : {}),
    });
    const [items, total] = await Promise.all([
      this.prisma.scmStockBatch.findMany({
        where,
        skip: page.skip,
        take: page.limit,
        orderBy: { createdAt: "desc" },
        include: {
          product: { select: productSelect },
          warehouse: { select: { id: true, name: true } },
        },
      }),
      this.prisma.scmStockBatch.count({ where }),
    ]);
    return { items, total };
  }

  /** Registers batch metadata at quantity 0 — real quantity accrues through
   * GRN receipts (legacy rule). */
  @OrgScoped()
  async createBatch(scope: OrgScope, dto: CreateBatchDto, actorId: number) {
    const mfg = dto.manufacturingDate ? new Date(dto.manufacturingDate) : null;
    const exp = dto.expiryDate ? new Date(dto.expiryDate) : null;
    if (mfg && exp && exp < mfg) {
      throw new BusinessRuleViolationException(
        "Expiry date cannot be before the manufacturing date",
        "BATCH_DATES",
      );
    }
    return this.prisma.$transaction(async (tx) => {
      await this.requireProduct(tx, scope, dto.productId);
      await this.requireWarehouse(tx, scope, dto.warehouseId);
      const exists = await tx.scmStockBatch.findUnique({
        where: {
          organizationId_batchNumber_productId_warehouseId: {
            organizationId: scope.organizationId,
            batchNumber: dto.batchNumber,
            productId: dto.productId,
            warehouseId: dto.warehouseId,
          },
        },
      });
      if (exists) {
        throw new ResourceConflictException(
          `Batch ${dto.batchNumber} already exists for this product and warehouse`,
        );
      }
      const created = await tx.scmStockBatch.create({
        data: {
          organizationId: scope.organizationId,
          batchNumber: dto.batchNumber,
          productId: dto.productId,
          warehouseId: dto.warehouseId,
          locationId: dto.locationId ?? null,
          manufacturingDate: mfg,
          expiryDate: exp,
          quantity: 0,
          createdBy: actorId,
        },
      });
      await this.audit.write(tx, {
        entityType: "scm_stock_batch",
        entityId: created.id,
        action: "create",
        after: { batchNumber: dto.batchNumber },
      });
      return created;
    });
  }

  @OrgScoped()
  async setBatchStatus(scope: OrgScope, id: number, status: string) {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.scmStockBatch.findFirst({
        where: tenantWhere(scope, { id }),
      });
      if (!before) return null;
      const after = await tx.scmStockBatch.update({
        where: { id },
        data: { status },
      });
      await this.audit.write(tx, {
        entityType: "scm_stock_batch",
        entityId: id,
        action: "status_change",
        before: { status: before.status },
        after: { status },
      });
      return after;
    });
  }

  // ---- serial numbers -----------------------------------------------------

  @OrgScoped()
  async findSerials(scope: OrgScope, f: DocFilter, page: PaginationDto) {
    const where = tenantWhere<Prisma.ScmSerialNumberWhereInput>(scope, {
      ...(f.status ? { status: f.status } : {}),
      ...(f.productId ? { productId: f.productId } : {}),
      ...(f.warehouseId ? { warehouseId: f.warehouseId } : {}),
      ...(f.q ? { serialNumber: { contains: f.q, mode: "insensitive" } } : {}),
    });
    const [items, total] = await Promise.all([
      this.prisma.scmSerialNumber.findMany({
        where,
        skip: page.skip,
        take: page.limit,
        orderBy: { createdAt: "desc" },
        include: {
          product: { select: productSelect },
          warehouse: { select: { id: true, name: true } },
        },
      }),
      this.prisma.scmSerialNumber.count({ where }),
    ]);
    return { items, total };
  }

  @OrgScoped()
  async createSerials(scope: OrgScope, dto: CreateSerialsDto, actorId: number) {
    const list = dto.serialNumbers.map((s) => s.trim()).filter(Boolean);
    if (list.length === 0) {
      throw new BusinessRuleViolationException(
        "Enter at least one serial number",
        "SERIAL_EMPTY",
      );
    }
    if (new Set(list).size !== list.length) {
      throw new BusinessRuleViolationException(
        "Duplicate serial numbers entered",
        "SERIAL_DUPLICATE",
      );
    }
    return this.prisma.$transaction(async (tx) => {
      await this.requireProduct(tx, scope, dto.productId);
      await this.requireWarehouse(tx, scope, dto.warehouseId);
      const dup = await tx.scmSerialNumber.findFirst({
        where: {
          organizationId: scope.organizationId,
          serialNumber: { in: list },
        },
      });
      if (dup) {
        throw new ResourceConflictException(
          `Serial number "${dup.serialNumber}" already exists`,
        );
      }
      await tx.scmSerialNumber.createMany({
        data: list.map((serialNumber) => ({
          organizationId: scope.organizationId,
          serialNumber,
          productId: dto.productId,
          warehouseId: dto.warehouseId,
          locationId: dto.locationId ?? null,
          createdBy: actorId,
        })),
      });
      await this.audit.write(tx, {
        entityType: "scm_serial_number",
        entityId: dto.productId,
        action: "create",
        after: { count: list.length, productId: dto.productId },
      });
      return { created: list.length };
    });
  }

  @OrgScoped()
  async setSerialStatus(scope: OrgScope, id: number, status: string) {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.scmSerialNumber.findFirst({
        where: tenantWhere(scope, { id }),
      });
      if (!before) return null;
      const after = await tx.scmSerialNumber.update({
        where: { id },
        data: { status },
      });
      await this.audit.write(tx, {
        entityType: "scm_serial_number",
        entityId: id,
        action: "status_change",
        before: { status: before.status },
        after: { status },
      });
      return after;
    });
  }
}
