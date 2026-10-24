import { Injectable } from "@nestjs/common";
import { type Prisma } from "@texawave-erp/database";
import { OrgScoped } from "../../../common/decorators/org-scoped.decorator.js";
import type { OrgScope } from "../../../common/tenancy/org-scope.js";
import { tenantWhere } from "../../../common/tenancy/tenant-where.js";
import { PrismaService } from "../../../shared/prisma/prisma.service.js";
import type { QueryExpensesDto } from "./dto/query-expenses.dto.js";

export interface ExpenseJournalLineData {
  accountId: number;
  lineOrder: number;
  description?: string | null;
  debit: number;
  credit: number;
}

export interface ExpenseJournalEntryData {
  entryNumber: string;
  entryDate: Date;
  entryType: "EXPENSE";
  narration: string;
  referenceNumber: string;
  totalDebit: number;
  totalCredit: number;
  lines: ExpenseJournalLineData[];
}

export interface ExpenseBalanceDelta {
  accountId: number;
  delta: number;
}

export interface ExpenseReversalData {
  originalJournalEntryId: number;
  reversalEntryNumber: string;
  reversalDate: Date;
  narration: string;
  totalDebit: number;
  totalCredit: number;
  lines: ExpenseJournalLineData[];
}

const EXPENSE_INCLUDE_RELATIONS = {
  expenseType: {
    select: {
      id: true,
      value: true,
    },
  },
  paymentMode: {
    select: {
      id: true,
      value: true,
    },
  },
  bankAccount: {
    select: {
      id: true,
      accountName: true,
      accountNumber: true,
      bankName: true,
    },
  },
  glAccount: {
    select: {
      id: true,
      accountCode: true,
      accountName: true,
      accountType: true,
    },
  },
  journalEntry: {
    select: {
      id: true,
      entryNumber: true,
      entryDate: true,
      status: true,
    },
  },
} as const;

/**
 * Expenses Repository — handles persistence and atomic GL transitions
 * for operating expenses, payment records, and journal integration.
 */
@Injectable()
export class ExpensesRepository {
  constructor(private readonly prisma: PrismaService) {}

