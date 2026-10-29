import { Injectable } from "@nestjs/common";
import { Prisma } from "@texawave-erp/database";
import { OrgScoped } from "../../../common/decorators/org-scoped.decorator.js";
import type { OrgScope } from "../../../common/tenancy/org-scope.js";
import { tenantWhere } from "../../../common/tenancy/tenant-where.js";
import { PrismaService } from "../../../shared/prisma/prisma.service.js";
import type { CreateAccountDto } from "./dto/create-account.dto.js";
import type { QueryAccountsDto } from "./dto/query-accounts.dto.js";
import type { UpdateAccountDto } from "./dto/update-account.dto.js";

/**
 * Chart of Accounts Repository — tenant-isolated data access layer.
 * Enforces @OrgScoped on all operations and routes through tenantWhere.
 */
@Injectable()
export class AccountsRepository {
  constructor(private readonly prisma: PrismaService) {}

  @OrgScoped()
  async findMany(scope: OrgScope, query: QueryAccountsDto) {
    const where = tenantWhere<Prisma.FinanceAccountWhereInput>(scope, {
      deletedAt: null,
      ...(query.accountType ? { accountType: query.accountType } : {}),
      ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
      ...(query.search
        ? {
            OR: [
              { accountCode: { contains: query.search, mode: "insensitive" } },
              { accountName: { contains: query.search, mode: "insensitive" } },
            ],
          }
        : {}),
    });

    const [items, total] = await Promise.all([
      this.prisma.financeAccount.findMany({
        where,
        skip: query.skip,
        take: query.limit,
        orderBy: [{ accountCode: query.order ?? "asc" }],
        include: {
          parentAccount: {
            select: {
              id: true,
              accountCode: true,
              accountName: true,
              accountType: true,
            },
          },
        },
      }),
      this.prisma.financeAccount.count({ where }),
    ]);

    return { items, total };
  }

  @OrgScoped()
  async findAllRaw(scope: OrgScope) {
    return this.prisma.financeAccount.findMany({
      where: tenantWhere<Prisma.FinanceAccountWhereInput>(scope, {
        deletedAt: null,
      }),
      orderBy: [{ accountCode: "asc" }],
      include: {
        parentAccount: {
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
  async findById(scope: OrgScope, id: number) {
    return this.prisma.financeAccount.findFirst({
      where: tenantWhere<Prisma.FinanceAccountWhereInput>(scope, {
        id,
        deletedAt: null,
      }),
      include: {
        parentAccount: {
          select: {
            id: true,
            accountCode: true,
            accountName: true,
            accountType: true,
          },
        },
        subAccounts: {
          where: { deletedAt: null },
          select: {
            id: true,
            accountCode: true,
            accountName: true,
            accountType: true,
            isActive: true,
            currentBalance: true,
          },
        },
      },
    });
  }

  @OrgScoped()
  async findByCode(scope: OrgScope, accountCode: string) {
    return this.prisma.financeAccount.findFirst({
      where: tenantWhere<Prisma.FinanceAccountWhereInput>(scope, {
        accountCode,
        deletedAt: null,
      }),
    });
  }

  @OrgScoped()
  async create(scope: OrgScope, dto: CreateAccountDto, createdBy: number) {
    return this.prisma.financeAccount.create({
      data: {
        organizationId: scope.organizationId,
        accountCode: dto.accountCode,
        accountName: dto.accountName,
        accountType: dto.accountType,
        parentAccountId: dto.parentAccountId ?? null,
        currency: dto.currency ?? "INR",
        description: dto.description ?? null,
        createdBy,
        updatedBy: createdBy,
      },
      include: {
        parentAccount: {
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
    dto: UpdateAccountDto,
    updatedBy: number,
  ) {
    const data: Prisma.FinanceAccountUpdateManyMutationInput = {
      ...(dto.accountCode !== undefined
        ? { accountCode: dto.accountCode }
        : {}),
      ...(dto.accountName !== undefined
        ? { accountName: dto.accountName }
        : {}),
      ...(dto.parentAccountId !== undefined
        ? { parentAccountId: dto.parentAccountId }
        : {}),
      ...(dto.currency !== undefined ? { currency: dto.currency } : {}),
      ...(dto.description !== undefined
        ? { description: dto.description }
        : {}),
      ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      updatedBy,
    };

    const result = await this.prisma.financeAccount.updateMany({
      where: tenantWhere<Prisma.FinanceAccountWhereInput>(scope, {
        id,
        deletedAt: null,
      }),
      data,
    });

    if (result.count === 0) return null;
    return this.findById(scope, id);
  }

  @OrgScoped()
  async softDelete(scope: OrgScope, id: number, deletedBy: number) {
    const result = await this.prisma.financeAccount.updateMany({
      where: tenantWhere<Prisma.FinanceAccountWhereInput>(scope, {
        id,
        deletedAt: null,
      }),
      data: {
        deletedAt: new Date(),
        isActive: false,
        updatedBy: deletedBy,
      },
    });
    return result.count > 0;
  }

  @OrgScoped()
  async countSubAccounts(scope: OrgScope, id: number): Promise<number> {
    return this.prisma.financeAccount.count({
      where: tenantWhere<Prisma.FinanceAccountWhereInput>(scope, {
        parentAccountId: id,
        deletedAt: null,
      }),
    });
  }

  @OrgScoped()
  async countJournalLines(scope: OrgScope, id: number): Promise<number> {
    return this.prisma.financeJournalLine.count({
      where: tenantWhere<Prisma.FinanceJournalLineWhereInput>(scope, {
        accountId: id,
      }),
    });
  }

  @OrgScoped()
  async countLinkedBankAccounts(scope: OrgScope, id: number): Promise<number> {
    return this.prisma.financeBankAccount.count({
      where: tenantWhere<Prisma.FinanceBankAccountWhereInput>(scope, {
        glAccountId: id,
        deletedAt: null,
      }),
    });
  }

  @OrgScoped()
  async countLinkedExpenses(scope: OrgScope, id: number): Promise<number> {
    return this.prisma.financeExpense.count({
      where: tenantWhere<Prisma.FinanceExpenseWhereInput>(scope, {
        glAccountId: id,
        deletedAt: null,
      }),
    });
  }
}
