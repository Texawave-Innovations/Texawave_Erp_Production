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
}
