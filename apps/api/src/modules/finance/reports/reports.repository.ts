import { Injectable } from "@nestjs/common";
import { Prisma } from "@texawave-erp/database";
import { OrgScoped } from "../../../common/decorators/org-scoped.decorator.js";
import type { OrgScope } from "../../../common/tenancy/org-scope.js";
import { tenantWhere } from "../../../common/tenancy/tenant-where.js";
import { PrismaService } from "../../../shared/prisma/prisma.service.js";
import type { FinanceAccountType } from "../finance.constants.js";

@Injectable()
export class ReportsRepository {
  constructor(private readonly prisma: PrismaService) {}

  @OrgScoped()
  async getAccounts(scope: OrgScope, types?: FinanceAccountType[]) {
    const where: Prisma.FinanceAccountWhereInput = {
      deletedAt: null,
      isActive: true,
      ...(types && types.length > 0 ? { accountType: { in: types } } : {}),
    };

    return this.prisma.financeAccount.findMany({
      where: tenantWhere<Prisma.FinanceAccountWhereInput>(scope, where),
      orderBy: { accountCode: "asc" },
      select: {
        id: true,
        accountCode: true,
        accountName: true,
        accountType: true,
        currentBalance: true,
        parentAccountId: true,
      },
    });
  }

  @OrgScoped()
  async getAccountById(scope: OrgScope, id: number) {
    return this.prisma.financeAccount.findFirst({
      where: tenantWhere<Prisma.FinanceAccountWhereInput>(scope, {
        id,
        deletedAt: null,
      }),
      select: {
        id: true,
        accountCode: true,
        accountName: true,
        accountType: true,
        currentBalance: true,
      },
    });
  }

  @OrgScoped()
  async getAccountByCode(scope: OrgScope, accountCode: string) {
    return this.prisma.financeAccount.findFirst({
      where: tenantWhere<Prisma.FinanceAccountWhereInput>(scope, {
        accountCode,
        deletedAt: null,
      }),
      select: {
        id: true,
        accountCode: true,
        accountName: true,
        accountType: true,
        currentBalance: true,
      },
    });
  }

