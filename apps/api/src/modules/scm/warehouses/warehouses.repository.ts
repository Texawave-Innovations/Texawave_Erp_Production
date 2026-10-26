import { Injectable } from "@nestjs/common";
import { Prisma } from "@texawave-erp/database";
import { OrgScoped } from "../../../common/decorators/org-scoped.decorator.js";
import type { PaginationDto } from "../../../common/dto/pagination.dto.js";
import type { OrgScope } from "../../../common/tenancy/org-scope.js";
import { tenantWhere } from "../../../common/tenancy/tenant-where.js";
import { AuditWriter } from "../../../platform/audit/audit-writer.js";
import { PrismaService } from "../../../shared/prisma/prisma.service.js";
import type {
  CreateWarehouseDto,
  UpdateLocationDto,
  UpdateWarehouseDto,
} from "./dto/warehouse.dto.js";
import { BusinessRuleViolationException } from "../../../common/exceptions/business.exception.js";

export interface WarehouseFilter {
  q?: string | undefined;
  status?: string | undefined;
}

type WarehouseRow = Prisma.ScmWarehouseGetPayload<object>;

function whSnapshot(w: WarehouseRow) {
  return { code: w.code, name: w.name, type: w.type, status: w.status };
}

const text = (v: string | undefined, cur: string | null) =>
  v === undefined ? cur : v.trim() || null;

