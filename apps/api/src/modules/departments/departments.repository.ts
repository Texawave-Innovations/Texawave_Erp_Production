import { Injectable } from "@nestjs/common";
import { Prisma } from "@texawave-erp/database";
import { OrgScoped } from "../../common/decorators/org-scoped.decorator.js";
import type { PaginationDto } from "../../common/dto/pagination.dto.js";
import type { OrgScope } from "../../common/tenancy/org-scope.js";
import { tenantWhere } from "../../common/tenancy/tenant-where.js";
import { AuditWriter } from "../../platform/audit/audit-writer.js";
import { PrismaService } from "../../shared/prisma/prisma.service.js";
import type { CreateDepartmentDto } from "./dto/create-department.dto.js";
import type { UpdateDepartmentDto } from "./dto/update-department.dto.js";

/** Allow-listed audit snapshot: `customFields` is free-form and is never
 * copied into the trail. */
function auditShape(row: { name: string; isActive: boolean }) {
  return { name: row.name, isActive: row.isActive };
}

export interface DepartmentFilter {
  search?: string | undefined;
}

/** The only place `PrismaService` is called for this module
 * (Docs/CODING_STANDARDS.md §3). Every method that reads/writes tenant data
 * is `@OrgScoped()`. */
@Injectable()
export class DepartmentsRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditWriter,
  ) {}

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
    return this.prisma.$transaction(async (tx) => {
      // `@@unique([organizationId, name])` also covers soft-deleted rows, so
      // re-adding a removed department would hit the unique index and fail.
      // Bring the deleted row back instead (the service has already checked
      // that no LIVE department has this name).
      const removed = await tx.department.findFirst({
        where: tenantWhere<Prisma.DepartmentWhereInput>(scope, {
          name: dto.name,
          deletedAt: { not: null },
        }),
      });
      const row = removed
        ? await tx.department.update({
            where: { id: removed.id },
            data: {
              deletedAt: null,
              isActive: dto.isActive ?? true,
              customFields: (dto.customFields ?? {}) as Prisma.InputJsonValue,
              updatedBy: createdBy,
            },
          })
        : await tx.department.create({
            data: {
              name: dto.name,
              isActive: dto.isActive ?? true,
              customFields: (dto.customFields ?? {}) as Prisma.InputJsonValue,
              organizationId: scope.organizationId,
              createdBy,
              updatedBy: createdBy,
            },
          });
      await this.audit.write(tx, {
        entityType: "department",
        entityId: row.id,
        action: "create",
        after: auditShape(row),
      });
      return row;
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
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.department.findFirst({
        where: tenantWhere(scope, { id, deletedAt: null }),
      });
      if (!before) return null;
      const result = await tx.department.updateMany({
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
      const after = await tx.department.findFirst({
        where: tenantWhere(scope, { id, deletedAt: null }),
      });
      if (!after) return null;
      await this.audit.write(tx, {
        entityType: "department",
        entityId: id,
        action: "update",
        before: auditShape(before),
        after: auditShape(after),
      });
      return after;
    });
  }

  @OrgScoped()
  async softDelete(scope: OrgScope, id: number, deletedBy: number) {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.department.findFirst({
        where: tenantWhere(scope, { id, deletedAt: null }),
      });
      if (!before) return false;
      const result = await tx.department.updateMany({
        where: tenantWhere(scope, { id, deletedAt: null }),
        data: { deletedAt: new Date(), updatedBy: deletedBy },
      });
      if (result.count === 0) return false;
      await this.audit.write(tx, {
        entityType: "department",
        entityId: id,
        action: "delete",
        before: auditShape(before),
      });
      return true;
    });
  }
}
