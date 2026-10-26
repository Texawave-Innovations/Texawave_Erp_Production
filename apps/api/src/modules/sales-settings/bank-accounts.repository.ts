import { Injectable } from "@nestjs/common";
import { Prisma } from "@texawave-erp/database";
import { OrgScoped } from "../../common/decorators/org-scoped.decorator.js";
import type { PaginationDto } from "../../common/dto/pagination.dto.js";
import type { OrgScope } from "../../common/tenancy/org-scope.js";
import { tenantWhere } from "../../common/tenancy/tenant-where.js";
import { PrismaService } from "../../shared/prisma/prisma.service.js";
import type { CreateBankAccountDto } from "./dto/create-bank-account.dto.js";
import type { UpdateBankAccountDto } from "./dto/update-bank-account.dto.js";

export interface BankAccountFilter {
  search?: string | undefined;
}

/** The only place `PrismaService` is called for this resource. */
@Injectable()
export class BankAccountsRepository {
  constructor(private readonly prisma: PrismaService) {}

  @OrgScoped()
  async findMany(
    scope: OrgScope,
    filter: BankAccountFilter,
    pagination: PaginationDto,
  ) {
    const where = tenantWhere<Prisma.BankAccountWhereInput>(scope, {
      deletedAt: null,
      ...(filter.search
        ? { bankName: { contains: filter.search, mode: "insensitive" } }
        : {}),
    });
    const [items, total] = await Promise.all([
      this.prisma.bankAccount.findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: { createdAt: pagination.order ?? "desc" },
      }),
      this.prisma.bankAccount.count({ where }),
    ]);
    return { items, total };
  }

  @OrgScoped()
  findOne(scope: OrgScope, id: number) {
    return this.prisma.bankAccount.findFirst({
      where: tenantWhere(scope, { id, deletedAt: null }),
    });
  }

  @OrgScoped()
  create(scope: OrgScope, dto: CreateBankAccountDto, createdBy: number) {
    return this.prisma.bankAccount.create({
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
    dto: UpdateBankAccountDto,
    updatedBy: number,
  ) {
    const { customFields, ...rest } = dto;
    const result = await this.prisma.bankAccount.updateMany({
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
    const result = await this.prisma.bankAccount.updateMany({
      where: tenantWhere(scope, { id, deletedAt: null }),
      data: { deletedAt: new Date(), updatedBy: deletedBy },
    });
    return result.count > 0;
  }
}
