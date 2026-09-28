import { Injectable } from "@nestjs/common";
import { Prisma } from "@texawave-erp/database";
import { OrgScoped } from "../../common/decorators/org-scoped.decorator.js";
import type { PaginationDto } from "../../common/dto/pagination.dto.js";
import type { OrgScope } from "../../common/tenancy/org-scope.js";
import { tenantWhere } from "../../common/tenancy/tenant-where.js";
import { PrismaService } from "../../shared/prisma/prisma.service.js";
import type { CreateMenuItemDto } from "./dto/create-menu-item.dto.js";
import type { UpdateMenuItemDto } from "./dto/update-menu-item.dto.js";

export interface MenuItemFilter {
  search?: string | undefined;
}

@Injectable()
export class MenuRepository {
  constructor(private readonly prisma: PrismaService) {}

  @OrgScoped()
  async findMany(
    scope: OrgScope,
    filter: MenuItemFilter,
    pagination: PaginationDto,
  ) {
    const where = tenantWhere<Prisma.MenuItemWhereInput>(scope, {
      deletedAt: null,
      ...(filter.search
        ? {
            OR: [
              { label: { contains: filter.search, mode: "insensitive" } },
              { code: { contains: filter.search, mode: "insensitive" } },
            ],
          }
        : {}),
    });

    const [items, total] = await Promise.all([
      this.prisma.menuItem.findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: [{ order: "asc" }, { createdAt: "desc" }],
      }),
      this.prisma.menuItem.count({ where }),
    ]);

    return { items, total };
  }

  @OrgScoped()
  findActiveItems(scope: OrgScope) {
    return this.prisma.menuItem.findMany({
      where: tenantWhere(scope, {
        isActive: true,
        deletedAt: null,
      }),
      orderBy: { order: "asc" },
    });
  }

  @OrgScoped()
  findOne(scope: OrgScope, id: number) {
    return this.prisma.menuItem.findFirst({
      where: tenantWhere(scope, { id, deletedAt: null }),
      include: { children: true },
    });
  }

  @OrgScoped()
  findByCode(scope: OrgScope, code: string) {
    return this.prisma.menuItem.findFirst({
      where: tenantWhere(scope, { code, deletedAt: null }),
    });
  }

  @OrgScoped()
  create(scope: OrgScope, dto: CreateMenuItemDto, createdBy: number) {
    return this.prisma.menuItem.create({
      data: {
        organizationId: scope.organizationId,
        code: dto.code,
        label: dto.label,
        path: dto.path,
        icon: dto.icon,
        order: dto.order ?? 0,
        parentId: dto.parentId,
        permission: dto.permission,
        isActive: dto.isActive ?? true,
        customFields: (dto.customFields ?? {}) as Prisma.InputJsonValue,
        createdBy,
        updatedBy: createdBy,
      },
    });
  }

  @OrgScoped()
  async update(
    scope: OrgScope,
    id: number,
    dto: UpdateMenuItemDto,
    updatedBy: number,
  ) {
    const { customFields, ...rest } = dto;
    const result = await this.prisma.menuItem.updateMany({
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
    const result = await this.prisma.menuItem.updateMany({
      where: tenantWhere(scope, { id, deletedAt: null }),
      data: { deletedAt: new Date(), updatedBy: deletedBy },
    });
    return result.count > 0;
  }
}
