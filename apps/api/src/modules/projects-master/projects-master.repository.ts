import { Injectable } from "@nestjs/common";
import { Prisma } from "@texawave-erp/database";
import { OrgScoped } from "../../common/decorators/org-scoped.decorator.js";
import type { PaginationDto } from "../../common/dto/pagination.dto.js";
import type { OrgScope } from "../../common/tenancy/org-scope.js";
import { tenantWhere } from "../../common/tenancy/tenant-where.js";
import { PrismaService } from "../../shared/prisma/prisma.service.js";
import type { CreateProjectsMasterDto } from "./dto/create-projects-master.dto.js";
import type { UpdateProjectsMasterDto } from "./dto/update-projects-master.dto.js";

export interface ProjectFilter {
  search?: string | undefined;
}

/** The only place `PrismaService` is called for this module
 * (Docs/CODING_STANDARDS.md §3). Every method that reads/writes tenant data
 * is `@OrgScoped()`. */
@Injectable()
export class ProjectsMasterRepository {
  constructor(private readonly prisma: PrismaService) {}

  @OrgScoped()
  async findMany(
    scope: OrgScope,
    filter: ProjectFilter,
    pagination: PaginationDto,
  ) {
    const where = tenantWhere<Prisma.ProjectWhereInput>(scope, {
      deletedAt: null,
      ...(filter.search
        ? {
            OR: [
              { name: { contains: filter.search, mode: "insensitive" } },
              { code: { contains: filter.search, mode: "insensitive" } },
            ],
          }
        : {}),
    });

    const [items, total] = await Promise.all([
      this.prisma.project.findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: { createdAt: pagination.order ?? "desc" },
      }),
      this.prisma.project.count({ where }),
    ]);

    return { items, total };
  }

  @OrgScoped()
  findOne(scope: OrgScope, id: number) {
    return this.prisma.project.findFirst({
      where: tenantWhere(scope, { id, deletedAt: null }),
    });
  }

  @OrgScoped()
  findByCode(scope: OrgScope, code: string) {
    return this.prisma.project.findFirst({
      where: tenantWhere(scope, { code, deletedAt: null }),
    });
  }

  @OrgScoped()
  create(scope: OrgScope, dto: CreateProjectsMasterDto, createdBy: number) {
    return this.prisma.project.create({
      data: {
        code: dto.code,
        name: dto.name,
        description: dto.description ?? null,
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
    dto: UpdateProjectsMasterDto,
    updatedBy: number,
  ) {
    const result = await this.prisma.project.updateMany({
      where: tenantWhere(scope, { id, deletedAt: null }),
      data: {
        ...dto,
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
    const result = await this.prisma.project.updateMany({
      where: tenantWhere(scope, { id, deletedAt: null }),
      data: { deletedAt: new Date(), updatedBy: deletedBy },
    });
    return result.count > 0;
  }
}
