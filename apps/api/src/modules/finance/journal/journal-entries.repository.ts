import { Injectable } from "@nestjs/common";
import { Prisma } from "@texawave-erp/database";
import { OrgScoped } from "../../../common/decorators/org-scoped.decorator.js";
import type { OrgScope } from "../../../common/tenancy/org-scope.js";
import { tenantWhere } from "../../../common/tenancy/tenant-where.js";
import { PrismaService } from "../../../shared/prisma/prisma.service.js";
import type { QueryJournalEntriesDto } from "./dto/query-journal-entries.dto.js";

export interface PreparedJournalLineData {
  accountId: number;
  lineOrder: number;
  description: string | null;
  debit: number;
  credit: number;
}

export interface CreateJournalData {
  entryNumber: string;
  entryDate: Date;
  entryType: string;
  narration: string;
  referenceNumber: string | null;
  totalDebit: number;
  totalCredit: number;
  lines: PreparedJournalLineData[];
}

export interface UpdateJournalData {
  entryDate?: Date;
  narration?: string;
  referenceNumber?: string | null;
  totalDebit?: number;
  totalCredit?: number;
  lines?: PreparedJournalLineData[];
}

export interface AccountBalanceDelta {
  accountId: number;
  delta: number;
}

/**
 * Journal Entries Repository — handles persistence and atomic transitions
 * for journal entries, lines, and general ledger account balances.
 */
@Injectable()
export class JournalEntriesRepository {
  constructor(private readonly prisma: PrismaService) {}

