import { Injectable } from "@nestjs/common";
import { Prisma } from "@texawave-erp/database";
import { OrgScoped } from "../../../common/decorators/org-scoped.decorator.js";
import type { PaginationDto } from "../../../common/dto/pagination.dto.js";
import type { OrgScope } from "../../../common/tenancy/org-scope.js";
import { tenantWhere } from "../../../common/tenancy/tenant-where.js";
import { PrismaService } from "../../../shared/prisma/prisma.service.js";
import type { CreateTagDto } from "./dto/create-tag.dto.js";
import type { UpdateTagDto } from "./dto/update-tag.dto.js";

export interface TagFilter {
  // `| undefined` explicitly, not just `?:` — under exactOptionalPropertyTypes
  // that's what lets a caller pass `{ search: query.search }` where
  // `query.search` is itself `string | undefined` without having to prune
  // the key first.
  search?: string | undefined;
}

/** The only place `PrismaService` is called for this module
 * (Docs/CODING_STANDARDS.md §3). Every method that reads/writes tenant data
 * is `@OrgScoped()`. */
@Injectable()
export class TagsRepository {
  constructor(private readonly prisma: PrismaService) {}

  @OrgScoped()
  async findMany(
    scope: OrgScope,
    filter: TagFilter,
    pagination: PaginationDto,
  ) {
    const where = tenantWhere<Prisma.TagWhereInput>(scope, {
      deletedAt: null,
      ...(filter.search
        ? { name: { contains: filter.search, mode: "insensitive" } }
        : {}),
    });

    const [items, total] = await Promise.all([
      this.prisma.tag.findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: { createdAt: pagination.order ?? "desc" },
      }),
      this.prisma.tag.count({ where }),
    ]);

    return { items, total };
  }

  @OrgScoped()
  findOne(scope: OrgScope, id: string) {
    return this.prisma.tag.findFirst({
      where: tenantWhere(scope, { id, deletedAt: null }),
    });
  }

  @OrgScoped()
  findByName(scope: OrgScope, name: string) {
    return this.prisma.tag.findFirst({
      where: tenantWhere(scope, { name, deletedAt: null }),
    });
  }

  @OrgScoped()
  create(scope: OrgScope, dto: CreateTagDto, createdBy: string) {
    return this.prisma.tag.create({
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
    id: string,
    dto: UpdateTagDto,
    updatedBy: string,
  ) {
    const { customFields, ...rest } = dto;
    const result = await this.prisma.tag.updateMany({
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
  async softDelete(scope: OrgScope, id: string, deletedBy: string) {
    const result = await this.prisma.tag.updateMany({
      where: tenantWhere(scope, { id, deletedAt: null }),
      data: { deletedAt: new Date(), updatedBy: deletedBy },
    });
    return result.count > 0;
  }
}
