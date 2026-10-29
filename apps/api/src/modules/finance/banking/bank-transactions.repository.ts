import { Injectable } from "@nestjs/common";
import { Prisma } from "@texawave-erp/database";
import { OrgScoped } from "../../../common/decorators/org-scoped.decorator.js";
import type { OrgScope } from "../../../common/tenancy/org-scope.js";
import { tenantWhere } from "../../../common/tenancy/tenant-where.js";
import { PrismaService } from "../../../shared/prisma/prisma.service.js";
import type { QueryBankTransactionsDto } from "./dto/query-bank-transactions.dto.js";

export interface BankTransactionJournalData {
  entryNumber: string;
  entryDate: Date;
  entryType: "BANK_TRANSFER" | "MANUAL";
  narration: string;
  referenceNumber?: string | null;
  totalDebit: number;
  totalCredit: number;
  lines: Array<{
    accountId: number;
    lineOrder: number;
    description?: string | null;
    debit: number;
    credit: number;
  }>;
  balanceDeltas: Array<{
    accountId: number;
    delta: number;
  }>;
}

@Injectable()
export class BankTransactionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  @OrgScoped()
  async findMany(scope: OrgScope, query: QueryBankTransactionsDto) {
    const whereConditions: Prisma.FinanceBankTransactionWhereInput = {};

    if (query.bankAccountId) {
      whereConditions.bankAccountId = query.bankAccountId;
    }
    if (query.transactionType) {
      whereConditions.transactionType = query.transactionType;
    }
    if (query.isReconciled !== undefined) {
      whereConditions.isReconciled = query.isReconciled;
    }
    if (query.startDate || query.endDate) {
      whereConditions.transactionDate = {};
      if (query.startDate) {
        whereConditions.transactionDate.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        whereConditions.transactionDate.lte = new Date(query.endDate);
      }
    }
    if (query.search) {
      whereConditions.OR = [
        { description: { contains: query.search, mode: "insensitive" } },
        { referenceNumber: { contains: query.search, mode: "insensitive" } },
      ];
    }

    const where = tenantWhere<Prisma.FinanceBankTransactionWhereInput>(
      scope,
      whereConditions,
    );

    const [items, total] = await Promise.all([
      this.prisma.financeBankTransaction.findMany({
        where,
        skip: query.skip,
        take: query.limit,
        orderBy: { transactionDate: query.order ?? "desc" },
        include: {
          bankAccount: {
            select: {
              id: true,
              accountName: true,
              accountNumber: true,
              bankName: true,
            },
          },
          matchedEntry: {
            select: {
              id: true,
              entryNumber: true,
              status: true,
            },
          },
        },
      }),
      this.prisma.financeBankTransaction.count({ where }),
    ]);

    return { items, total };
  }

  @OrgScoped()
  async findById(scope: OrgScope, id: number) {
    return this.prisma.financeBankTransaction.findFirst({
      where: tenantWhere<Prisma.FinanceBankTransactionWhereInput>(scope, {
        id,
      }),
      include: {
        bankAccount: {
          select: {
            id: true,
            accountName: true,
            accountNumber: true,
            bankName: true,
          },
        },
        matchedEntry: {
          select: {
            id: true,
            entryNumber: true,
            status: true,
          },
        },
      },
    });
  }

  @OrgScoped()
  async recordTransactionWithBalance(
    scope: OrgScope,
    bankAccountId: number,
    transactionData: {
      transactionDate: Date;
      transactionType: "CREDIT" | "DEBIT";
      amount: number;
      description: string;
      referenceNumber?: string | null;
      createdBy?: number;
    },
    journalData?: BankTransactionJournalData | null,
  ) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Fetch bank account and update current balance
      const account = await tx.financeBankAccount.findFirst({
        where: {
          id: bankAccountId,
          organizationId: scope.organizationId,
          deletedAt: null,
        },
      });
      if (!account) {
        throw new Error("BANK_ACCOUNT_NOT_FOUND");
      }

      const currentBal = Number(account.currentBalance);
      const delta =
        transactionData.transactionType === "CREDIT"
          ? transactionData.amount
          : -transactionData.amount;
      const newBalance = Number((currentBal + delta).toFixed(2));

      await tx.financeBankAccount.updateMany({
        where: { id: bankAccountId, organizationId: scope.organizationId },
        data: { currentBalance: newBalance },
      });

      // 2. Post GL Journal if provided
      let matchedJournalEntryId: number | null = null;
      if (journalData) {
        const journal = await tx.financeJournalEntry.create({
          data: {
            organizationId: scope.organizationId,
            entryNumber: journalData.entryNumber,
            entryDate: journalData.entryDate,
            entryType: journalData.entryType,
            narration: journalData.narration,
            referenceNumber: journalData.referenceNumber ?? null,
            totalDebit: journalData.totalDebit,
            totalCredit: journalData.totalCredit,
            status: "POSTED",
            postedAt: new Date(),
            postedBy: transactionData.createdBy ?? null,
            createdBy: transactionData.createdBy ?? null,
            updatedBy: transactionData.createdBy ?? null,
          },
        });

        await tx.financeJournalLine.createMany({
          data: journalData.lines.map((l) => ({
            organizationId: scope.organizationId,
            journalEntryId: journal.id,
            accountId: l.accountId,
            lineOrder: l.lineOrder,
            description: l.description ?? null,
            debit: l.debit,
            credit: l.credit,
          })),
        });

        for (const b of journalData.balanceDeltas) {
          await tx.financeAccount.updateMany({
            where: { id: b.accountId, organizationId: scope.organizationId },
            data: { currentBalance: { increment: b.delta } },
          });
        }

        matchedJournalEntryId = journal.id;
      }

      // 3. Create the bank transaction record
      const createdTx = await tx.financeBankTransaction.create({
        data: {
          organizationId: scope.organizationId,
          bankAccountId,
          transactionDate: transactionData.transactionDate,
          transactionType: transactionData.transactionType,
          amount: transactionData.amount,
          balanceAfter: newBalance,
          description: transactionData.description,
          referenceNumber: transactionData.referenceNumber ?? null,
          matchedJournalEntryId,
          isReconciled: matchedJournalEntryId !== null,
          reconciledAt: matchedJournalEntryId !== null ? new Date() : null,
          createdBy: transactionData.createdBy ?? null,
        },
        include: {
          bankAccount: {
            select: {
              id: true,
              accountName: true,
              accountNumber: true,
              bankName: true,
            },
          },
          matchedEntry: {
            select: {
              id: true,
              entryNumber: true,
              status: true,
            },
          },
        },
      });

      return createdTx;
    });
  }

  @OrgScoped()
  async reconcile(
    scope: OrgScope,
    id: number,
    matchedJournalEntryId?: number | null,
  ) {
    const updateData: Prisma.FinanceBankTransactionUpdateInput = {
      isReconciled: true,
      reconciledAt: new Date(),
    };
    if (matchedJournalEntryId !== undefined) {
      updateData.matchedEntry = matchedJournalEntryId
        ? { connect: { id: matchedJournalEntryId } }
        : { disconnect: true };
    }

    const result = await this.prisma.financeBankTransaction.updateMany({
      where: tenantWhere<Prisma.FinanceBankTransactionWhereInput>(scope, {
        id,
      }),
      data: {
        isReconciled: true,
        reconciledAt: new Date(),
        ...(matchedJournalEntryId !== undefined
          ? { matchedJournalEntryId }
          : {}),
      },
    });

    if (result.count === 0) return null;
    return this.findById(scope, id);
  }

  @OrgScoped()
  async unreconcile(scope: OrgScope, id: number) {
    const result = await this.prisma.financeBankTransaction.updateMany({
      where: tenantWhere<Prisma.FinanceBankTransactionWhereInput>(scope, {
        id,
      }),
      data: {
        isReconciled: false,
        reconciledAt: null,
      },
    });

    if (result.count === 0) return null;
    return this.findById(scope, id);
  }
}
