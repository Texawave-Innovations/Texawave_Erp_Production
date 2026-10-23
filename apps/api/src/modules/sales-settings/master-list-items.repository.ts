import { Injectable } from "@nestjs/common";
import { Prisma } from "@texawave-erp/database";
import { OrgScoped } from "../../common/decorators/org-scoped.decorator.js";
import type { OrgScope } from "../../common/tenancy/org-scope.js";
import { tenantWhere } from "../../common/tenancy/tenant-where.js";
import { PrismaService } from "../../shared/prisma/prisma.service.js";
import type { CreateMasterListItemDto } from "./dto/create-master-list-item.dto.js";
import type { QueryMasterListItemDto } from "./dto/query-master-list-item.dto.js";
import type { UpdateMasterListItemDto } from "./dto/update-master-list-item.dto.js";

/** The only place `PrismaService` is called for this resource. */
@Injectable()
export class MasterListItemsRepository {
  constructor(private readonly prisma: PrismaService) {}

  @OrgScoped()
  async findMany(scope: OrgScope, query: QueryMasterListItemDto) {
    const where = tenantWhere<Prisma.SalesMasterListItemWhereInput>(scope, {
      category: query.category,
      deletedAt: null,
    });
    const [items, total] = await Promise.all([
      this.prisma.salesMasterListItem.findMany({
        where,
        skip: query.skip,
        take: query.limit,
        orderBy: { createdAt: query.order ?? "asc" },
      }),
      this.prisma.salesMasterListItem.count({ where }),
    ]);
    return { items, total };
  }

  @OrgScoped()
  findOne(scope: OrgScope, id: number) {
    return this.prisma.salesMasterListItem.findFirst({
      where: tenantWhere(scope, { id, deletedAt: null }),
    });
  }

  @OrgScoped()
  create(scope: OrgScope, dto: CreateMasterListItemDto, createdBy: number) {
    return this.prisma.salesMasterListItem.create({
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
    const result = await this.prisma.salesMasterListItem.updateMany({
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

  @OrgScoped()
  async softDelete(scope: OrgScope, id: number, deletedBy: number) {
    const result = await this.prisma.salesMasterListItem.updateMany({
      where: tenantWhere(scope, { id, deletedAt: null }),
      data: { deletedAt: new Date(), updatedBy: deletedBy },
    });
    return result.count > 0;
  }
}
