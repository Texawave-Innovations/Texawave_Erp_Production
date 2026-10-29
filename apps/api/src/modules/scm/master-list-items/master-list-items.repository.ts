import { Injectable } from "@nestjs/common";
import { Prisma } from "@texawave-erp/database";
import { OrgScoped } from "../../../common/decorators/org-scoped.decorator.js";
import type { OrgScope } from "../../../common/tenancy/org-scope.js";
import { tenantWhere } from "../../../common/tenancy/tenant-where.js";
import { PrismaService } from "../../../shared/prisma/prisma.service.js";
import type { CreateMasterListItemDto } from "./dto/create-master-list-item.dto.js";
import type { QueryMasterListItemDto } from "./dto/query-master-list-item.dto.js";
import type { UpdateMasterListItemDto } from "./dto/update-master-list-item.dto.js";

/** The only place `PrismaService` is called for this resource. */
@Injectable()
export class MasterListItemsRepository {
  constructor(private readonly prisma: PrismaService) {}

  @OrgScoped()
  async findMany(scope: OrgScope, query: QueryMasterListItemDto) {
    const where = tenantWhere<Prisma.ScmMasterListItemWhereInput>(scope, {
      category: query.category,
      deletedAt: null,
    });
    const [items, total] = await Promise.all([
      this.prisma.scmMasterListItem.findMany({
        where,
        skip: query.skip,
        take: query.limit,
        orderBy: { createdAt: query.order ?? "asc" },
      }),
      this.prisma.scmMasterListItem.count({ where }),
    ]);
    return { items, total };
  }

  @OrgScoped()
  findOne(scope: OrgScope, id: number) {
    return this.prisma.scmMasterListItem.findFirst({
      where: tenantWhere(scope, { id, deletedAt: null }),
    });
  }

  @OrgScoped()
  create(scope: OrgScope, dto: CreateMasterListItemDto, createdBy: number) {
    return this.prisma.scmMasterListItem.create({
      data: {
        ...dto,
        customFields: (dto.customFields ?? {}) as Prisma.InputJsonValue,
        organizationId: scope.organizationId,
        createdBy,
        updatedBy: createdBy,
      },
    });
  }

  @OrgScoped()
  async update(
    scope: OrgScope,
    id: number,
    dto: UpdateMasterListItemDto,
    updatedBy: number,
  ) {
    const { customFields, ...rest } = dto;
    const result = await this.prisma.scmMasterListItem.updateMany({
      where: tenantWhere(scope, { id, deletedAt: null }),
      data: {
        ...rest,
        ...(customFields !== undefined
          ? { customFields: customFields as Prisma.InputJsonValue }
          : {}),
        updatedBy,
      },
    });
    if (result.count === 0) return null;
    return this.findOne(scope, id);
  }

  /** Active, non-deleted values for one category — used by
   * `MasterListValueGuard` to validate the 4 SCM forms that read from this
   * masterlist (Supplier.type, ScmWarehouse.type,
   * ScmPackingPackage.packageType, ScmStockAdjustment.reason) instead of a
   * static `@IsIn()` list. */
  @OrgScoped()
  async activeValues(scope: OrgScope, category: string): Promise<Set<string>> {
    const rows = await this.prisma.scmMasterListItem.findMany({
      where: tenantWhere(scope, { category, isActive: true, deletedAt: null }),
      select: { value: true },
    });
    return new Set(rows.map((r) => r.value));
  }

  @OrgScoped()
  async softDelete(scope: OrgScope, id: number, deletedBy: number) {
    const result = await this.prisma.scmMasterListItem.updateMany({
      where: tenantWhere(scope, { id, deletedAt: null }),
      data: { deletedAt: new Date(), updatedBy: deletedBy },
    });
    return result.count > 0;
  }
}