  @OrgScoped()
  async findMany(scope: OrgScope, query: QueryJournalEntriesDto) {
    const where = tenantWhere<Prisma.FinanceJournalEntryWhereInput>(scope, {
      ...(query.entryType ? { entryType: query.entryType } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.startDate || query.endDate
        ? {
            entryDate: {
              ...(query.startDate ? { gte: new Date(query.startDate) } : {}),
              ...(query.endDate ? { lte: new Date(query.endDate) } : {}),
            },
          }
        : {}),
      ...(query.search
        ? {
            OR: [
              { entryNumber: { contains: query.search, mode: "insensitive" } },
              { narration: { contains: query.search, mode: "insensitive" } },
              {
                referenceNumber: {
                  contains: query.search,
                  mode: "insensitive",
                },
              },
            ],
          }
        : {}),
    });

    const [items, total] = await Promise.all([
      this.prisma.financeJournalEntry.findMany({
        where,
        skip: query.skip,
        take: query.limit,
        orderBy: [{ entryDate: query.order ?? "desc" }, { id: "desc" }],
        include: {
          lines: {
            orderBy: { lineOrder: "asc" },
            include: {
              account: {
                select: {
                  id: true,
                  accountCode: true,
                  accountName: true,
                  accountType: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.financeJournalEntry.count({ where }),
    ]);

    return { items, total };
  }

  @OrgScoped()
  async findById(scope: OrgScope, id: number) {
    return this.prisma.financeJournalEntry.findFirst({
      where: tenantWhere<Prisma.FinanceJournalEntryWhereInput>(scope, { id }),
      include: {
        lines: {
          orderBy: { lineOrder: "asc" },
          include: {
            account: {
              select: {
                id: true,
                accountCode: true,
                accountName: true,
                accountType: true,
              },
            },
          },
        },
        reversedEntry: {
          select: {
            id: true,
            entryNumber: true,
            entryDate: true,
            status: true,
          },
        },
        reversalOf: {
          select: {
            id: true,
            entryNumber: true,
            entryDate: true,
            status: true,
          },
        },
      },
    });
  }

  @OrgScoped()
  async findByEntryNumber(scope: OrgScope, entryNumber: string) {
    return this.prisma.financeJournalEntry.findFirst({
      where: tenantWhere<Prisma.FinanceJournalEntryWhereInput>(scope, {
        entryNumber,
      }),
    });
  }

  @OrgScoped()
  async generateNextEntryNumber(
    scope: OrgScope,
    prefix = "JV",
  ): Promise<string> {
    const today = new Date();
    const yyyymm = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}`;
    const startPattern = `${prefix}-${yyyymm}-`;

    const count = await this.prisma.financeJournalEntry.count({
      where: tenantWhere<Prisma.FinanceJournalEntryWhereInput>(scope, {
        entryNumber: { startsWith: startPattern },
      }),
    });

    return `${startPattern}${String(count + 1).padStart(4, "0")}`;
  }

  @OrgScoped()
  async createDraft(
    scope: OrgScope,
    data: CreateJournalData,
    createdBy: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const entry = await tx.financeJournalEntry.create({
        data: {
          organizationId: scope.organizationId,
          entryNumber: data.entryNumber,
          entryDate: data.entryDate,
          entryType: data.entryType,
          narration: data.narration,
          referenceNumber: data.referenceNumber,
          totalDebit: data.totalDebit,
          totalCredit: data.totalCredit,
          status: "DRAFT",
          createdBy,
          updatedBy: createdBy,
          lines: {
            create: data.lines.map((l) => ({
              organizationId: scope.organizationId,
              accountId: l.accountId,
              lineOrder: l.lineOrder,
              description: l.description,
              debit: l.debit,
              credit: l.credit,
            })),
          },
        },
        include: {
          lines: {
            orderBy: { lineOrder: "asc" },
            include: {
              account: {
                select: {
                  id: true,
                  accountCode: true,
                  accountName: true,
                  accountType: true,
                },
              },
            },
          },
        },
      });

      return entry;
    });
  }

  @OrgScoped()
  async updateDraft(
    scope: OrgScope,
    id: number,
    data: UpdateJournalData,
    updatedBy: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      if (data.lines && data.lines.length > 0) {
        // Replace existing lines
        await tx.financeJournalLine.deleteMany({
          where: { journalEntryId: id },
        });

        await tx.financeJournalLine.createMany({
          data: data.lines.map((l) => ({
            organizationId: scope.organizationId,
            journalEntryId: id,
            accountId: l.accountId,
            lineOrder: l.lineOrder,
            description: l.description,
            debit: l.debit,
            credit: l.credit,
          })),
        });
      }

      await tx.financeJournalEntry.updateMany({
        where: tenantWhere<Prisma.FinanceJournalEntryWhereInput>(scope, {
          id,
          status: "DRAFT",
        }),
        data: {
          ...(data.entryDate ? { entryDate: data.entryDate } : {}),
          ...(data.narration ? { narration: data.narration } : {}),
          ...(data.referenceNumber !== undefined
            ? { referenceNumber: data.referenceNumber }
            : {}),
          ...(data.totalDebit !== undefined
            ? { totalDebit: data.totalDebit }
            : {}),
          ...(data.totalCredit !== undefined
            ? { totalCredit: data.totalCredit }
            : {}),
          updatedBy,
        },
      });

      return tx.financeJournalEntry.findFirst({
        where: tenantWhere<Prisma.FinanceJournalEntryWhereInput>(scope, { id }),
        include: {
          lines: {
            orderBy: { lineOrder: "asc" },
            include: {
              account: {
                select: {
                  id: true,
                  accountCode: true,
                  accountName: true,
                  accountType: true,
                },
              },
            },
          },
        },
      });
    });
  }

  @OrgScoped()
  async postEntry(
    scope: OrgScope,
    id: number,
    balanceDeltas: AccountBalanceDelta[],
    postedBy: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Transition status from DRAFT to POSTED
      const updateResult = await tx.financeJournalEntry.updateMany({
        where: tenantWhere<Prisma.FinanceJournalEntryWhereInput>(scope, {
          id,
          status: "DRAFT",
        }),
        data: {
          status: "POSTED",
          postedAt: new Date(),
          postedBy,
          updatedBy: postedBy,
        },
      });

      if (updateResult.count === 0) {
        return null;
      }

      // 2. Synchronize Account Balances atomically
      for (const { accountId, delta } of balanceDeltas) {
        await tx.financeAccount.updateMany({
          where: tenantWhere<Prisma.FinanceAccountWhereInput>(scope, {
            id: accountId,
          }),
          data: {
            currentBalance: { increment: delta },
            updatedBy: postedBy,
          },
        });
      }

      // 3. Return updated posted voucher
      return tx.financeJournalEntry.findFirst({
        where: tenantWhere<Prisma.FinanceJournalEntryWhereInput>(scope, { id }),
        include: {
          lines: {
            orderBy: { lineOrder: "asc" },
            include: {
              account: {
                select: {
                  id: true,
                  accountCode: true,
                  accountName: true,
                  accountType: true,
                },
              },
            },
          },
        },
      });
    });
  }

  @OrgScoped()
  async reverseEntry(
    scope: OrgScope,
    originalId: number,
    reversalEntryNumber: string,
    reversalDate: Date,
    narration: string,
    reversedLines: PreparedJournalLineData[],
    totalDebit: number,
    totalCredit: number,
    balanceDeltas: AccountBalanceDelta[],
    reversedBy: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Create reversal journal voucher in POSTED state
      const reversalEntry = await tx.financeJournalEntry.create({
        data: {
          organizationId: scope.organizationId,
          entryNumber: reversalEntryNumber,
          entryDate: reversalDate,
          entryType: "REVERSAL",
          narration,
          referenceNumber: `REV:${originalId}`,
          totalDebit,
          totalCredit,
          status: "POSTED",
          postedAt: new Date(),
          postedBy: reversedBy,
          createdBy: reversedBy,
          updatedBy: reversedBy,
          lines: {
            create: reversedLines.map((l) => ({
              organizationId: scope.organizationId,
              accountId: l.accountId,
              lineOrder: l.lineOrder,
              description: l.description,
              debit: l.debit,
              credit: l.credit,
            })),
          },
        },
        include: {
          lines: {
            orderBy: { lineOrder: "asc" },
            include: {
              account: {
                select: {
                  id: true,
                  accountCode: true,
                  accountName: true,
                  accountType: true,
                },
              },
            },
          },
        },
      });

      // 2. Mark original voucher as REVERSED and link reversedEntryId
      await tx.financeJournalEntry.updateMany({
        where: tenantWhere<Prisma.FinanceJournalEntryWhereInput>(scope, {
          id: originalId,
          status: "POSTED",
          reversedEntryId: null,
        }),
        data: {
          status: "REVERSED",
          reversedEntryId: reversalEntry.id,
          updatedBy: reversedBy,
        },
      });

      // 3. Apply reverse balance deltas to General Ledger accounts
      for (const { accountId, delta } of balanceDeltas) {
        await tx.financeAccount.updateMany({
          where: tenantWhere<Prisma.FinanceAccountWhereInput>(scope, {
            id: accountId,
          }),
          data: {
            currentBalance: { increment: delta },
            updatedBy: reversedBy,
          },
        });
      }

      return reversalEntry;
    });
  }

  @OrgScoped()
  async deleteDraft(scope: OrgScope, id: number) {
    const result = await this.prisma.financeJournalEntry.deleteMany({
      where: tenantWhere<Prisma.FinanceJournalEntryWhereInput>(scope, {
        id,
        status: "DRAFT",
      }),
    });
    return result.count > 0;
  }
}
