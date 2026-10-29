import { Injectable } from "@nestjs/common";
import { Prisma } from "@texawave-erp/database";
import { OrgScoped } from "../../../common/decorators/org-scoped.decorator.js";
import type { OrgScope } from "../../../common/tenancy/org-scope.js";
import { tenantWhere } from "../../../common/tenancy/tenant-where.js";
import { PrismaService } from "../../../shared/prisma/prisma.service.js";
import type { QueryBankAccountsDto } from "./dto/query-bank-accounts.dto.js";

@Injectable()
export class BankAccountsRepository {
  constructor(private readonly prisma: PrismaService) {}

  @OrgScoped()
  async findMany(scope: OrgScope, query: QueryBankAccountsDto) {
    const whereConditions: Prisma.FinanceBankAccountWhereInput = {
      deletedAt: null,
    };

    if (query.accountType) {
      whereConditions.accountType = query.accountType;
    }
    if (query.isActive !== undefined) {
      whereConditions.isActive = query.isActive;
    }
    if (query.search) {
      whereConditions.OR = [
        { accountName: { contains: query.search, mode: "insensitive" } },
        { bankName: { contains: query.search, mode: "insensitive" } },
        { accountNumber: { contains: query.search, mode: "insensitive" } },
      ];
    }

    const where = tenantWhere<Prisma.FinanceBankAccountWhereInput>(
      scope,
      whereConditions,
    );

    const [items, total] = await Promise.all([
      this.prisma.financeBankAccount.findMany({
        where,
        skip: query.skip,
        take: query.limit,
        orderBy: { createdAt: query.order ?? "desc" },
        include: {
          glAccount: {
            select: {
              id: true,
              accountCode: true,
              accountName: true,
              accountType: true,
            },
          },
        },
      }),
      this.prisma.financeBankAccount.count({ where }),
    ]);

    return { items, total };
  }

  @OrgScoped()
  async findById(scope: OrgScope, id: number) {
    return this.prisma.financeBankAccount.findFirst({
      where: tenantWhere<Prisma.FinanceBankAccountWhereInput>(scope, {
        id,
        deletedAt: null,
      }),
      include: {
        glAccount: {
          select: {
            id: true,
            accountCode: true,
            accountName: true,
            accountType: true,
          },
        },
      },
    });
  }

  @OrgScoped()
  async findByAccountNumber(scope: OrgScope, accountNumber: string) {
    return this.prisma.financeBankAccount.findFirst({
      where: tenantWhere<Prisma.FinanceBankAccountWhereInput>(scope, {
        accountNumber,
        deletedAt: null,
      }),
    });
  }

  @OrgScoped()
  async create(
    scope: OrgScope,
    data: Prisma.FinanceBankAccountUncheckedCreateInput,
  ) {
    return this.prisma.financeBankAccount.create({
      data: {
        ...data,
        organizationId: scope.organizationId,
      },
      include: {
        glAccount: {
          select: {
            id: true,
            accountCode: true,
            accountName: true,
            accountType: true,
          },
        },
      },
    });
  }

  @OrgScoped()
  async update(
    scope: OrgScope,
    id: number,
    data: Prisma.FinanceBankAccountUpdateInput,
  ) {
    const result = await this.prisma.financeBankAccount.updateMany({
      where: tenantWhere<Prisma.FinanceBankAccountWhereInput>(scope, {
        id,
        deletedAt: null,
      }),
      data,
    });

    if (result.count === 0) return null;
    return this.findById(scope, id);
  }

  @OrgScoped()
  async softDelete(scope: OrgScope, id: number, userId: number) {
    const result = await this.prisma.financeBankAccount.updateMany({
      where: tenantWhere<Prisma.FinanceBankAccountWhereInput>(scope, {
        id,
        deletedAt: null,
      }),
      data: {
        deletedAt: new Date(),
        updatedBy: userId,
      },
    });

    return result.count > 0;
  }
}
