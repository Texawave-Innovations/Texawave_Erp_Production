import { Injectable } from "@nestjs/common";
import { Prisma } from "@texawave-erp/database";
import { OrgScoped } from "../../../common/decorators/org-scoped.decorator.js";
import type { OrgScope } from "../../../common/tenancy/org-scope.js";
import { tenantWhere } from "../../../common/tenancy/tenant-where.js";
import { PrismaService } from "../../../shared/prisma/prisma.service.js";
import type { QueryPaymentsMadeDto } from "./dto/query-payments-made.dto.js";

export interface PaymentMadeJournalLineData {
  accountId: number;
  lineOrder: number;
  description?: string | null;
  debit: number;
  credit: number;
}

export interface PaymentMadeBalanceDelta {
  accountId: number;
  delta: number;
}

export interface PaymentMadeJournalEntryData {
  entryNumber: string;
  entryDate: Date;
  entryType: "PAYMENT_MADE";
  narration: string;
  referenceNumber?: string | null;
  totalDebit: number;
  totalCredit: number;
  lines: PaymentMadeJournalLineData[];
}

export interface PaymentMadeReversalData {
  originalJournalEntryId: number;
  reversalEntryNumber: string;
  reversalDate: Date;
  narration: string;
  totalDebit: number;
  totalCredit: number;
  lines: PaymentMadeJournalLineData[];
}

@Injectable()
export class PaymentsMadeRepository {
  constructor(private readonly prisma: PrismaService) {}

