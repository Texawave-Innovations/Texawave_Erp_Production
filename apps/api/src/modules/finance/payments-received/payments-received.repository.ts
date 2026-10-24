import { Injectable } from "@nestjs/common";
import { type Prisma } from "@texawave-erp/database";
import { OrgScoped } from "../../../common/decorators/org-scoped.decorator.js";
import type { OrgScope } from "../../../common/tenancy/org-scope.js";
import { tenantWhere } from "../../../common/tenancy/tenant-where.js";
import { PrismaService } from "../../../shared/prisma/prisma.service.js";
import type { QueryPaymentsReceivedDto } from "./dto/query-payments-received.dto.js";

export interface PaymentJournalLineData {
  accountId: number;
  lineOrder: number;
  description?: string | null;
  debit: number;
  credit: number;
}

export interface PaymentJournalEntryData {
  entryNumber: string;
  entryDate: Date;
  entryType: "PAYMENT_RECEIVED";
  narration: string;
  referenceNumber: string;
  totalDebit: number;
  totalCredit: number;
  lines: PaymentJournalLineData[];
}

export interface PaymentBalanceDelta {
  accountId: number;
  delta: number;
}

export interface PaymentReversalData {
  originalJournalEntryId: number;
  reversalEntryNumber: string;
  reversalDate: Date;
  narration: string;
  totalDebit: number;
  totalCredit: number;
  lines: PaymentJournalLineData[];
}