  /**
   * Fetches posted journal lines grouped by account within a date range.
   * Only includes journal entries with status = "POSTED".
   */
  @OrgScoped()
  async getPostedJournalLinesInDateRange(
    scope: OrgScope,
    startDate: Date,
    endDate: Date,
  ) {
    return this.prisma.financeJournalLine.findMany({
      where: tenantWhere<Prisma.FinanceJournalLineWhereInput>(scope, {
        journalEntry: {
          status: "POSTED",
          entryDate: {
            gte: startDate,
            lte: endDate,
          },
        },
      }),
      select: {
        accountId: true,
        debit: true,
        credit: true,
        journalEntry: {
          select: {
            id: true,
            entryNumber: true,
            entryDate: true,
            entryType: true,
            status: true,
          },
        },
        account: {
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

  /**
   * Fetches cumulative posted journal lines up to a specified date.
   * Used for Balance Sheet snapshots and cumulative equity.
   */
  @OrgScoped()
  async getPostedJournalLinesUpToDate(scope: OrgScope, asOfDate: Date) {
    return this.prisma.financeJournalLine.findMany({
      where: tenantWhere<Prisma.FinanceJournalLineWhereInput>(scope, {
        journalEntry: {
          status: "POSTED",
          entryDate: {
            lte: asOfDate,
          },
        },
      }),
      select: {
        accountId: true,
        debit: true,
        credit: true,
        journalEntry: {
          select: {
            id: true,
            entryNumber: true,
            entryDate: true,
            entryType: true,
            status: true,
          },
        },
        account: {
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

  /**
   * Fetches cumulative debit and credit sums prior to a start date for a specific account.
   */
  @OrgScoped()
  async getAccountPriorTotals(
    scope: OrgScope,
    accountId: number,
    startDate: Date,
  ) {
    const lines = await this.prisma.financeJournalLine.findMany({
      where: tenantWhere<Prisma.FinanceJournalLineWhereInput>(scope, {
        accountId,
        journalEntry: {
          status: "POSTED",
          entryDate: {
            lt: startDate,
          },
        },
      }),
      select: {
        debit: true,
        credit: true,
      },
    });

    let totalDebit = 0;
    let totalCredit = 0;
    for (const l of lines) {
      totalDebit += Number(l.debit);
      totalCredit += Number(l.credit);
    }

    return {
      totalDebit: Number(totalDebit.toFixed(2)),
      totalCredit: Number(totalCredit.toFixed(2)),
    };
  }

  /**
   * Fetches individual ledger transactions for an account in a date range with pagination.
   */
  @OrgScoped()
  async getAccountLedgerLines(
    scope: OrgScope,
    accountId: number,
    startDate: Date,
    endDate: Date,
    skip?: number,
    take?: number,
  ) {
    const where = tenantWhere<Prisma.FinanceJournalLineWhereInput>(scope, {
      accountId,
      journalEntry: {
        status: "POSTED",
        entryDate: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    const [lines, total] = await Promise.all([
      this.prisma.financeJournalLine.findMany({
        where,
        ...(skip !== undefined ? { skip } : {}),
        ...(take !== undefined ? { take } : {}),
        orderBy: [
          { journalEntry: { entryDate: "asc" } },
          { journalEntry: { id: "asc" } },
          { lineOrder: "asc" },
        ],
        select: {
          id: true,
          journalEntryId: true,
          lineOrder: true,
          description: true,
          debit: true,
          credit: true,
          journalEntry: {
            select: {
              id: true,
              entryNumber: true,
              entryDate: true,
              entryType: true,
              referenceNumber: true,
              narration: true,
            },
          },
        },
      }),
      this.prisma.financeJournalLine.count({ where }),
    ]);

    return { lines, total };
  }

  /**
   * Fetches active bank accounts for the Cash and Bank Summary.
   */
  @OrgScoped()
  async getBankAccounts(scope: OrgScope) {
    return this.prisma.financeBankAccount.findMany({
      where: tenantWhere<Prisma.FinanceBankAccountWhereInput>(scope, {
        deletedAt: null,
        isActive: true,
      }),
      select: {
        id: true,
        accountName: true,
        accountNumber: true,
        bankName: true,
        accountType: true,
        openingBalance: true,
        currentBalance: true,
        glAccountId: true,
      },
      orderBy: { accountName: "asc" },
    });
  }

  /**
   * Period summary metrics: draft journal entries, posted entries,
   * totals, and unreconciled bank transactions.
   */
  @OrgScoped()
  async getPeriodClosingAuditData(
    scope: OrgScope,
    startDate: Date,
    endDate: Date,
  ) {
    const [
      draftEntriesCount,
      postedEntriesCount,
      postedTotals,
      unreconciledBankTransactionsCount,
    ] = await Promise.all([
      // 1. Unposted draft entries in the period
      this.prisma.financeJournalEntry.count({
        where: tenantWhere<Prisma.FinanceJournalEntryWhereInput>(scope, {
          status: "DRAFT",
          entryDate: {
            gte: startDate,
            lte: endDate,
          },
        }),
      }),
      // 2. Posted entries count
      this.prisma.financeJournalEntry.count({
        where: tenantWhere<Prisma.FinanceJournalEntryWhereInput>(scope, {
          status: "POSTED",
          entryDate: {
            gte: startDate,
            lte: endDate,
          },
        }),
      }),
      // 3. Posted debit and credit totals
      this.prisma.financeJournalLine.aggregate({
        where: tenantWhere<Prisma.FinanceJournalLineWhereInput>(scope, {
          journalEntry: {
            status: "POSTED",
            entryDate: {
              gte: startDate,
              lte: endDate,
            },
          },
        }),
        _sum: {
          debit: true,
          credit: true,
        },
      }),
      // 4. Unreconciled bank transactions in the period
      this.prisma.financeBankTransaction.count({
        where: tenantWhere<Prisma.FinanceBankTransactionWhereInput>(scope, {
          isReconciled: false,
          transactionDate: {
            gte: startDate,
            lte: endDate,
          },
        }),
      }),
    ]);

    return {
      draftEntriesCount,
      postedEntriesCount,
      totalDebit: Number(Number(postedTotals._sum.debit ?? 0).toFixed(2)),
      totalCredit: Number(Number(postedTotals._sum.credit ?? 0).toFixed(2)),
      unreconciledBankTransactionsCount,
    };
  }
}
