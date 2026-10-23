import { Injectable } from "@nestjs/common";
import { Prisma } from "@texawave-erp/database";
import { OrgScoped } from "../../../common/decorators/org-scoped.decorator.js";
import type { PaginationDto } from "../../../common/dto/pagination.dto.js";
import {
  BusinessRuleViolationException,
  ResourceConflictException,
} from "../../../common/exceptions/business.exception.js";
import type { OrgScope } from "../../../common/tenancy/org-scope.js";
import { tenantWhere } from "../../../common/tenancy/tenant-where.js";
import { AuditWriter } from "../../../platform/audit/audit-writer.js";
import { PrismaService } from "../../../shared/prisma/prisma.service.js";
import type {
  CreateScmProductDto,
  UpdateScmProductDto,
} from "./dto/product.dto.js";

const ENTITY_TYPE = "scm_product";

export interface ScmProductFilter {
  q?: string | undefined;
  isActive?: boolean | undefined;
}

type Row = Prisma.ScmProductGetPayload<object>;

function snapshot(r: Row) {
  return {
    barcode: r.barcode,
    warehouseId: r.warehouseId,
    binLocationId: r.binLocationId,
    expiryDate: r.expiryDate,
    expiryNotApplicable: r.expiryNotApplicable,
    productCode: r.productCode,
    name: r.name,
    uom: r.uom,
    unitPrice: r.unitPrice.toString(),
    costPrice: r.costPrice.toString(),
    batchTracked: r.batchTracked,
    serialTracked: r.serialTracked,
    isActive: r.isActive,
  };
}

function filterWhere(f: ScmProductFilter): Prisma.ScmProductWhereInput {
  const clauses: Prisma.ScmProductWhereInput[] = [{ deletedAt: null }];
  if (f.q) {
    const contains = { contains: f.q, mode: "insensitive" as const };
    clauses.push({
      OR: [
        { productCode: contains },
        { name: contains },
        { category: contains },
        { hsn: contains },
      ],
    });
  }
  if (f.isActive !== undefined) clauses.push({ isActive: f.isActive });
  return { AND: clauses };
}

const text = (v: string | undefined, cur: string | null) =>
  v === undefined ? cur : v.trim() || null;
const num = (v: number | null | undefined, cur: Prisma.Decimal | null) =>
  v === undefined ? cur : v;

