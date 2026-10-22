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
import type {
  CreateMovementDto,
  CreatePutawayDto,
  RecordPutawayItemDto,
} from "./dto/warehouse-ops.dto.js";
import { LocationStockService } from "./location-stock.service.js";
import {
  MOVEMENT_TRANSITIONS,
  PUTAWAY_TRANSITIONS,
  statusesLeadingTo,
} from "./warehouse-ops.helpers.js";

const num = (d: Prisma.Decimal | number | null | undefined) =>
  d === null || d === undefined ? 0 : Number(d);
const rule = (message: string, code: string) =>
  new BusinessRuleViolationException(message, code);

const putawayInclude = {
  items: { orderBy: { lineNo: "asc" } },
  warehouse: { select: { id: true, name: true, code: true } },
} satisfies Prisma.ScmPutawayInclude;
const movementInclude = {
  items: { orderBy: { lineNo: "asc" } },
  warehouse: { select: { id: true, name: true, code: true } },
} satisfies Prisma.ScmWarehouseMovementInclude;

@Injectable()
export class WarehouseOpsRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditWriter,
    private readonly numbering: ScmNumberingService,
    private readonly locationStock: LocationStockService,
  ) {}

  // ---- put-away ----------------------------------------------------------------

  @OrgScoped()
  async findPutaways(
    scope: OrgScope,
    f: {
      q?: string | undefined;
      status?: string | undefined;
      warehouseId?: number | undefined;
    },
    page: PaginationDto,
  ) {
    const where = tenantWhere<Prisma.ScmPutawayWhereInput>(scope, {
      ...(f.status ? { status: f.status } : {}),
      ...(f.warehouseId ? { warehouseId: f.warehouseId } : {}),
      ...(f.q
        ? {
            OR: [
              { putawayNumber: { contains: f.q, mode: "insensitive" } },
              { grnNumber: { contains: f.q, mode: "insensitive" } },
            ],
          }
        : {}),
    });
    const [items, total] = await Promise.all([
      this.prisma.scmPutaway.findMany({
        where,
        skip: page.skip,
        take: page.limit,
        orderBy: { id: "desc" },
        include: putawayInclude,
      }),
      this.prisma.scmPutaway.count({ where }),
    ]);
    return { items, total };
  }

  @OrgScoped()
  findPutaway(scope: OrgScope, id: number) {
    return this.prisma.scmPutaway.findFirst({
      where: tenantWhere(scope, { id }),
      include: putawayInclude,
    });
  }

  /** Eligible GRNs: completed receipts with no open put-away yet. */
  @OrgScoped()
  async findPutawaySources(scope: OrgScope) {
    const org = scope.organizationId;
    const grns = await this.prisma.scmGoodsReceipt.findMany({
      where: { organizationId: org, status: "COMPLETED" },
      orderBy: { id: "desc" },
      take: 200,
      select: {
        id: true,
        grnNumber: true,
        warehouseId: true,
        vendorNameSnapshot: true,
      },
    });
    const open = await this.prisma.scmPutaway.findMany({
      where: {
        organizationId: org,
        grnId: { in: grns.map((g) => g.id) },
        status: { not: "CANCELLED" },
      },
      select: { grnId: true },
    });
    const taken = new Set(open.map((o) => o.grnId));
    return grns.filter((g) => !taken.has(g.id));
  }

  @OrgScoped()
  async createPutaway(scope: OrgScope, dto: CreatePutawayDto, actorId: number) {
    return this.prisma.$transaction(async (tx) => {
      const org = scope.organizationId;
      const wh = await tx.scmWarehouse.findFirst({
        where: { id: dto.warehouseId, organizationId: org },
      });
      if (!wh) throw rule("Warehouse not found.", "WH_SOURCE");

      let grnNumber: string | null = null;
      const lines: Prisma.ScmPutawayItemCreateWithoutPutawayInput[] = [];
      if (dto.grnId) {
        const grn = await tx.scmGoodsReceipt.findFirst({
          where: {
            id: dto.grnId,
            organizationId: org,
            warehouseId: dto.warehouseId,
          },
          include: { items: { include: { product: true } } },
        });
        if (!grn) throw rule("GRN not found for this warehouse.", "WH_SOURCE");
        if (grn.status !== "COMPLETED") {
          throw rule(
            "Only completed goods receipts can be put away.",
            "WH_SOURCE",
          );
        }
        const open = await tx.scmPutaway.findFirst({
          where: { grnId: grn.id, status: { not: "CANCELLED" } },
        });
        if (open)
          throw rule(
            `${grn.grnNumber} already has an open put-away.`,
            "WH_DUP",
          );
        grnNumber = grn.grnNumber;
        let lineNo = 0;
        for (const it of grn.items) {
          if (num(it.acceptedQuantity) <= 0) continue;
          lines.push({
            lineNo: ++lineNo,
            product: { connect: { id: it.productId } },
            productCode: it.product.productCode,
            productName: it.productNameSnapshot,
            quantity: num(it.acceptedQuantity),
            batchNumber: it.batchNumber,
            serialNumbers: it.serialNumbers,
          });
        }
        if (lines.length === 0) {
          throw rule(
            "This GRN has no accepted quantity to put away.",
            "WH_EMPTY",
          );
        }
      }

      const putawayNumber = await this.numbering.next(tx, org, "putaway");
      const created = await tx.scmPutaway.create({
        data: {
          organizationId: org,
          putawayNumber,
          warehouseId: dto.warehouseId,
          grnId: dto.grnId ?? null,
          grnNumber,
          notes: dto.notes?.trim() || null,
          createdBy: actorId,
          items: { create: lines },
        },
        include: putawayInclude,
      });
      await this.audit.write(tx, {
        entityType: "scm_putaway",
        entityId: created.id,
        action: "create",
        after: { putawayNumber, grn: grnNumber },
      });
      return created;
    });
  }

  /** Adds an ad-hoc line (no source GRN) to a PENDING put-away. */
  @OrgScoped()
  async addPutawayLine(
    scope: OrgScope,
    id: number,
    input: { productId: number; quantity: number },
    _actorId: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const org = scope.organizationId;
      const putaway = await tx.scmPutaway.findFirst({
        where: tenantWhere(scope, { id }),
        include: { items: true },
      });
      if (!putaway) return null;
      if (putaway.status !== "PENDING") {
        throw rule(
          "Lines can only be added while the put-away is pending.",
          "WH_STATE",
        );
      }
      const product = await tx.scmProduct.findFirst({
        where: { id: input.productId, organizationId: org },
      });
      if (!product) throw rule("Product not found.", "WH_SOURCE");
      const lineNo = putaway.items.length + 1;
      await tx.scmPutawayItem.create({
        data: {
          putawayId: id,
          lineNo,
          productId: product.id,
          productCode: product.productCode,
          productName: product.name,
          quantity: input.quantity,
        },
      });
      await this.audit.write(tx, {
        entityType: "scm_putaway",
        entityId: id,
        action: "add_line",
        after: { product: product.productCode, quantity: input.quantity },
      });
      return tx.scmPutaway.findUniqueOrThrow({
        where: { id },
        include: putawayInclude,
      });
    });
  }

  @OrgScoped()
  async startPutaway(scope: OrgScope, id: number, actorId: number) {
    return this.movePutaway(
      scope,
      id,
      "IN_PROGRESS",
      { startedAt: new Date() },
      actorId,
    );
  }

  @OrgScoped()
  async cancelPutaway(
    scope: OrgScope,
    id: number,
    reason: string | undefined,
    actorId: number,
  ) {
    return this.movePutaway(
      scope,
      id,
      "CANCELLED",
      { cancelledAt: new Date(), cancellationReason: reason ?? null },
      actorId,
      reason,
    );
  }

  private async movePutaway(
    scope: OrgScope,
    id: number,
    to: string,
    data: Prisma.ScmPutawayUncheckedUpdateInput,
    actorId: number,
    reason?: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const putaway = await tx.scmPutaway.findFirst({
        where: tenantWhere(scope, { id }),
      });
      if (!putaway) return null;
      if (
        !statusesLeadingTo(PUTAWAY_TRANSITIONS, to).includes(putaway.status)
      ) {
        throw new InvalidStateTransitionException(
          "Put-away",
          putaway.status,
          to,
        );
      }
      const after = await tx.scmPutaway.update({
        where: { id },
        data: { ...data, status: to },
        include: putawayInclude,
      });
      await this.audit.write(tx, {
        entityType: "scm_putaway",
        entityId: id,
        action: "status_change",
        before: { status: putaway.status },
        after: { status: to },
        reason,
      });
      return after;
    });
  }

  /** Records putting `quantity` of one line into `destinationLocationId`.
   * Adjusts the bin balance under a row lock, checking capacity; moves a
   * batch's/serials' recorded location the same way the GRN itself does.
   * The line, and the put-away as a whole once every line is fully put
   * away, flip to COMPLETED automatically. */
  @OrgScoped()
  async recordPutawayItem(
    scope: OrgScope,
    id: number,
    itemId: number,
    dto: RecordPutawayItemDto,
    _actorId: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const org = scope.organizationId;
      const putaway = await tx.scmPutaway.findFirst({
        where: tenantWhere(scope, { id }),
        include: { items: true },
      });
      if (!putaway) return null;
      if (putaway.status !== "IN_PROGRESS") {
        throw rule("Start the put-away before recording lines.", "WH_STATE");
      }
      const item = putaway.items.find((i) => i.id === itemId);
      if (!item) return null;
      const remaining = num(item.quantity) - num(item.putAwayQuantity);
      if (dto.quantity > remaining + 1e-9) {
        throw rule(
          `Only ${remaining} unit(s) of ${item.productCode} are left to put away.`,
          "WH_QTY",
        );
      }
      const loc = await tx.scmWarehouseLocation.findFirst({
        where: {
          id: dto.destinationLocationId,
          organizationId: org,
          warehouseId: putaway.warehouseId,
        },
      });
      if (!loc)
        throw rule(
          "Destination does not belong to this warehouse.",
          "WH_LOCATION",
        );

      await this.locationStock.adjust(
        tx,
        org,
        item.productId,
        putaway.warehouseId,
        loc.id,
        dto.quantity,
        loc.capacity ? Number(loc.capacity) : null,
      );
      if (item.batchNumber) {
        await tx.scmStockBatch.updateMany({
          where: {
            organizationId: org,
            batchNumber: item.batchNumber,
            productId: item.productId,
            warehouseId: putaway.warehouseId,
          },
          data: { locationId: loc.id },
        });
      }
      if (item.serialNumbers.length > 0) {
        await tx.scmSerialNumber.updateMany({
          where: {
            organizationId: org,
            serialNumber: { in: item.serialNumbers },
            productId: item.productId,
          },
          data: { locationId: loc.id },
        });
      }
      const after = await tx.scmPutawayItem.update({
        where: { id: itemId },
        data: {
          putAwayQuantity: { increment: dto.quantity },
          destinationLocationId: loc.id,
        },
      });
      const freshItems = await tx.scmPutawayItem.findMany({
        where: { putawayId: id },
      });
      const allDone = freshItems.every(
        (i) => num(i.putAwayQuantity) >= num(i.quantity) - 1e-9,
      );
      if (allDone) {
        await tx.scmPutaway.update({
          where: { id },
          data: { status: "COMPLETED", completedAt: new Date() },
        });
      }
      await this.audit.write(tx, {
        entityType: "scm_putaway",
        entityId: id,
        action: "record_item",
        after: {
          product: item.productCode,
          quantity: dto.quantity,
          location: loc.binCode,
        },
      });
      void after;
      return tx.scmPutaway.findUniqueOrThrow({
        where: { id },
        include: putawayInclude,
      });
    });
  }

  // ---- internal movements ---------------------------------------------------

  @OrgScoped()
  async findMovements(
    scope: OrgScope,
    f: {
      q?: string | undefined;
      status?: string | undefined;
      warehouseId?: number | undefined;
    },
    page: PaginationDto,
  ) {
    const where = tenantWhere<Prisma.ScmWarehouseMovementWhereInput>(scope, {
      ...(f.status ? { status: f.status } : {}),
      ...(f.warehouseId ? { warehouseId: f.warehouseId } : {}),
      ...(f.q
        ? { movementNumber: { contains: f.q, mode: "insensitive" } }
        : {}),
    });
    const [items, total] = await Promise.all([
      this.prisma.scmWarehouseMovement.findMany({
        where,
        skip: page.skip,
        take: page.limit,
        orderBy: { id: "desc" },
        include: movementInclude,
      }),
      this.prisma.scmWarehouseMovement.count({ where }),
    ]);
    return { items, total };
  }

  @OrgScoped()
  findMovement(scope: OrgScope, id: number) {
    return this.prisma.scmWarehouseMovement.findFirst({
      where: tenantWhere(scope, { id }),
      include: movementInclude,
    });
  }

  @OrgScoped()
  async createMovement(
    scope: OrgScope,
    dto: CreateMovementDto,
    actorId: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const org = scope.organizationId;
      const wh = await tx.scmWarehouse.findFirst({
        where: { id: dto.warehouseId, organizationId: org },
      });
      if (!wh) throw rule("Warehouse not found.", "WH_SOURCE");

      const lines: Prisma.ScmWarehouseMovementItemCreateWithoutMovementInput[] =
        [];
      let lineNo = 0;
      for (const it of dto.items) {
        if (it.sourceLocationId === it.destinationLocationId) {
          throw rule(
            "Source and destination cannot be the same location.",
            "WH_SAME_LOCATION",
          );
        }
        const [product, source, dest] = await Promise.all([
          tx.scmProduct.findFirst({
            where: { id: it.productId, organizationId: org },
          }),
          tx.scmWarehouseLocation.findFirst({
            where: {
              id: it.sourceLocationId,
              organizationId: org,
              warehouseId: dto.warehouseId,
            },
          }),
          tx.scmWarehouseLocation.findFirst({
            where: {
              id: it.destinationLocationId,
              organizationId: org,
              warehouseId: dto.warehouseId,
            },
          }),
        ]);
        if (!product) throw rule("Product not found.", "WH_SOURCE");
        if (!source || !dest)
          throw rule("Locations must belong to this warehouse.", "WH_LOCATION");
        lines.push({
          lineNo: ++lineNo,
          product: { connect: { id: product.id } },
          productCode: product.productCode,
          productName: product.name,
          quantity: it.quantity,
          sourceLocationId: it.sourceLocationId,
          destinationLocationId: it.destinationLocationId,
        });
      }

      const movementNumber = await this.numbering.next(
        tx,
        org,
        "warehouseMovement",
      );
      const created = await tx.scmWarehouseMovement.create({
        data: {
          organizationId: org,
          movementNumber,
          warehouseId: dto.warehouseId,
          requestedBy: actorId,
          notes: dto.notes?.trim() || null,
          createdBy: actorId,
          items: { create: lines },
        },
        include: movementInclude,
      });
      await this.audit.write(tx, {
        entityType: "scm_warehouse_movement",
        entityId: created.id,
        action: "create",
        after: { movementNumber, lines: lines.length },
      });
      return created;
    });
  }

  @OrgScoped()
  async submitMovement(scope: OrgScope, id: number, actorId: number) {
    return this.moveMovement(scope, id, "REQUESTED", {}, actorId);
  }
  @OrgScoped()
  async approveMovement(scope: OrgScope, id: number, actorId: number) {
    return this.moveMovement(
      scope,
      id,
      "APPROVED",
      { approvedBy: actorId, approvedAt: new Date() },
      actorId,
    );
  }
  @OrgScoped()
  async cancelMovement(
    scope: OrgScope,
    id: number,
    reason: string | undefined,
    actorId: number,
  ) {
    return this.moveMovement(
      scope,
      id,
      "CANCELLED",
      { cancelledAt: new Date(), cancellationReason: reason ?? null },
      actorId,
      reason,
    );
  }

  private async moveMovement(
    scope: OrgScope,
    id: number,
    to: string,
    data: Prisma.ScmWarehouseMovementUncheckedUpdateInput,
    actorId: number,
    reason?: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const movement = await tx.scmWarehouseMovement.findFirst({
        where: tenantWhere(scope, { id }),
      });
      if (!movement) return null;
      if (
        !statusesLeadingTo(MOVEMENT_TRANSITIONS, to).includes(movement.status)
      ) {
        throw new InvalidStateTransitionException(
          "Movement",
          movement.status,
          to,
        );
      }
      const after = await tx.scmWarehouseMovement.update({
        where: { id },
        data: { ...data, status: to },
        include: movementInclude,
      });
      await this.audit.write(tx, {
        entityType: "scm_warehouse_movement",
        entityId: id,
        action: "status_change",
        before: { status: movement.status },
        after: { status: to },
        reason,
      });
      return after;
    });
  }

  /** Moves every line's stock from its source bin to its destination bin
   * (under row locks, so two concurrent completes of overlapping bins can
   * never race) and completes the movement in the same transaction. */
  @OrgScoped()
  async completeMovement(scope: OrgScope, id: number, _actorId: number) {
    return this.prisma.$transaction(async (tx) => {
      const org = scope.organizationId;
      const movement = await tx.scmWarehouseMovement.findFirst({
        where: tenantWhere(scope, { id }),
        include: { items: true },
      });
      if (!movement) return null;
      const canComplete =
        movement.status === "IN_PROGRESS" ||
        statusesLeadingTo(MOVEMENT_TRANSITIONS, "IN_PROGRESS").includes(
          movement.status,
        );
      if (!canComplete) {
        throw new InvalidStateTransitionException(
          "Movement",
          movement.status,
          "COMPLETED",
        );
      }
      if (movement.status !== "IN_PROGRESS") {
        await tx.scmWarehouseMovement.update({
          where: { id },
          data: { status: "IN_PROGRESS" },
        });
      }
      for (const it of movement.items) {
        const destLoc = await tx.scmWarehouseLocation.findFirst({
          where: { id: it.destinationLocationId, organizationId: org },
        });
        await this.locationStock.adjust(
          tx,
          org,
          it.productId,
          movement.warehouseId,
          it.sourceLocationId,
          -num(it.quantity),
        );
        await this.locationStock.adjust(
          tx,
          org,
          it.productId,
          movement.warehouseId,
          it.destinationLocationId,
          num(it.quantity),
          destLoc?.capacity ? Number(destLoc.capacity) : null,
        );
        if (it.batchNumber) {
          await tx.scmStockBatch.updateMany({
            where: {
              organizationId: org,
              batchNumber: it.batchNumber,
              productId: it.productId,
              warehouseId: movement.warehouseId,
            },
            data: { locationId: it.destinationLocationId },
          });
        }
        if (it.serialNumbers.length > 0) {
          await tx.scmSerialNumber.updateMany({
            where: {
              organizationId: org,
              serialNumber: { in: it.serialNumbers },
              productId: it.productId,
            },
            data: { locationId: it.destinationLocationId },
          });
        }
      }
      const after = await tx.scmWarehouseMovement.update({
        where: { id },
        data: { status: "COMPLETED", completedAt: new Date() },
        include: movementInclude,
      });
      await this.audit.write(tx, {
        entityType: "scm_warehouse_movement",
        entityId: id,
        action: "complete",
        after: { movementNumber: movement.movementNumber },
      });
      return after;
    });
  }

  // ---- location stock / dashboard --------------------------------------------

  @OrgScoped()
  async findLocationStock(
    scope: OrgScope,
    f: { warehouseId?: number | undefined; q?: string | undefined },
    page: PaginationDto,
  ) {
    const where: Prisma.ScmLocationStockWhereInput = {
      organizationId: scope.organizationId,
      quantity: { gt: 0 },
      ...(f.warehouseId ? { warehouseId: f.warehouseId } : {}),
      ...(f.q
        ? {
            product: {
              OR: [
                { productCode: { contains: f.q, mode: "insensitive" } },
                { name: { contains: f.q, mode: "insensitive" } },
              ],
            },
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.scmLocationStock.findMany({
        where,
        skip: page.skip,
        take: page.limit,
        orderBy: { id: "desc" },
        include: {
          product: { select: { id: true, productCode: true, name: true } },
          warehouse: { select: { id: true, name: true, code: true } },
          location: { select: { id: true, binCode: true, locationCode: true } },
        },
      }),
      this.prisma.scmLocationStock.count({ where }),
    ]);
    return { items, total };
  }

  @OrgScoped()
  async dashboard(scope: OrgScope) {
    const org = scope.organizationId;
    const [putawayByStatus, movementByStatus, warehouses, locations, occupied] =
      await Promise.all([
        this.prisma.scmPutaway.groupBy({
          by: ["status"],
          where: { organizationId: org },
          _count: { _all: true },
        }),
        this.prisma.scmWarehouseMovement.groupBy({
          by: ["status"],
          where: { organizationId: org },
          _count: { _all: true },
        }),
        this.prisma.scmWarehouse.count({
          where: { organizationId: org, status: "Active" },
        }),
        this.prisma.scmWarehouseLocation.count({
          where: { organizationId: org, status: "Active" },
        }),
        this.prisma.scmLocationStock.groupBy({
          by: ["locationId"],
          where: { organizationId: org, quantity: { gt: 0 } },
          _count: { _all: true },
        }),
      ]);
    return {
      putawayByStatus: Object.fromEntries(
        putawayByStatus.map((r) => [r.status, r._count._all]),
      ),
      movementByStatus: Object.fromEntries(
        movementByStatus.map((r) => [r.status, r._count._all]),
      ),
      activeWarehouses: warehouses,
      activeLocations: locations,
      occupiedLocations: occupied.length,
    };
  }
}
