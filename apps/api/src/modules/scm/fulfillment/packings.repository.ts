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
import type { CreatePackingDto } from "./dto/fulfillment.dto.js";
import { FulfillmentsRepository } from "./fulfillments.repository.js";

const include = {
  packages: { include: { items: true }, orderBy: { id: "asc" } },
  warehouse: { select: { id: true, name: true, code: true } },
  picking: { select: { id: true, pickNumber: true } },
  fulfillment: { select: { id: true, fulfillmentNumber: true, status: true } },
} satisfies Prisma.ScmPackingInclude;

const num = (d: Prisma.Decimal | number) => Number(d);

@Injectable()
export class PackingsRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditWriter,
    private readonly numbering: ScmNumberingService,
    private readonly fulfillments: FulfillmentsRepository,
  ) {}

  @OrgScoped()
  async findMany(
    scope: OrgScope,
    f: {
      q?: string | undefined;
      status?: string | undefined;
      fulfillmentId?: number | undefined;
    },
    page: PaginationDto,
  ) {
    const where = tenantWhere<Prisma.ScmPackingWhereInput>(scope, {
      ...(f.status ? { status: f.status } : {}),
      ...(f.fulfillmentId ? { fulfillmentId: f.fulfillmentId } : {}),
      ...(f.q
        ? {
            OR: [
              { packNumber: { contains: f.q, mode: "insensitive" } },
              { salesOrderNumber: { contains: f.q, mode: "insensitive" } },
              {
                picking: { pickNumber: { contains: f.q, mode: "insensitive" } },
              },
            ],
          }
        : {}),
    });
    const [items, total] = await Promise.all([
      this.prisma.scmPacking.findMany({
        where,
        skip: page.skip,
        take: page.limit,
        orderBy: { id: "desc" },
        include,
      }),
      this.prisma.scmPacking.count({ where }),
    ]);
    return { items, total };
  }

  @OrgScoped()
  findOne(scope: OrgScope, id: number) {
    return this.prisma.scmPacking.findFirst({
      where: tenantWhere(scope, { id }),
      include,
    });
  }

  /** One packing per COMPLETED pick. Packaged quantity per product may not
   * exceed the picked quantity; packing less than picked leaves the packing
   * IN_PROGRESS (and only the packed quantity is later issued). */
  @OrgScoped()
  async create(scope: OrgScope, dto: CreatePackingDto, actorId: number) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM scm.pickings WHERE id = ${dto.pickingId} AND organization_id = ${scope.organizationId} FOR UPDATE`;
      const pick = await tx.scmPicking.findFirst({
        where: tenantWhere(scope, { id: dto.pickingId }),
        include: { items: true },
      });
      if (!pick) {
        throw new BusinessRuleViolationException(
          "Pick list not found.",
          "PICK_NOT_FOUND",
        );
      }
      if (pick.status !== "COMPLETED" || pick.stockIssuedAt) {
        throw new BusinessRuleViolationException(
          "Select a completed pick list that has not been issued.",
          "PICK_NOT_PACKABLE",
        );
      }
      const existing = await tx.scmPacking.count({
        where: { pickingId: pick.id, status: { not: "CANCELLED" } },
      });
      if (existing > 0) {
        throw new BusinessRuleViolationException(
          "This pick list has already been packed.",
          "ALREADY_PACKED",
        );
      }

      const pickedByProduct = new Map<number, number>();
      for (const it of pick.items) {
        pickedByProduct.set(
          it.productId,
          (pickedByProduct.get(it.productId) ?? 0) + num(it.pickedQuantity),
        );
      }
      const packedByProduct = new Map<number, number>();
      const productMeta = new Map(pick.items.map((i) => [i.productId, i]));
      for (const pkg of dto.packages) {
        const lines = pkg.items.filter((i) => i.quantity > 0);
        if (lines.length === 0) {
          throw new BusinessRuleViolationException(
            `${pkg.packageNumber}: add at least one item quantity`,
            "PACKAGE_EMPTY",
          );
        }
        for (const it of lines) {
          if (!pickedByProduct.has(it.productId)) {
            throw new BusinessRuleViolationException(
              "A package contains a product that is not part of this pick.",
              "PACKAGE_PRODUCT",
            );
          }
          packedByProduct.set(
            it.productId,
            (packedByProduct.get(it.productId) ?? 0) + it.quantity,
          );
        }
      }
      for (const [productId, packed] of packedByProduct) {
        const picked = pickedByProduct.get(productId) ?? 0;
        if (packed > picked) {
          throw new BusinessRuleViolationException(
            `${productMeta.get(productId)?.productCode}: packaged quantity (${packed}) exceeds picked quantity (${picked})`,
            "PACK_OVER",
          );
        }
      }
      const short = [...pickedByProduct].some(
        ([id, picked]) => (packedByProduct.get(id) ?? 0) < picked,
      );
      const status = short ? "IN_PROGRESS" : "PACKED";

      const packNumber = await this.numbering.next(
        tx,
        scope.organizationId,
        "pack",
      );
      const created = await tx.scmPacking.create({
        data: {
          organizationId: scope.organizationId,
          packNumber,
          pickingId: pick.id,
          salesOrderId: pick.salesOrderId,
          salesOrderNumber: pick.salesOrderNumber,
          fulfillmentId: pick.fulfillmentId,
          warehouseId: pick.warehouseId,
          packerName: dto.packerName?.trim() || null,
          status,
          completedAt: status === "PACKED" ? new Date() : null,
          notes: dto.notes?.trim() || null,
          createdBy: actorId,
          updatedBy: actorId,
          packages: {
            create: dto.packages.map((pkg) => ({
              packageNumber: pkg.packageNumber,
              packageType: pkg.packageType?.trim() || null,
              weight: pkg.weight ?? null,
              length: pkg.length ?? null,
              width: pkg.width ?? null,
              height: pkg.height ?? null,
              items: {
                create: pkg.items
                  .filter((i) => i.quantity > 0)
                  .map((i) => ({
                    productId: i.productId,
                    productCode:
                      productMeta.get(i.productId)?.productCode ?? "",
                    productName:
                      productMeta.get(i.productId)?.productName ?? "",
                    quantity: i.quantity,
                  })),
              },
            })),
          },
        },
        include,
      });
      await this.fulfillments.syncProgress(tx, pick.fulfillmentId);
      await this.audit.write(tx, {
        entityType: "scm_packing",
        entityId: created.id,
        action: "create",
        after: { packNumber, pick: pick.pickNumber, status },
      });
      return created;
    });
  }

  @OrgScoped()
  async transition(
    scope: OrgScope,
    id: number,
    from: readonly string[],
    to: "PACKED" | "CANCELLED",
    actorId: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.scmPacking.findFirst({
        where: tenantWhere(scope, { id }),
      });
      if (!current) return null;
      if (!from.includes(current.status)) {
        throw new InvalidStateTransitionException(
          "Packing",
          current.status,
          to,
        );
      }
      const issued = await tx.scmPicking.count({
        where: { id: current.pickingId, stockIssuedAt: { not: null } },
      });
      if (issued > 0) {
        throw new BusinessRuleViolationException(
          "Stock has already been issued for this packing.",
          "ALREADY_ISSUED",
        );
      }
      const claimed = await tx.scmPacking.updateMany({
        where: {
          id,
          organizationId: scope.organizationId,
          status: { in: [...from] },
        },
        data: {
          status: to,
          updatedBy: actorId,
          ...(to === "PACKED" ? { completedAt: new Date() } : {}),
        },
      });
      if (claimed.count === 0) {
        throw new InvalidStateTransitionException("Packing", "changed", to);
      }
      await this.fulfillments.syncProgress(tx, current.fulfillmentId);
      await this.audit.write(tx, {
        entityType: "scm_packing",
        entityId: id,
        action: to === "PACKED" ? "packed" : "cancel",
        before: { status: current.status },
        after: { status: to },
      });
      return tx.scmPacking.findUniqueOrThrow({ where: { id }, include });
    });
  }

  /** A PACKED packing is already linked into order fulfillment / a shipment. */
  @OrgScoped()
  async remove(scope: OrgScope, id: number, actorId: number) {
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.scmPacking.findFirst({
        where: tenantWhere(scope, { id }),
        include: { _count: { select: { shipmentLinks: true } } },
      });
      if (!row) return false;
      if (row.status === "PACKED" || row._count.shipmentLinks > 0) {
        throw new BusinessRuleViolationException(
          "Cannot delete: this packing is already linked to order fulfillment.",
          "PACKING_LINKED",
        );
      }
      await tx.scmPacking.delete({ where: { id } });
      await this.audit.write(tx, {
        entityType: "scm_packing",
        entityId: id,
        action: "delete",
        before: { packNumber: row.packNumber, status: row.status, by: actorId },
      });
      return true;
    });
  }
}