  @OrgScoped()
  async findMany(scope: OrgScope, query: QueryPaymentsMadeDto) {
    const whereConditions: Prisma.FinancePaymentMadeWhereInput = {
      deletedAt: null,
    };

    if (query.paymentModeId) {
      whereConditions.paymentModeId = query.paymentModeId;
    }
    if (query.bankAccountId) {
      whereConditions.bankAccountId = query.bankAccountId;
    }
    if (query.status) {
      whereConditions.status = query.status;
    }
    if (query.startDate || query.endDate) {
      whereConditions.paymentDate = {};
      if (query.startDate) {
        whereConditions.paymentDate.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        whereConditions.paymentDate.lte = new Date(query.endDate);
      }
    }
    if (query.search) {
      whereConditions.OR = [
        { vendorName: { contains: query.search, mode: "insensitive" } },
        { paymentNumber: { contains: query.search, mode: "insensitive" } },
        { referenceNumber: { contains: query.search, mode: "insensitive" } },
        { billReference: { contains: query.search, mode: "insensitive" } },
      ];
    }

    const where = tenantWhere<Prisma.FinancePaymentMadeWhereInput>(
      scope,
      whereConditions,
    );

    const [items, total] = await Promise.all([
      this.prisma.financePaymentMade.findMany({
        where,
        skip: query.skip,
        take: query.limit,
        orderBy: { paymentDate: query.order ?? "desc" },
        include: {
          paymentMode: { select: { id: true, value: true } },
          bankAccount: {
            select: {
              id: true,
              accountName: true,
              accountNumber: true,
              bankName: true,
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
          scmPayment: {
            select: {
              id: true,
              paymentNumber: true,
              status: true,
            },
          },
        },
      }),
      this.prisma.financePaymentMade.count({ where }),
    ]);

    return { items, total };
  }

  @OrgScoped()
  async findById(scope: OrgScope, id: number) {
    return this.prisma.financePaymentMade.findFirst({
      where: tenantWhere<Prisma.FinancePaymentMadeWhereInput>(scope, {
        id,
        deletedAt: null,
      }),
      include: {
        paymentMode: { select: { id: true, value: true } },
        bankAccount: {
          select: {
            id: true,
            accountName: true,
            accountNumber: true,
            bankName: true,
            glAccountId: true,
          },
        },
        journalEntry: {
          select: {
            id: true,
            entryNumber: true,
            entryDate: true,
            status: true,
            totalDebit: true,
            totalCredit: true,
            lines: {
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
        },
        scmPayment: {
          select: {
            id: true,
            paymentNumber: true,
            status: true,
          },
        },
      },
    });
  }

  @OrgScoped()
  async findByPaymentNumber(scope: OrgScope, paymentNumber: string) {
    return this.prisma.financePaymentMade.findFirst({
      where: tenantWhere<Prisma.FinancePaymentMadeWhereInput>(scope, {
        paymentNumber,
        deletedAt: null,
      }),
    });
  }

  @OrgScoped()
  async generateNextPaymentNumber(scope: OrgScope): Promise<string> {
    const now = new Date();
    const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
    const prefix = `PM-${ym}-`;

    const last = await this.prisma.financePaymentMade.findFirst({
      where: {
        organizationId: scope.organizationId,
        paymentNumber: { startsWith: prefix },
      },
      orderBy: { paymentNumber: "desc" },
      select: { paymentNumber: true },
    });

    let nextSeq = 1;
    if (last?.paymentNumber) {
      const parts = last.paymentNumber.split("-");
      const currentSeq = parseInt(parts[parts.length - 1] ?? "0", 10);
      if (!isNaN(currentSeq)) {
        nextSeq = currentSeq + 1;
      }
    }

    return `${prefix}${String(nextSeq).padStart(4, "0")}`;
  }

  @OrgScoped()
  async create(
    scope: OrgScope,
    data: Prisma.FinancePaymentMadeUncheckedCreateInput,
  ) {
    return this.prisma.financePaymentMade.create({
      data: {
        ...data,
        organizationId: scope.organizationId,
      },
      include: {
        paymentMode: { select: { id: true, value: true } },
        bankAccount: {
          select: {
            id: true,
            accountName: true,
            accountNumber: true,
            bankName: true,
          },
        },
      },
    });
  }

  @OrgScoped()
  async update(
    scope: OrgScope,
    id: number,
    data: Prisma.FinancePaymentMadeUpdateInput,
  ) {
    const result = await this.prisma.financePaymentMade.updateMany({
      where: tenantWhere<Prisma.FinancePaymentMadeWhereInput>(scope, {
        id,
        deletedAt: null,
      }),
      data,
    });

    if (result.count === 0) return null;
    return this.findById(scope, id);
  }

  @OrgScoped()
  async postAndConfirmPayment(
    scope: OrgScope,
    id: number,
    journalData: PaymentMadeJournalEntryData,
    balanceDeltas: PaymentMadeBalanceDelta[],
    bankAccountDelta: {
      id: number;
      delta: number;
      paymentNumber: string;
      vendorName: string;
    } | null,
    userId: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Create balanced journal entry
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
          postedBy: userId,
          createdBy: userId,
          updatedBy: userId,
        },
      });

      // 2. Create journal lines
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

      // 3. Atomically update GL account balances
      for (const b of balanceDeltas) {
        await tx.financeAccount.updateMany({
          where: { id: b.accountId, organizationId: scope.organizationId },
          data: { currentBalance: { increment: b.delta } },
        });
      }

      // 4. Update bank account balance and create BankTransaction if bank account linked
      if (bankAccountDelta) {
        const bankAcc = await tx.financeBankAccount.findFirst({
          where: {
            id: bankAccountDelta.id,
            organizationId: scope.organizationId,
          },
        });
        if (bankAcc) {
          const newBankBalance = Number(
            (Number(bankAcc.currentBalance) + bankAccountDelta.delta).toFixed(
              2,
            ),
          );
          await tx.financeBankAccount.updateMany({
            where: {
              id: bankAccountDelta.id,
              organizationId: scope.organizationId,
            },
            data: { currentBalance: newBankBalance },
          });

          await tx.financeBankTransaction.create({
            data: {
              organizationId: scope.organizationId,
              bankAccountId: bankAccountDelta.id,
              transactionDate: journalData.entryDate,
              transactionType: "DEBIT",
              amount: journalData.totalDebit,
              balanceAfter: newBankBalance,
              description: `Disbursement ${bankAccountDelta.paymentNumber} to ${bankAccountDelta.vendorName}`,
              referenceNumber: journalData.referenceNumber ?? null,
              matchedJournalEntryId: journal.id,
              isReconciled: true,
              reconciledAt: new Date(),
              createdBy: userId,
            },
          });
        }
      }

      // 5. Update payment made status to CONFIRMED
      await tx.financePaymentMade.updateMany({
        where: { id, organizationId: scope.organizationId },
        data: {
          status: "CONFIRMED",
          journalEntryId: journal.id,
          updatedBy: userId,
        },
      });

      return tx.financePaymentMade.findFirst({
        where: { id, organizationId: scope.organizationId },
        include: {
          paymentMode: { select: { id: true, value: true } },
          bankAccount: {
            select: {
              id: true,
              accountName: true,
              accountNumber: true,
              bankName: true,
            },
          },
          journalEntry: {
            select: {
              id: true,
              entryNumber: true,
              entryDate: true,
              status: true,
              totalDebit: true,
              totalCredit: true,
            },
          },
        },
      });
    });
  }

  @OrgScoped()
  async voidAndReversePayment(
    scope: OrgScope,
    id: number,
    reversalData: PaymentMadeReversalData | null,
    balanceDeltas: PaymentMadeBalanceDelta[],
    bankAccountDelta: {
      id: number;
      delta: number;
      paymentNumber: string;
      vendorName: string;
    } | null,
    userId: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      if (reversalData) {
        // Mark original journal as REVERSED
        await tx.financeJournalEntry.updateMany({
          where: {
            id: reversalData.originalJournalEntryId,
            organizationId: scope.organizationId,
          },
          data: { status: "REVERSED", updatedBy: userId },
        });

        // Create reversal journal entry
        const revJournal = await tx.financeJournalEntry.create({
          data: {
            organizationId: scope.organizationId,
            entryNumber: reversalData.reversalEntryNumber,
            entryDate: reversalData.reversalDate,
            entryType: "REVERSAL",
            narration: reversalData.narration,
            referenceNumber: reversalData.originalJournalEntryId.toString(),
            reversedEntryId: reversalData.originalJournalEntryId,
            totalDebit: reversalData.totalDebit,
            totalCredit: reversalData.totalCredit,
            status: "POSTED",
            postedAt: new Date(),
            postedBy: userId,
            createdBy: userId,
            updatedBy: userId,
          },
        });

        // Create reversed journal lines
        await tx.financeJournalLine.createMany({
          data: reversalData.lines.map((l) => ({
            organizationId: scope.organizationId,
            journalEntryId: revJournal.id,
            accountId: l.accountId,
            lineOrder: l.lineOrder,
            description: l.description ?? null,
            debit: l.debit,
            credit: l.credit,
          })),
        });

        // Invert GL account balances
        for (const b of balanceDeltas) {
          await tx.financeAccount.updateMany({
            where: { id: b.accountId, organizationId: scope.organizationId },
            data: { currentBalance: { increment: b.delta } },
          });
        }

        // Restore bank account balance
        if (bankAccountDelta) {
          const bankAcc = await tx.financeBankAccount.findFirst({
            where: {
              id: bankAccountDelta.id,
              organizationId: scope.organizationId,
            },
          });
          if (bankAcc) {
            const newBankBalance = Number(
              (Number(bankAcc.currentBalance) + bankAccountDelta.delta).toFixed(
                2,
              ),
            );
            await tx.financeBankAccount.updateMany({
              where: {
                id: bankAccountDelta.id,
                organizationId: scope.organizationId,
              },
              data: { currentBalance: newBankBalance },
            });

            await tx.financeBankTransaction.create({
              data: {
                organizationId: scope.organizationId,
                bankAccountId: bankAccountDelta.id,
                transactionDate: reversalData.reversalDate,
                transactionType: "CREDIT",
                amount: reversalData.totalDebit,
                balanceAfter: newBankBalance,
                description: `Void reversal for ${bankAccountDelta.paymentNumber} (${bankAccountDelta.vendorName})`,
                referenceNumber: reversalData.reversalEntryNumber,
                matchedJournalEntryId: revJournal.id,
                isReconciled: true,
                reconciledAt: new Date(),
                createdBy: userId,
              },
            });
          }
        }
      }

      // Mark payment status as VOID
      await tx.financePaymentMade.updateMany({
        where: { id, organizationId: scope.organizationId },
        data: {
          status: "VOID",
          updatedBy: userId,
        },
      });

      return tx.financePaymentMade.findFirst({
        where: { id, organizationId: scope.organizationId },
      });
    });
  }

  @OrgScoped()
  async softDelete(scope: OrgScope, id: number, userId: number) {
    const result = await this.prisma.financePaymentMade.updateMany({
      where: tenantWhere<Prisma.FinancePaymentMadeWhereInput>(scope, {
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