  @OrgScoped()
  async findMany(scope: OrgScope, query: QueryExpensesDto) {
    const where = tenantWhere<Prisma.FinanceExpenseWhereInput>(scope, {
      deletedAt: null,
      ...(query.expenseTypeId ? { expenseTypeId: query.expenseTypeId } : {}),
      ...(query.paymentModeId ? { paymentModeId: query.paymentModeId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.startDate || query.endDate
        ? {
            expenseDate: {
              ...(query.startDate ? { gte: new Date(query.startDate) } : {}),
              ...(query.endDate ? { lte: new Date(query.endDate) } : {}),
            },
          }
        : {}),
      ...(query.search
        ? {
            OR: [
              {
                expenseNumber: { contains: query.search, mode: "insensitive" },
              },
              { vendorName: { contains: query.search, mode: "insensitive" } },
              { notes: { contains: query.search, mode: "insensitive" } },
            ],
          }
        : {}),
    });

    const [items, total] = await Promise.all([
      this.prisma.financeExpense.findMany({
        where,
        include: EXPENSE_INCLUDE_RELATIONS,
        orderBy: [{ expenseDate: "desc" }, { id: "desc" }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.financeExpense.count({ where }),
    ]);

    return { items, total };
  }

  @OrgScoped()
  async findById(scope: OrgScope, id: number) {
    return this.prisma.financeExpense.findFirst({
      where: tenantWhere<Prisma.FinanceExpenseWhereInput>(scope, {
        id,
        deletedAt: null,
      }),
      include: EXPENSE_INCLUDE_RELATIONS,
    });
  }

  @OrgScoped()
  async findByExpenseNumber(scope: OrgScope, expenseNumber: string) {
    return this.prisma.financeExpense.findFirst({
      where: tenantWhere<Prisma.FinanceExpenseWhereInput>(scope, {
        expenseNumber,
        deletedAt: null,
      }),
    });
  }

  @OrgScoped()
  async findByHrExpenseClaimId(scope: OrgScope, hrExpenseClaimId: number) {
    return this.prisma.financeExpense.findFirst({
      where: tenantWhere<Prisma.FinanceExpenseWhereInput>(scope, {
        hrExpenseClaimId,
        deletedAt: null,
      }),
      include: EXPENSE_INCLUDE_RELATIONS,
    });
  }

  @OrgScoped()
  async generateNextExpenseNumber(
    scope: OrgScope,
    prefix = "EXP",
  ): Promise<string> {
    const today = new Date();
    const yyyymm = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}`;
    const startPattern = `${prefix}-${yyyymm}-`;

    const count = await this.prisma.financeExpense.count({
      where: tenantWhere<Prisma.FinanceExpenseWhereInput>(scope, {
        expenseNumber: { startsWith: startPattern },
      }),
    });

    return `${startPattern}${String(count + 1).padStart(4, "0")}`;
  }

  @OrgScoped()
  async create(
    scope: OrgScope,
    data: Prisma.FinanceExpenseUncheckedCreateInput,
  ) {
    return this.prisma.financeExpense.create({
      data: {
        ...data,
        organizationId: scope.organizationId,
      },
      include: EXPENSE_INCLUDE_RELATIONS,
    });
  }

  @OrgScoped()
  async update(
    scope: OrgScope,
    id: number,
    data: Prisma.FinanceExpenseUncheckedUpdateInput,
  ) {
    const updateResult = await this.prisma.financeExpense.updateMany({
      where: tenantWhere<Prisma.FinanceExpenseWhereInput>(scope, {
        id,
        deletedAt: null,
      }),
      data,
    });

    if (updateResult.count === 0) {
      return null;
    }

    return this.findById(scope, id);
  }

  @OrgScoped()
  async updateStatus(
    scope: OrgScope,
    id: number,
    fromStatuses: string[],
    toStatus: string,
    updatedBy: number,
  ) {
    const updateResult = await this.prisma.financeExpense.updateMany({
      where: tenantWhere<Prisma.FinanceExpenseWhereInput>(scope, {
        id,
        status: { in: fromStatuses },
        deletedAt: null,
      }),
      data: {
        status: toStatus,
        updatedBy,
      },
    });

    if (updateResult.count === 0) {
      return null;
    }

    return this.findById(scope, id);
  }

  @OrgScoped()
  async softDelete(scope: OrgScope, id: number, updatedBy: number) {
    const updateResult = await this.prisma.financeExpense.updateMany({
      where: tenantWhere<Prisma.FinanceExpenseWhereInput>(scope, {
        id,
        status: { in: ["DRAFT", "CANCELLED"] },
        deletedAt: null,
      }),
      data: {
        deletedAt: new Date(),
        updatedBy,
      },
    });

    return updateResult.count > 0;
  }

  /**
   * Atomically records payment for an expense, creates the balanced GL journal voucher,
   * updates account balances, and links the journal entry ID to the expense.
   */
  @OrgScoped()
  async payAndPostExpense(
    scope: OrgScope,
    expenseId: number,
    journalData: ExpenseJournalEntryData,
    balanceDeltas: ExpenseBalanceDelta[],
    paymentUpdates: {
      paymentModeId?: number | null;
      bankAccountId?: number | null;
      glAccountId?: number | null;
    },
    updatedBy: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Create balanced POSTED journal voucher
      const journalEntry = await tx.financeJournalEntry.create({
        data: {
          organizationId: scope.organizationId,
          entryNumber: journalData.entryNumber,
          entryDate: journalData.entryDate,
          entryType: journalData.entryType,
          narration: journalData.narration,
          referenceNumber: journalData.referenceNumber,
          totalDebit: journalData.totalDebit,
          totalCredit: journalData.totalCredit,
          status: "POSTED",
          postedAt: new Date(),
          postedBy: updatedBy,
          createdBy: updatedBy,
          updatedBy,
        },
      });

      await tx.financeJournalLine.createMany({
        data: journalData.lines.map((line) => ({
          organizationId: scope.organizationId,
          journalEntryId: journalEntry.id,
          accountId: line.accountId,
          lineOrder: line.lineOrder,
          description: line.description ?? null,
          debit: line.debit,
          credit: line.credit,
        })),
      });

      // 2. Synchronize GL Account Balances
      for (const { accountId, delta } of balanceDeltas) {
        await tx.financeAccount.updateMany({
          where: tenantWhere<Prisma.FinanceAccountWhereInput>(scope, {
            id: accountId,
          }),
          data: {
            currentBalance: { increment: delta },
            updatedBy,
          },
        });
      }

      // 3. Mark Expense as PAID and link to journal entry
      const updateResult = await tx.financeExpense.updateMany({
        where: tenantWhere<Prisma.FinanceExpenseWhereInput>(scope, {
          id: expenseId,
          status: { in: ["DRAFT", "PENDING_APPROVAL", "APPROVED"] },
          deletedAt: null,
        }),
        data: {
          status: "PAID",
          journalEntryId: journalEntry.id,
          ...(paymentUpdates.paymentModeId !== undefined
            ? { paymentModeId: paymentUpdates.paymentModeId }
            : {}),
          ...(paymentUpdates.bankAccountId !== undefined
            ? { bankAccountId: paymentUpdates.bankAccountId }
            : {}),
          ...(paymentUpdates.glAccountId !== undefined
            ? { glAccountId: paymentUpdates.glAccountId }
            : {}),
          updatedBy,
        },
      });

      if (updateResult.count === 0) {
        throw new Error("COULD_NOT_UPDATE_EXPENSE_STATUS");
      }

      // 4. Return updated expense
      return tx.financeExpense.findFirst({
        where: tenantWhere<Prisma.FinanceExpenseWhereInput>(scope, {
          id: expenseId,
        }),
        include: EXPENSE_INCLUDE_RELATIONS,
      });
    });
  }

  /**
   * Atomically cancels an expense. If the expense was PAID and had a GL journal entry,
   * creates a REVERSAL journal entry and undoes account balance impacts.
   */
  @OrgScoped()
  async cancelAndReverseExpense(
    scope: OrgScope,
    expenseId: number,
    reversalData: ExpenseReversalData | null,
    balanceDeltas: ExpenseBalanceDelta[],
    updatedBy: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      // 1. If GL reversal is required
      if (reversalData) {
        // Mark original voucher as REVERSED
        await tx.financeJournalEntry.updateMany({
          where: tenantWhere<Prisma.FinanceJournalEntryWhereInput>(scope, {
            id: reversalData.originalJournalEntryId,
          }),
          data: {
            status: "REVERSED",
            updatedBy,
          },
        });

        // Create reversal voucher
        const reversalEntry = await tx.financeJournalEntry.create({
          data: {
            organizationId: scope.organizationId,
            entryNumber: reversalData.reversalEntryNumber,
            entryDate: reversalData.reversalDate,
            entryType: "REVERSAL",
            narration: reversalData.narration,
            referenceNumber: `REV-${reversalData.originalJournalEntryId}`,
            totalDebit: reversalData.totalDebit,
            totalCredit: reversalData.totalCredit,
            status: "POSTED",
            postedAt: new Date(),
            postedBy: updatedBy,
            reversedEntryId: reversalData.originalJournalEntryId,
            createdBy: updatedBy,
            updatedBy,
          },
        });

        await tx.financeJournalLine.createMany({
          data: reversalData.lines.map((line) => ({
            organizationId: scope.organizationId,
            journalEntryId: reversalEntry.id,
            accountId: line.accountId,
            lineOrder: line.lineOrder,
            description: line.description ?? null,
            debit: line.debit,
            credit: line.credit,
          })),
        });

        // Revert account balances
        for (const { accountId, delta } of balanceDeltas) {
          await tx.financeAccount.updateMany({
            where: tenantWhere<Prisma.FinanceAccountWhereInput>(scope, {
              id: accountId,
            }),
            data: {
              currentBalance: { increment: delta },
              updatedBy,
            },
          });
        }
      }

      // 2. Mark expense as CANCELLED
      const updateResult = await tx.financeExpense.updateMany({
        where: tenantWhere<Prisma.FinanceExpenseWhereInput>(scope, {
          id: expenseId,
          status: { not: "CANCELLED" },
          deletedAt: null,
        }),
        data: {
          status: "CANCELLED",
          updatedBy,
        },
      });

      if (updateResult.count === 0) {
        throw new Error("COULD_NOT_CANCEL_EXPENSE");
      }

      return tx.financeExpense.findFirst({
        where: tenantWhere<Prisma.FinanceExpenseWhereInput>(scope, {
          id: expenseId,
        }),
        include: EXPENSE_INCLUDE_RELATIONS,
      });
    });
  }
}