@Injectable()
export class WarehousesRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditWriter,
  ) {}

  // ---- warehouses ---------------------------------------------------------

  @OrgScoped()
  async findMany(scope: OrgScope, f: WarehouseFilter, page: PaginationDto) {
    const clauses: Prisma.ScmWarehouseWhereInput[] = [{ deletedAt: null }];
    if (f.q) {
      const contains = { contains: f.q, mode: "insensitive" as const };
      clauses.push({
        OR: [{ code: contains }, { name: contains }, { city: contains }],
      });
    }
    if (f.status) clauses.push({ status: f.status });
    const where = tenantWhere<Prisma.ScmWarehouseWhereInput>(scope, {
      AND: clauses,
    });
    const [items, total] = await Promise.all([
      this.prisma.scmWarehouse.findMany({
        where,
        skip: page.skip,
        take: page.limit,
        orderBy: [{ name: "asc" }, { id: "asc" }],
      }),
      this.prisma.scmWarehouse.count({ where }),
    ]);
    return { items, total };
  }

  @OrgScoped()
  findOptions(scope: OrgScope) {
    return this.prisma.scmWarehouse.findMany({
      where: tenantWhere(scope, { deletedAt: null }),
      orderBy: { name: "asc" },
    });
  }

  @OrgScoped()
  findOne(scope: OrgScope, id: number) {
    return this.prisma.scmWarehouse.findFirst({
      where: tenantWhere(scope, { id, deletedAt: null }),
    });
  }

  @OrgScoped()
  findByCode(scope: OrgScope, code: string) {
    return this.prisma.scmWarehouse.findFirst({
      where: tenantWhere<Prisma.ScmWarehouseWhereInput>(scope, {
        code: { equals: code, mode: "insensitive" },
      }),
    });
  }

  @OrgScoped()
  async create(scope: OrgScope, dto: CreateWarehouseDto, actorId: number) {
    return this.prisma.$transaction(async (tx) => {
      const created = await tx.scmWarehouse.create({
        data: {
          organizationId: scope.organizationId,
          code: dto.code,
          name: dto.name,
          type: dto.type ?? "Main",
          address: text(dto.address, null),
          city: text(dto.city, null),
          state: text(dto.state, null),
          country: text(dto.country, null),
          postalCode: text(dto.postalCode, null),
          managerName: text(dto.managerName, null),
          status: dto.status ?? "Active",
          contactPerson: text(dto.contactPerson, null),
          phone: text(dto.phone, null),
          email: text(dto.email, null),
          capacity: dto.capacity ?? null,
          capacityUnit: text(dto.capacityUnit, null),
          operatingHours: text(dto.operatingHours, null),
          notes: text(dto.notes, null),
          createdBy: actorId,
          updatedBy: actorId,
        },
      });
      await this.audit.write(tx, {
        entityType: "scm_warehouse",
        entityId: created.id,
        action: "create",
        after: whSnapshot(created),
      });
      return created;
    });
  }

  @OrgScoped()
  async update(
    scope: OrgScope,
    id: number,
    dto: UpdateWarehouseDto,
    actorId: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.scmWarehouse.findFirst({
        where: tenantWhere(scope, { id, deletedAt: null }),
      });
      if (!before) return null;
      const after = await tx.scmWarehouse.update({
        where: { id },
        data: {
          code: dto.code ?? before.code,
          name: dto.name ?? before.name,
          type: dto.type ?? before.type,
          address: text(dto.address, before.address),
          city: text(dto.city, before.city),
          state: text(dto.state, before.state),
          country: text(dto.country, before.country),
          postalCode: text(dto.postalCode, before.postalCode),
          managerName: text(dto.managerName, before.managerName),
          status: dto.status ?? before.status,
          contactPerson: text(dto.contactPerson, before.contactPerson),
          phone: text(dto.phone, before.phone),
          email: text(dto.email, before.email),
          capacity: dto.capacity ?? before.capacity,
          capacityUnit: text(dto.capacityUnit, before.capacityUnit),
          operatingHours: text(dto.operatingHours, before.operatingHours),
          notes: text(dto.notes, before.notes),
          updatedBy: actorId,
        },
      });
      await this.audit.write(tx, {
        entityType: "scm_warehouse",
        entityId: id,
        action: before.status === after.status ? "update" : "status_change",
        before: whSnapshot(before),
        after: whSnapshot(after),
      });
      return after;
    });
  }

  /** POs still awaiting receipt at this warehouse (blocks deactivation). */
  @OrgScoped()
  countOpenPurchaseOrders(scope: OrgScope, warehouseId: number) {
    return this.prisma.scmPurchaseOrder.count({
      where: tenantWhere<Prisma.ScmPurchaseOrderWhereInput>(scope, {
        warehouseId,
        status: { in: ["SENT", "APPROVED", "PARTIALLY_RECEIVED"] },
      }),
    });
  }

  // ---- locations ----------------------------------------------------------

  @OrgScoped()
  async findLocations(
    scope: OrgScope,
    f: { warehouseId?: number | undefined; locationType?: string | undefined },
    page: PaginationDto,
  ) {
    const where = tenantWhere<Prisma.ScmWarehouseLocationWhereInput>(scope, {
      deletedAt: null,
      ...(f.warehouseId ? { warehouseId: f.warehouseId } : {}),
      ...(f.locationType ? { locationType: f.locationType } : {}),
    });
    const [items, total] = await Promise.all([
      this.prisma.scmWarehouseLocation.findMany({
        where,
        skip: page.skip,
        take: page.limit,
        orderBy: [{ locationCode: "asc" }, { id: "asc" }],
      }),
      this.prisma.scmWarehouseLocation.count({ where }),
    ]);
    return { items, total };
  }

  @OrgScoped()
  findLocationOptions(scope: OrgScope, warehouseId?: number) {
    return this.prisma.scmWarehouseLocation.findMany({
      where: tenantWhere(scope, {
        deletedAt: null,
        ...(warehouseId ? { warehouseId } : {}),
      }),
      orderBy: { locationCode: "asc" },
    });
  }

  @OrgScoped()
  findLocation(scope: OrgScope, id: number) {
    return this.prisma.scmWarehouseLocation.findFirst({
      where: tenantWhere(scope, { id, deletedAt: null }),
    });
  }

  /** Ancestors root-first, so codes/zone/rack/shelf can be derived. */
  @OrgScoped()
  async ancestorsOf(scope: OrgScope, parentId: number | null | undefined) {
    const chain: Prisma.ScmWarehouseLocationGetPayload<object>[] = [];
    let cursor = parentId ?? null;
    while (cursor !== null && chain.length < 8) {
      const node = await this.findLocation(scope, cursor);
      if (!node) break;
      chain.unshift(node);
      cursor = node.parentLocationId;
    }
    return chain;
  }

  @OrgScoped()
  async createLocation(
    scope: OrgScope,
    data: Omit<
      Prisma.ScmWarehouseLocationUncheckedCreateInput,
      "organizationId" | "createdBy" | "updatedBy"
    >,
    actorId: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const created = await tx.scmWarehouseLocation.create({
        data: {
          ...data,
          organizationId: scope.organizationId,
          createdBy: actorId,
          updatedBy: actorId,
        },
      });
      await this.audit.write(tx, {
        entityType: "scm_warehouse_location",
        entityId: created.id,
        action: "create",
        after: {
          locationCode: created.locationCode,
          locationType: created.locationType,
        },
      });
      return created;
    });
  }

  @OrgScoped()
  async updateLocation(
    scope: OrgScope,
    id: number,
    dto: UpdateLocationDto,
    actorId: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.scmWarehouseLocation.findFirst({
        where: tenantWhere(scope, { id, deletedAt: null }),
      });
      if (!before) return null;
      const after = await tx.scmWarehouseLocation.update({
        where: { id },
        data: {
          locationName: text(dto.locationName, before.locationName),
          capacity: dto.capacity ?? before.capacity,
          capacityUnit: text(dto.capacityUnit, before.capacityUnit),
          notes: text(dto.notes, before.notes),
          status: dto.status ?? before.status,
          updatedBy: actorId,
        },
      });
      await this.audit.write(tx, {
        entityType: "scm_warehouse_location",
        entityId: id,
        action: before.status === after.status ? "update" : "status_change",
        before: { status: before.status },
        after: { status: after.status },
      });
      return after;
    });
  }

  // ---- location tree (rack + bins, structural edits, delete) ---------------

  /** Creates a location and, for a rack, its bins in ONE transaction. */
  @OrgScoped()
  async createLocationTree(
    scope: OrgScope,
    root: Omit<
      Prisma.ScmWarehouseLocationUncheckedCreateInput,
      "organizationId" | "createdBy" | "updatedBy"
    >,
    bins: Omit<
      Prisma.ScmWarehouseLocationUncheckedCreateInput,
      "organizationId" | "createdBy" | "updatedBy" | "parentLocationId"
    >[],
    actorId: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const base = {
        organizationId: scope.organizationId,
        createdBy: actorId,
        updatedBy: actorId,
      };
      const created = await tx.scmWarehouseLocation.create({
        data: { ...root, ...base },
      });
      for (const bin of bins) {
        await tx.scmWarehouseLocation.create({
          data: { ...bin, ...base, parentLocationId: created.id },
        });
      }
      await this.audit.write(tx, {
        entityType: "scm_warehouse_location",
        entityId: created.id,
        action: "create",
        after: {
          locationCode: created.locationCode,
          locationType: created.locationType,
          bins: bins.length,
        },
      });
      return { location: created, binsCreated: bins.length };
    });
  }

  /** Applies a batch of location patches (a structural edit re-derives the
   * code of every nested location) atomically. */
  @OrgScoped()
  async applyLocationPatches(
    scope: OrgScope,
    patches: {
      id: number;
      data: Prisma.ScmWarehouseLocationUncheckedUpdateInput;
    }[],
    rootId: number,
    actorId: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      for (const patch of patches) {
        await tx.scmWarehouseLocation.update({
          where: { id: patch.id },
          data: { ...patch.data, updatedBy: actorId },
        });
      }
      await this.audit.write(tx, {
        entityType: "scm_warehouse_location",
        entityId: rootId,
        action: "update",
        after: { locationsUpdated: patches.length },
      });
      return tx.scmWarehouseLocation.findUniqueOrThrow({
        where: { id: rootId },
      });
    });
  }

  /** Stock stored per location (bins and racks), non-zero rows only. */
  @OrgScoped()
  locationStockSummary(scope: OrgScope, warehouseId?: number) {
    return this.prisma.scmLocationStock.findMany({
      where: tenantWhere<Prisma.ScmLocationStockWhereInput>(scope, {
        quantity: { gt: 0 },
        ...(warehouseId ? { warehouseId } : {}),
      }),
      select: {
        locationId: true,
        warehouseId: true,
        quantity: true,
        product: { select: { id: true, productCode: true, name: true } },
      },
    });
  }

  /** Deletes a location together with everything nested under it. Refused
   * while stock is recorded there unless `force`: the stock itself still
   * counts in the product's on-hand balance either way — only the
   * fine-grained "which bin" attribution is lost. */
  @OrgScoped()
  async removeLocationTree(
    scope: OrgScope,
    id: number,
    force: boolean,
    actorId: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const root = await tx.scmWarehouseLocation.findFirst({
        where: tenantWhere(scope, { id, deletedAt: null }),
      });
      if (!root) return null;
      const ids = [id];
      let frontier = [id];
      while (frontier.length > 0 && ids.length < 5000) {
        const kids = await tx.scmWarehouseLocation.findMany({
          where: { parentLocationId: { in: frontier } },
          select: { id: true },
        });
        frontier = kids.map((k) => k.id).filter((k) => !ids.includes(k));
        ids.push(...frontier);
      }
      const stock = await tx.scmLocationStock.aggregate({
        where: { locationId: { in: ids }, quantity: { gt: 0 } },
        _sum: { quantity: true },
      });
      const occupied = Number(stock._sum.quantity ?? 0);
      if (occupied > 0 && !force) {
        throw new BusinessRuleViolationException(
          `Cannot delete — ${occupied} unit(s) of stock are recorded at this location.`,
          "LOCATION_HAS_STOCK",
        );
      }
      await tx.scmLocationStock.deleteMany({
        where: { locationId: { in: ids } },
      });
      // Children first, so a bin never points at a deleted rack part-way.
      for (const lid of [...ids].reverse()) {
        await tx.scmWarehouseLocation.delete({ where: { id: lid } });
      }
      await this.audit.write(tx, {
        entityType: "scm_warehouse_location",
        entityId: id,
        action: "delete",
        before: {
          locationCode: root.locationCode,
          nested: ids.length - 1,
          stockUnits: occupied,
          by: actorId,
        },
      });
      return { deleted: ids.length, nested: ids.length - 1 };
    });
  }

  /** Soft-deletes a warehouse. Refused while it holds stock or while
   * business documents (receipts, orders, shipments, inspections, returns...)
   * still reference it; its (empty) locations go with it. */
  @OrgScoped()
  async removeWarehouse(scope: OrgScope, id: number, actorId: number) {
    return this.prisma.$transaction(async (tx) => {
      const wh = await tx.scmWarehouse.findFirst({
        where: tenantWhere(scope, { id, deletedAt: null }),
      });
      if (!wh) return false;
      const stock = await tx.scmStockBalance.aggregate({
        where: { warehouseId: id },
        _sum: { onHand: true },
      });
      const onHand = Number(stock._sum.onHand ?? 0);
      if (onHand > 0) {
        throw new BusinessRuleViolationException(
          `Cannot delete — ${onHand} unit(s) of stock recorded in this warehouse.`,
          "WAREHOUSE_HAS_STOCK",
        );
      }
      const checks: [string, number][] = [
        [
          "goods receipt(s) (GRN) reference this warehouse",
          await tx.scmGoodsReceipt.count({ where: { warehouseId: id } }),
        ],
        [
          "purchase order(s) reference this warehouse",
          await tx.scmPurchaseOrder.count({ where: { warehouseId: id } }),
        ],
        [
          "material requisition(s) reference this warehouse",
          await tx.scmPurchaseRequisition.count({ where: { warehouseId: id } }),
        ],
        [
          "RFQ(s) reference this warehouse",
          await tx.scmRfq.count({ where: { warehouseId: id } }),
        ],
        [
          "order fulfillment(s) reference this warehouse",
          await tx.scmFulfillment.count({ where: { warehouseId: id } }),
        ],
        [
          "shipment(s) reference this warehouse",
          await tx.scmShipment.count({ where: { warehouseId: id } }),
        ],
        [
          "quality inspection(s) reference this warehouse",
          await tx.scmQualityInspection.count({ where: { warehouseId: id } }),
        ],
        [
          "quarantine record(s) reference this warehouse",
          await tx.scmQuarantineRecord.count({ where: { warehouseId: id } }),
        ],
        [
          "return(s) reference this warehouse",
          await tx.scmReturn.count({ where: { warehouseId: id } }),
        ],
      ];
      const blocker = checks.find(([, n]) => n > 0);
      if (blocker) {
        throw new BusinessRuleViolationException(
          `Cannot delete — ${blocker[1]} ${blocker[0]}.`,
          "WAREHOUSE_IN_USE",
        );
      }
      const now = new Date();
      await tx.scmLocationStock.deleteMany({ where: { warehouseId: id } });
      await tx.scmWarehouseLocation.updateMany({
        where: { warehouseId: id, deletedAt: null },
        data: { deletedAt: now },
      });
      await tx.scmWarehouse.update({
        where: { id },
        data: { deletedAt: now, updatedBy: actorId },
      });
      await this.audit.write(tx, {
        entityType: "scm_warehouse",
        entityId: id,
        action: "delete",
        before: { code: wh.code, name: wh.name },
      });
      return true;
    });
  }
}
