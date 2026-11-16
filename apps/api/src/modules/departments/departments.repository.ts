import { Injectable } from "@nestjs/common";
import { Prisma } from "@texawave-erp/database";
import { OrgScoped } from "../../common/decorators/org-scoped.decorator.js";
import type { PaginationDto } from "../../common/dto/pagination.dto.js";
import type { OrgScope } from "../../common/tenancy/org-scope.js";
import { tenantWhere } from "../../common/tenancy/tenant-where.js";
import { PrismaService } from "../../shared/prisma/prisma.service.js";
import type { CreateDepartmentDto } from "./dto/create-department.dto.js";
import type { UpdateDepartmentDto } from "./dto/update-department.dto.js";

export interface DepartmentFilter {
  search?: string | undefined;
}

/** The only place `PrismaService` is called for this module
 * (Docs/CODING_STANDARDS.md §3). Every method that reads/writes tenant data
 * is `@OrgScoped()`. */
@Injectable()
export class DepartmentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  @OrgScoped()
  async findMany(
    scope: OrgScope,
    filter: DepartmentFilter,
    pagination: PaginationDto,
  ) {
    const where = tenantWhere<Prisma.DepartmentWhereInput>(scope, {
      deletedAt: null,
      ...(filter.search
        ? { name: { contains: filter.search, mode: "insensitive" } }
        : {}),
    });

    const [items, total] = await Promise.all([
      this.prisma.department.findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: { createdAt: pagination.order ?? "desc" },
      }),
      this.prisma.department.count({ where }),
    ]);

    return { items, total };
  }

  @OrgScoped()
  findActiveNames(scope: OrgScope) {
    return this.prisma.department.findMany({
      where: tenantWhere<Prisma.DepartmentWhereInput>(scope, {
        deletedAt: null,
        isActive: true,
      }),
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
  }

  @OrgScoped()
  findOne(scope: OrgScope, id: number) {
    return this.prisma.department.findFirst({
      where: tenantWhere(scope, { id, deletedAt: null }),
    });
  }

  @OrgScoped()
  findByName(scope: OrgScope, name: string) {
    return this.prisma.department.findFirst({
      where: tenantWhere(scope, { name, deletedAt: null }),
    });
  }

  @OrgScoped()
  async create(scope: OrgScope, dto: CreateDepartmentDto, createdBy: number) {
    // `@@unique([organizationId, name])` also covers soft-deleted rows, so
    // re-adding a removed department would hit the unique index and fail.
    // Bring the deleted row back instead (the service has already checked
    // that no LIVE department has this name).
    const removed = await this.prisma.department.findFirst({
      where: tenantWhere<Prisma.DepartmentWhereInput>(scope, {
        name: dto.name,
        deletedAt: { not: null },
      }),
    });
    if (removed) {
      return this.prisma.department.update({
        where: { id: removed.id },
        data: {
          deletedAt: null,
          isActive: dto.isActive ?? true,
          customFields: (dto.customFields ?? {}) as Prisma.InputJsonValue,
          updatedBy: createdBy,
        },
      });
    }
    return this.prisma.department.create({
      data: {
        name: dto.name,
        isActive: dto.isActive ?? true,
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
    dto: UpdateDepartmentDto,
    updatedBy: number,
  ) {
    const { customFields, ...rest } = dto;
    const result = await this.prisma.department.updateMany({
      where: tenantWhere(scope, { id, deletedAt: null }),
      data: {
        ...rest,
        ...(customFields !== undefined
          ? { customFields: customFields as Prisma.InputJsonValue }
          : {}),
        updatedBy,
      },
    });
    if (result.count === 0) {
      return null;
    }
    return this.findOne(scope, id);
  }

  @OrgScoped()
  async softDelete(scope: OrgScope, id: number, deletedBy: number) {
    const result = await this.prisma.department.updateMany({
      where: tenantWhere(scope, { id, deletedAt: null }),
      data: { deletedAt: new Date(), updatedBy: deletedBy },
    });
    return result.count > 0;
  }
}