const PAYMENT_RECEIVED_INCLUDE = {
  customer: {
    select: {
      id: true,
      name: true,
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
  journalEntry: {
    select: {
      id: true,
      entryNumber: true,
      entryDate: true,
      status: true,
    },
  },
  allocations: {
    orderBy: {
      id: "asc" as const,
    },
  },
} as const;

/**
 * Payments Received Repository — handles persistence and atomic GL transitions
 * for customer payment inflows, invoice allocations, and journal synchronization.
 */
@Injectable()
export class PaymentsReceivedRepository {
  constructor(private readonly prisma: PrismaService) {}

  @OrgScoped()
  async findMany(scope: OrgScope, query: QueryPaymentsReceivedDto) {
    const where = tenantWhere<Prisma.FinancePaymentReceivedWhereInput>(scope, {
      deletedAt: null,
      ...(query.customerId ? { customerId: query.customerId } : {}),
      ...(query.paymentModeId ? { paymentModeId: query.paymentModeId } : {}),
      ...(query.bankAccountId ? { bankAccountId: query.bankAccountId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.startDate || query.endDate
        ? {
            paymentDate: {
              ...(query.startDate ? { gte: new Date(query.startDate) } : {}),
              ...(query.endDate ? { lte: new Date(query.endDate) } : {}),
            },
          }
        : {}),
      ...(query.search
        ? {
            OR: [
              {
                paymentNumber: { contains: query.search, mode: "insensitive" },
              },
              { customerName: { contains: query.search, mode: "insensitive" } },
              {
                referenceNumber: {
                  contains: query.search,
                  mode: "insensitive",
                },
              },
              {
                invoiceReference: {
                  contains: query.search,
                  mode: "insensitive",
                },
              },
              { notes: { contains: query.search, mode: "insensitive" } },
            ],
          }
        : {}),
    });

    const [items, total] = await Promise.all([
      this.prisma.financePaymentReceived.findMany({
        where,
        include: PAYMENT_RECEIVED_INCLUDE,
        orderBy: [{ paymentDate: "desc" }, { id: "desc" }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.financePaymentReceived.count({ where }),
    ]);

    return { items, total };
  }

  @OrgScoped()
  async findById(scope: OrgScope, id: number) {
    return this.prisma.financePaymentReceived.findFirst({
      where: tenantWhere<Prisma.FinancePaymentReceivedWhereInput>(scope, {
        id,
        deletedAt: null,
      }),
      include: PAYMENT_RECEIVED_INCLUDE,
    });
  }

  @OrgScoped()
  async findByPaymentNumber(scope: OrgScope, paymentNumber: string) {
    return this.prisma.financePaymentReceived.findFirst({
      where: tenantWhere<Prisma.FinancePaymentReceivedWhereInput>(scope, {
        paymentNumber,
        deletedAt: null,
      }),
    });
  }

  @OrgScoped()
  async generateNextPaymentNumber(
    scope: OrgScope,
    prefix = "REC",
  ): Promise<string> {
    const today = new Date();
    const yyyymm = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}`;
    const startPattern = `${prefix}-${yyyymm}-`;

    const count = await this.prisma.financePaymentReceived.count({
      where: tenantWhere<Prisma.FinancePaymentReceivedWhereInput>(scope, {
        paymentNumber: { startsWith: startPattern },
      }),
    });

    return `${startPattern}${String(count + 1).padStart(4, "0")}`;
  }

  @OrgScoped()
  async create(
    scope: OrgScope,
    data: Prisma.FinancePaymentReceivedUncheckedCreateInput,
    initialAllocations: Array<{
      invoiceReference: string;
      allocatedAmount: number;
      notes?: string | null;
    }> = [],
  ) {
    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.financePaymentReceived.create({
        data: {
          ...data,
          organizationId: scope.organizationId,
        },
      });

      if (initialAllocations.length > 0) {
        await tx.financePaymentReceivedAllocation.createMany({
          data: initialAllocations.map((alloc) => ({
            organizationId: scope.organizationId,
            paymentReceivedId: payment.id,
            invoiceReference: alloc.invoiceReference,
            allocatedAmount: alloc.allocatedAmount,
            notes: alloc.notes ?? null,
            createdBy: data.createdBy,
          })),
        });
      }

      return tx.financePaymentReceived.findFirst({
        where: tenantWhere<Prisma.FinancePaymentReceivedWhereInput>(scope, {
          id: payment.id,
        }),
        include: PAYMENT_RECEIVED_INCLUDE,
      });
    });
  }

  @OrgScoped()
  async update(
    scope: OrgScope,
    id: number,
    data: Prisma.FinancePaymentReceivedUncheckedUpdateInput,
  ) {
    const updateResult = await this.prisma.financePaymentReceived.updateMany({
      where: tenantWhere<Prisma.FinancePaymentReceivedWhereInput>(scope, {
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
    const updateResult = await this.prisma.financePaymentReceived.updateMany({
      where: tenantWhere<Prisma.FinancePaymentReceivedWhereInput>(scope, {
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
    const updateResult = await this.prisma.financePaymentReceived.updateMany({
      where: tenantWhere<Prisma.FinancePaymentReceivedWhereInput>(scope, {
        id,
        status: { in: ["DRAFT", "VOID"] },
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
   * Atomically confirms a receipt, creates the balanced GL journal voucher,
   * updates account balances, and links the journal entry ID to the payment.
   */
  @OrgScoped()
  async postAndConfirmReceipt(
    scope: OrgScope,
    paymentId: number,
    journalData: PaymentJournalEntryData,
    balanceDeltas: PaymentBalanceDelta[],
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

      // 2. Insert journal lines
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

      // 3. Synchronize GL Account Balances
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

      // 4. Mark receipt as CONFIRMED and link to journal entry
      const updateResult = await tx.financePaymentReceived.updateMany({
        where: tenantWhere<Prisma.FinancePaymentReceivedWhereInput>(scope, {
          id: paymentId,
          status: "DRAFT",
          deletedAt: null,
        }),
        data: {
          status: "CONFIRMED",
          journalEntryId: journalEntry.id,
          updatedBy,
        },
      });

      if (updateResult.count === 0) {
        throw new Error("COULD_NOT_CONFIRM_RECEIPT");
      }

      return tx.financePaymentReceived.findFirst({
        where: tenantWhere<Prisma.FinancePaymentReceivedWhereInput>(scope, {
          id: paymentId,
        }),
        include: PAYMENT_RECEIVED_INCLUDE,
      });
    });
  }

  /**
   * Atomically voids a receipt. If the receipt had a GL journal entry,
   * creates a REVERSAL journal entry and undoes account balance impacts.
   */
  @OrgScoped()
  async voidAndReverseReceipt(
    scope: OrgScope,
    paymentId: number,
    reversalData: PaymentReversalData | null,
    balanceDeltas: PaymentBalanceDelta[],
    updatedBy: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
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

        // Create reversal lines
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

      // Mark payment received as VOID
      const updateResult = await tx.financePaymentReceived.updateMany({
        where: tenantWhere<Prisma.FinancePaymentReceivedWhereInput>(scope, {
          id: paymentId,
          status: { not: "VOID" },
          deletedAt: null,
        }),
        data: {
          status: "VOID",
          updatedBy,
        },
      });

      if (updateResult.count === 0) {
        throw new Error("COULD_NOT_VOID_RECEIPT");
      }

      return tx.financePaymentReceived.findFirst({
        where: tenantWhere<Prisma.FinancePaymentReceivedWhereInput>(scope, {
          id: paymentId,
        }),
        include: PAYMENT_RECEIVED_INCLUDE,
      });
    });
  }

  /**
   * Adds an invoice allocation and updates allocated/unallocated amounts atomically.
   */
  @OrgScoped()
  async addAllocation(
    scope: OrgScope,
    paymentId: number,
    allocationData: {
      invoiceReference: string;
      allocatedAmount: number;
      notes?: string | null;
    },
    updatedBy: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const allocation = await tx.financePaymentReceivedAllocation.create({
        data: {
          organizationId: scope.organizationId,
          paymentReceivedId: paymentId,
          invoiceReference: allocationData.invoiceReference,
          allocatedAmount: allocationData.allocatedAmount,
          notes: allocationData.notes ?? null,
          createdBy: updatedBy,
        },
      });

      await tx.financePaymentReceived.updateMany({
        where: tenantWhere<Prisma.FinancePaymentReceivedWhereInput>(scope, {
          id: paymentId,
        }),
        data: {
          allocatedAmount: { increment: allocationData.allocatedAmount },
          unallocatedAmount: { decrement: allocationData.allocatedAmount },
          updatedBy,
        },
      });

      return allocation;
    });
  }

  /**
   * Removes an invoice allocation and updates allocated/unallocated amounts atomically.
   */
  @OrgScoped()
  async removeAllocation(
    scope: OrgScope,
    paymentId: number,
    allocationId: number,
    allocatedAmount: number,
    updatedBy: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await tx.financePaymentReceivedAllocation.deleteMany({
        where: {
          id: allocationId,
          paymentReceivedId: paymentId,
          organizationId: scope.organizationId,
        },
      });

      await tx.financePaymentReceived.updateMany({
        where: tenantWhere<Prisma.FinancePaymentReceivedWhereInput>(scope, {
          id: paymentId,
        }),
        data: {
          allocatedAmount: { decrement: allocatedAmount },
          unallocatedAmount: { increment: allocatedAmount },
          updatedBy,
        },
      });

      return true;
    });
  }
}