@Injectable()
export class ScmProductsRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditWriter,
  ) {}

  @OrgScoped()
  async findMany(
    scope: OrgScope,
    filter: ScmProductFilter,
    page: PaginationDto,
  ) {
    const where = tenantWhere<Prisma.ScmProductWhereInput>(
      scope,
      filterWhere(filter),
    );
    const [items, total] = await Promise.all([
      this.prisma.scmProduct.findMany({
        where,
        skip: page.skip,
        take: page.limit,
        orderBy: [{ name: "asc" }, { id: "asc" }],
      }),
      this.prisma.scmProduct.count({ where }),
    ]);
    return { items, total };
  }

  /** All active products, unpaginated, for pickers. */
  @OrgScoped()
  findOptions(scope: OrgScope) {
    return this.prisma.scmProduct.findMany({
      where: tenantWhere(scope, { deletedAt: null, isActive: true }),
      orderBy: { name: "asc" },
    });
  }

  @OrgScoped()
  findOne(scope: OrgScope, id: number) {
    return this.prisma.scmProduct.findFirst({
      where: tenantWhere(scope, { id, deletedAt: null }),
    });
  }

  @OrgScoped()
  findByCode(scope: OrgScope, productCode: string) {
    return this.prisma.scmProduct.findFirst({
      where: tenantWhere<Prisma.ScmProductWhereInput>(scope, {
        productCode: { equals: productCode, mode: "insensitive" },
      }),
    });
  }

  @OrgScoped()
  async create(scope: OrgScope, dto: CreateScmProductDto, actorId: number) {
    return this.prisma.$transaction(async (tx) => {
      const created = await tx.scmProduct.create({
        data: {
          organizationId: scope.organizationId,
          productCode: dto.productCode,
          name: dto.name,
          category: text(dto.category, null),
          uom: dto.uom ?? "PCS",
          hsn: text(dto.hsn, null),
          unitPrice: dto.unitPrice ?? 0,
          costPrice: dto.costPrice ?? 0,
          reorderLevel: dto.reorderLevel ?? null,
          minimumStock: dto.minimumStock ?? null,
          maximumStock: dto.maximumStock ?? null,
          batchTracked: dto.batchTracked ?? false,
          serialTracked: dto.serialTracked ?? false,
          description: text(dto.description, null),
          isActive: dto.isActive ?? true,
          ...(await this.placementData(tx, scope, null, dto)),
          createdBy: actorId,
          updatedBy: actorId,
        },
      });
      await this.audit.write(tx, {
        entityType: ENTITY_TYPE,
        entityId: created.id,
        action: "create",
        after: snapshot(created),
      });
      return created;
    });
  }

  @OrgScoped()
  async update(
    scope: OrgScope,
    id: number,
    dto: UpdateScmProductDto,
    actorId: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.scmProduct.findFirst({
        where: tenantWhere(scope, { id, deletedAt: null }),
      });
      if (!before) return null;
      const after = await tx.scmProduct.update({
        where: { id },
        data: {
          productCode: dto.productCode ?? before.productCode,
          name: dto.name ?? before.name,
          category: text(dto.category, before.category),
          uom: dto.uom ?? before.uom,
          hsn: text(dto.hsn, before.hsn),
          unitPrice: dto.unitPrice ?? before.unitPrice,
          costPrice: dto.costPrice ?? before.costPrice,
          reorderLevel: num(dto.reorderLevel, before.reorderLevel),
          minimumStock: num(dto.minimumStock, before.minimumStock),
          maximumStock: num(dto.maximumStock, before.maximumStock),
          batchTracked: dto.batchTracked ?? before.batchTracked,
          serialTracked: dto.serialTracked ?? before.serialTracked,
          description: text(dto.description, before.description),
          isActive: dto.isActive ?? before.isActive,
          ...(await this.placementData(tx, scope, before, dto, id)),
          updatedBy: actorId,
        },
      });
      await this.audit.write(tx, {
        entityType: ENTITY_TYPE,
        entityId: id,
        action: "update",
        before: snapshot(before),
        after: snapshot(after),
      });
      return after;
    });
  }

  /** Soft delete; refused once the product has any stock history. */
  @OrgScoped()
  async softDelete(scope: OrgScope, id: number, actorId: number) {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.scmProduct.findFirst({
        where: tenantWhere(scope, { id, deletedAt: null }),
      });
      if (!before) return null;
      const used = await tx.scmStockLedgerEntry.count({
        where: { productId: id },
      });
      if (used > 0) {
        throw new BusinessRuleViolationException(
          `"${before.name}" has stock history and can't be deleted. Mark it inactive instead.`,
          "PRODUCT_IN_USE",
        );
      }
      const after = await tx.scmProduct.update({
        where: { id },
        // The barcode is released so the value can be reused.
        data: {
          deletedAt: new Date(),
          isActive: false,
          barcode: null,
          updatedBy: actorId,
        },
      });
      await this.audit.write(tx, {
        entityType: ENTITY_TYPE,
        entityId: id,
        action: "delete",
        before: snapshot(before),
        after: snapshot(after),
      });
      return after;
    });
  }

  /** Barcode, warehouse / default-bin and expiry columns for a create/update.
   * Re-validates against fresh data so a stale client can never persist a
   * cross-warehouse bin or a duplicate barcode. */
  private async placementData(
    tx: Prisma.TransactionClient,
    scope: OrgScope,
    before: Row | null,
    dto: CreateScmProductDto | UpdateScmProductDto,
    selfId?: number,
  ) {
    // ---- barcode (unique among live products; the code is also a valid barcode)
    let barcode = before?.barcode ?? null;
    let barcodeCreatedAt = before?.barcodeCreatedAt ?? null;
    if (dto.barcode !== undefined) {
      barcode = dto.barcode?.trim() || null;
      if (barcode) {
        const clash = await tx.scmProduct.findFirst({
          where: {
            organizationId: scope.organizationId,
            deletedAt: null,
            ...(selfId ? { id: { not: selfId } } : {}),
            OR: [
              { barcode: { equals: barcode, mode: "insensitive" } },
              {
                barcode: null,
                productCode: { equals: barcode, mode: "insensitive" },
              },
            ],
          },
          select: { name: true, productCode: true },
        });
        if (clash) {
          throw new ResourceConflictException(
            `Barcode already assigned to "${clash.name}" (${clash.productCode})`,
          );
        }
        barcodeCreatedAt = barcodeCreatedAt ?? new Date();
      } else {
        barcodeCreatedAt = null;
      }
    }

    // ---- warehouse + default bin
    let warehouseId = before?.warehouseId ?? null;
    let binLocationId = before?.binLocationId ?? null;
    if (dto.warehouseId !== undefined) warehouseId = dto.warehouseId;
    if (dto.binLocationId !== undefined) binLocationId = dto.binLocationId;
    if (warehouseId !== null) {
      const wh = await tx.scmWarehouse.findFirst({
        where: tenantWhere(scope, { id: warehouseId, deletedAt: null }),
        select: { id: true },
      });
      if (!wh) {
        throw new BusinessRuleViolationException(
          "The selected warehouse does not exist",
          "UNKNOWN_WAREHOUSE",
        );
      }
    }
    if (
      dto.warehouseId !== undefined &&
      dto.binLocationId === undefined &&
      binLocationId !== null
    ) {
      // Switching warehouse drops a default bin that sits in the old one.
      const current = await tx.scmWarehouseLocation.findFirst({
        where: { id: binLocationId },
        select: { warehouseId: true },
      });
      if (current && current.warehouseId !== warehouseId) binLocationId = null;
    }
    if (binLocationId !== null) {
      await this.assertBinInWarehouse(tx, scope, binLocationId, warehouseId);
    }

    // ---- expiry
    let expiryDate = before?.expiryDate ?? null;
    let expiryNotApplicable = before?.expiryNotApplicable ?? false;
    if (dto.expiryNotApplicable !== undefined)
      expiryNotApplicable = dto.expiryNotApplicable;
    if (dto.expiryDate !== undefined) {
      expiryDate = dto.expiryDate ? new Date(dto.expiryDate) : null;
    }
    if (expiryNotApplicable) expiryDate = null;

    return {
      barcode,
      barcodeCreatedAt,
      warehouseId,
      binLocationId,
      expiryDate,
      expiryNotApplicable,
    };
  }

  /** The bin must exist, be active and belong to the chosen warehouse, and
   * so must every ancestor (a Rack -> Bin chain carries one warehouse). */
  private async assertBinInWarehouse(
    tx: Prisma.TransactionClient,
    scope: OrgScope,
    binLocationId: number,
    warehouseId: number | null,
  ) {
    if (warehouseId === null) {
      throw new BusinessRuleViolationException(
        "Select a warehouse before assigning a bin",
        "NO_WAREHOUSE",
      );
    }
    const loc = await tx.scmWarehouseLocation.findFirst({
      where: tenantWhere(scope, { id: binLocationId, deletedAt: null }),
    });
    if (!loc) {
      throw new BusinessRuleViolationException(
        "The selected bin location does not exist",
        "BIN_NOT_FOUND",
      );
    }
    const name = loc.locationCode || loc.binCode;
    if (loc.warehouseId !== warehouseId) {
      throw new BusinessRuleViolationException(
        `Location "${name}" belongs to a different warehouse than the one selected`,
        "BIN_WAREHOUSE_MISMATCH",
      );
    }
    if (loc.status === "Inactive") {
      throw new BusinessRuleViolationException(
        `Location "${name}" is inactive`,
        "BIN_INACTIVE",
      );
    }
    const seen = new Set<number>([loc.id]);
    let parentId = loc.parentLocationId;
    while (parentId && !seen.has(parentId)) {
      seen.add(parentId);
      const parent = await tx.scmWarehouseLocation.findFirst({
        where: { id: parentId },
      });
      if (!parent) break;
      if (parent.warehouseId !== warehouseId) {
        throw new BusinessRuleViolationException(
          `Location "${name}" sits under a rack/zone from a different warehouse — inconsistent location data`,
          "PARENT_WAREHOUSE_MISMATCH",
        );
      }
      parentId = parent.parentLocationId;
    }
  }
}
