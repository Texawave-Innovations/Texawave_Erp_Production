import { Injectable } from "@nestjs/common";
import { Prisma } from "@texawave-erp/database";
import { OrgScoped } from "../../../common/decorators/org-scoped.decorator.js";
import type { PaginationDto } from "../../../common/dto/pagination.dto.js";
import { BusinessRuleViolationException } from "../../../common/exceptions/business.exception.js";
import type { OrgScope } from "../../../common/tenancy/org-scope.js";
import { tenantWhere } from "../../../common/tenancy/tenant-where.js";
import { AuditWriter } from "../../../platform/audit/audit-writer.js";
import { PrismaService } from "../../../shared/prisma/prisma.service.js";
import type { CreateProductDto, UpdateProductDto } from "./dto/product.dto.js";

const ENTITY_TYPE = "crm_product";

export interface ProductFilter {
  q?: string | undefined;
}

function snapshot(row: {
  name: string;
  code: string;
  unitPrice: Prisma.Decimal;
  isActive: boolean;
}) {
  return {
    name: row.name,
    code: row.code,
    unitPrice: row.unitPrice.toString(),
    isActive: row.isActive,
  };
}

/** Search across name/code/category/vendor, mirroring the legacy
 * Products.tsx search box (case-insensitive substring). */
function filterWhere(filter: ProductFilter): Prisma.ProductWhereInput {
  const clauses: Prisma.ProductWhereInput[] = [{ deletedAt: null }];
  if (filter.q) {
    clauses.push({
      OR: [
        { name: { contains: filter.q, mode: "insensitive" } },
        { code: { contains: filter.q, mode: "insensitive" } },
        { category: { contains: filter.q, mode: "insensitive" } },
        { vendor: { contains: filter.q, mode: "insensitive" } },
      ],
    });
  }
  return { AND: clauses };
}

/** Org-wide reference data, no team dimension — same shape as
 * AccountsRepository/PipelineStagesRepository. See the catalog.ts note
 * on crm.product.* for why `.own/.team/.all` does not apply here. */
@Injectable()
export class ProductsRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditWriter,
  ) {}

  @OrgScoped()
  async findMany(
    scope: OrgScope,
    filter: ProductFilter,
    pagination: PaginationDto,
  ) {
    const where = tenantWhere<Prisma.ProductWhereInput>(
      scope,
      filterWhere(filter),
    );
    const [items, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: [{ createdAt: pagination.order ?? "desc" }, { id: "asc" }],
      }),
      this.prisma.product.count({ where }),
    ]);
    return { items, total };
  }

  @OrgScoped()
  async findOne(scope: OrgScope, id: number) {
    return this.prisma.product.findFirst({
      where: tenantWhere(scope, { id, deletedAt: null }),
    });
  }

  @OrgScoped()
  async create(scope: OrgScope, dto: CreateProductDto, actorId: number) {
    return this.prisma.$transaction(async (tx) => {
      const created = await tx.product.create({
        data: {
          organizationId: scope.organizationId,
          name: dto.name,
          code: dto.code,
          category: dto.category ?? null,
          vendor: dto.vendor ?? null,
          unitPrice: dto.unitPrice,
          taxPercent: dto.taxPercent ?? null,
          description: dto.description ?? null,
          isActive: dto.isActive ?? true,
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
    dto: UpdateProductDto,
    actorId: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.product.findFirst({
        where: tenantWhere(scope, { id, deletedAt: null }),
      });
      if (!before) return null;
      const field = (
        value: string | undefined,
        current: string | null,
      ): string | null => (value === undefined ? current : value || null);
      const after = await tx.product.update({
        where: { id },
        data: {
          name: dto.name ?? before.name,
          code: dto.code ?? before.code,
          category: field(dto.category, before.category),
          vendor: field(dto.vendor, before.vendor),
          unitPrice: dto.unitPrice ?? before.unitPrice,
          taxPercent:
            dto.taxPercent === undefined ? before.taxPercent : dto.taxPercent,
          description: field(dto.description, before.description),
          isActive: dto.isActive ?? before.isActive,
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

  /**
   * Soft-delete only. Refuses when any live `OpportunityProduct` OR
   * `QuotationLineItem` still references this product — same rule and
   * message shape as legacy's `deleteCrmProduct`, which counts both
   * `dealProducts` and `quotationItems` (Docs/CRM_PRODUCTS_LEGACY_PARITY.md
   * §2.6). This closes that doc's Risk R3 now that `QuotationLineItem`
   * exists: a quote's line items are never individually soft-deleted
   * (see the model's own doc comment), so "live" here means the
   * line item's PARENT quotation is not itself soft-deleted — the same
   * "a deleted quote frees up its products" behavior legacy has, since a
   * soft-deleted quote's items leave the live `crm/quotationItems` tree
   * in legacy too.
   */
  @OrgScoped()
  async softDelete(scope: OrgScope, id: number, actorId: number) {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.product.findFirst({
        where: tenantWhere(scope, { id, deletedAt: null }),
      });
      if (!before) return null;
      const [dealLineUsage, quotationLineUsage] = await Promise.all([
        tx.opportunityProduct.count({
          where: { productId: id, deletedAt: null },
        }),
        tx.quotationLineItem.count({
          where: { productId: id, quotation: { deletedAt: null } },
        }),
      ]);
      const usageCount = dealLineUsage + quotationLineUsage;
      if (usageCount > 0) {
        throw new BusinessRuleViolationException(
          `"${before.name}" is used in ${usageCount} deal/quote line item${usageCount === 1 ? "" : "s"} and can't be deleted while referenced.`,
          "PRODUCT_IN_USE",
        );
      }
      const after = await tx.product.update({
        where: { id },
        data: { deletedAt: new Date(), isActive: false, updatedBy: actorId },
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
}
