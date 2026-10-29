import { Injectable } from "@nestjs/common";
import { Prisma } from "@texawave-erp/database";
import { PaginatedResponseDto } from "../../../common/dto/paginated-response.dto.js";
import {
  BusinessRuleViolationException,
  ResourceConflictException,
  ResourceNotFoundException,
} from "../../../common/exceptions/business.exception.js";
import { TenantContextService } from "../../../platform/tenancy/tenant-context.service.js";
import { PrismaService } from "../../../shared/prisma/prisma.service.js";
import {
  calculateAccountBalanceDelta,
  type FinanceAccountType,
} from "../finance.constants.js";
import { JournalEntriesRepository } from "../journal/journal-entries.repository.js";
import type { CreatePaymentAllocationDto } from "./dto/create-allocation.dto.js";
import type { CreatePaymentReceivedDto } from "./dto/create-payment-received.dto.js";
import type { QueryPaymentsReceivedDto } from "./dto/query-payments-received.dto.js";
import type { UpdatePaymentReceivedDto } from "./dto/update-payment-received.dto.js";
import {
  PaymentsReceivedRepository,
  type PaymentBalanceDelta,
  type PaymentJournalEntryData,
  type PaymentJournalLineData,
  type PaymentReversalData,
} from "./payments-received.repository.js";

/**
 * Payments Received Service — business rules, invoice allocations, and
 * double-entry General Ledger integration for customer receipts.
 */
@Injectable()
export class PaymentsReceivedService {
  constructor(
    private readonly repository: PaymentsReceivedRepository,
    private readonly journalRepository: JournalEntriesRepository,
    private readonly tenantContext: TenantContextService,
    private readonly prisma: PrismaService,
  ) {}

  async findAll(query: QueryPaymentsReceivedDto) {
    const scope = this.tenantContext.getOrgScope();
    const { items, total } = await this.repository.findMany(scope, query);
    return new PaginatedResponseDto(items, total, query.page, query.limit);
  }

  async findOne(id: number) {
    const scope = this.tenantContext.getOrgScope();
    const payment = await this.repository.findById(scope, id);
    if (!payment) {
      throw new ResourceNotFoundException("Payment received", id);
    }
    return payment;
  }

  async create(dto: CreatePaymentReceivedDto) {
    const scope = this.tenantContext.getOrgScope();
    const userId = this.tenantContext.getUserId();

    // 1. Validate payment date is not in the future
    const todayStr = new Date().toISOString().slice(0, 10);
    if (dto.paymentDate > todayStr) {
      throw new BusinessRuleViolationException(
        "Payment date cannot be in the future",
        "FUTURE_PAYMENT_DATE",
      );
    }

    // 2. Validate customer in CRM accounts if provided
    let customerName = dto.customerName;
    if (dto.customerId) {
      const customer = await this.prisma.account.findFirst({
        where: {
          id: dto.customerId,
          organizationId: scope.organizationId,
          deletedAt: null,
        },
      });
      if (!customer) {
        throw new ResourceNotFoundException("Customer account", dto.customerId);
      }
      customerName = customer.name;
    }

    // 3. Validate payment mode in Finance Master List
    const paymentMode = await this.prisma.financeMasterListItem.findFirst({
      where: {
        id: dto.paymentModeId,
        organizationId: scope.organizationId,
        category: "payment_mode",
        isActive: true,
        deletedAt: null,
      },
    });
    if (!paymentMode) {
      throw new ResourceNotFoundException("Payment mode", dto.paymentModeId);
    }

    // 4. Validate bank account if provided
    if (dto.bankAccountId) {
      const bankAccount = await this.prisma.financeBankAccount.findFirst({
        where: {
          id: dto.bankAccountId,
          organizationId: scope.organizationId,
          isActive: true,
          deletedAt: null,
        },
      });
      if (!bankAccount) {
        throw new ResourceNotFoundException("Bank account", dto.bankAccountId);
      }
    }

    // 5. Validate initial invoice allocations if provided
    const amount = Number(Number(dto.amount).toFixed(2));
    const initialAllocations: Array<{
      invoiceReference: string;
      allocatedAmount: number;
      notes?: string | null;
    }> = [];

    let sumAllocated = 0;
    if (dto.allocations && dto.allocations.length > 0) {
      for (const alloc of dto.allocations) {
        const allocAmt = Number(Number(alloc.allocatedAmount).toFixed(2));
        if (allocAmt <= 0) {
          throw new BusinessRuleViolationException(
            "Each allocation amount must be positive",
            "INVALID_ALLOCATION_AMOUNT",
          );
        }
        sumAllocated += allocAmt;
        initialAllocations.push({
          invoiceReference: alloc.invoiceReference.trim(),
          allocatedAmount: allocAmt,
          notes: alloc.notes ?? null,
        });
      }

      sumAllocated = Number(sumAllocated.toFixed(2));
      if (sumAllocated > amount) {
        throw new BusinessRuleViolationException(
          `Total allocated amount (${sumAllocated}) exceeds payment amount (${amount})`,
          "EXCEEDS_PAYMENT_AMOUNT",
        );
      }
    }

    const allocatedAmount = sumAllocated;
    const unallocatedAmount = Number((amount - allocatedAmount).toFixed(2));

    // 6. Payment Number resolution
    let paymentNumber = dto.paymentNumber;
    if (paymentNumber) {
      const existing = await this.repository.findByPaymentNumber(
        scope,
        paymentNumber,
      );
      if (existing) {
        throw new ResourceConflictException(
          `Payment with number '${paymentNumber}' already exists`,
        );
      }
    } else {
      paymentNumber = await this.repository.generateNextPaymentNumber(scope);
    }

    const initialStatus = dto.status ?? "CONFIRMED";

    // 7. Create payment record
    let created;
    try {
      created = await this.repository.create(
        scope,
        {
          organizationId: scope.organizationId,
          paymentNumber,
          paymentDate: new Date(dto.paymentDate),
          customerId: dto.customerId ?? null,
          customerName,
          amount,
          allocatedAmount,
          unallocatedAmount,
          paymentModeId: dto.paymentModeId,
          bankAccountId: dto.bankAccountId ?? null,
          referenceNumber: dto.referenceNumber ?? null,
          invoiceReference: dto.invoiceReference ?? null,
          notes: dto.notes ?? null,
          status: initialStatus === "CONFIRMED" ? "DRAFT" : initialStatus,
          createdBy: userId,
          updatedBy: userId,
        },
        initialAllocations,
      );
    } catch (err: unknown) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        throw new ResourceConflictException(
          `Payment with number '${paymentNumber}' already exists`,
        );
      }
      throw err;
    }

    if (!created) {
      throw new Error("COULD_NOT_CREATE_PAYMENT_RECORD");
    }

    // 8. If CONFIRMED status requested, execute atomic GL journal posting
    if (initialStatus === "CONFIRMED") {
      return this.confirm(created.id);
    }

    return created;
  }

  async update(id: number, dto: UpdatePaymentReceivedDto) {
    const scope = this.tenantContext.getOrgScope();
    const userId = this.tenantContext.getUserId();

    const existing = await this.findOne(id);
    if (existing.status !== "DRAFT") {
      throw new BusinessRuleViolationException(
        `Cannot modify a ${existing.status.toLowerCase()} payment receipt. Only draft receipts can be modified.`,
        "IMMUTABLE_PAYMENT_STATUS",
      );
    }

    if (dto.paymentDate) {
      const todayStr = new Date().toISOString().slice(0, 10);
      if (dto.paymentDate > todayStr) {
        throw new BusinessRuleViolationException(
          "Payment date cannot be in the future",
          "FUTURE_PAYMENT_DATE",
        );
      }
    }

    let customerName = dto.customerName;
    if (dto.customerId) {
      const customer = await this.prisma.account.findFirst({
        where: {
          id: dto.customerId,
          organizationId: scope.organizationId,
          deletedAt: null,
        },
      });
      if (!customer) {
        throw new ResourceNotFoundException("Customer account", dto.customerId);
      }
      customerName = customer.name;
    }

    return this.repository.update(scope, id, {
      ...(dto.paymentDate ? { paymentDate: new Date(dto.paymentDate) } : {}),
      ...(dto.customerId !== undefined ? { customerId: dto.customerId } : {}),
      ...(customerName !== undefined ? { customerName } : {}),
      ...(dto.referenceNumber !== undefined
        ? { referenceNumber: dto.referenceNumber }
        : {}),
      ...(dto.invoiceReference !== undefined
        ? { invoiceReference: dto.invoiceReference }
        : {}),
      ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
      updatedBy: userId,
    });
  }

  /**
   * Confirms a receipt and atomically creates a balanced double-entry
   * journal voucher in the General Ledger:
   *   Debit Bank/Cash Account:  amount  (Increases Asset)
   *   Credit Accounts Receivable: amount  (Decreases Asset)
   */
  async confirm(id: number) {
    const scope = this.tenantContext.getOrgScope();
    const userId = this.tenantContext.getUserId();

    const existing = await this.findOne(id);

    if (existing.status === "CONFIRMED" || existing.status === "RECONCILED") {
      throw new BusinessRuleViolationException(
        "Payment is already confirmed",
        "PAYMENT_ALREADY_CONFIRMED",
      );
    }
    if (existing.status === "VOID") {
      throw new BusinessRuleViolationException(
        "Cannot confirm a voided payment receipt",
        "PAYMENT_VOID",
      );
    }

    // 1. Resolve Bank/Cash GL Account (Debit)
    const debitAccount = await this.resolveGlDepositAccount(
      scope.organizationId,
      existing.bankAccountId,
      existing.paymentMode?.value,
    );

    // 2. Resolve Accounts Receivable GL Account (Credit)
    const creditAccount = await this.resolveGlReceivableAccount(
      scope.organizationId,
    );

    const amount = Number(existing.amount);

    // 3. Prepare balanced journal lines
    const entryDate = new Date(existing.paymentDate);
    const entryNumber = await this.journalRepository.generateNextEntryNumber(
      scope,
      "JV",
    );

    const lines: PaymentJournalLineData[] = [
      {
        accountId: debitAccount.id,
        lineOrder: 0,
        description: `Deposit: ${existing.paymentNumber} from ${existing.customerName}`,
        debit: amount,
        credit: 0,
      },
      {
        accountId: creditAccount.id,
        lineOrder: 1,
        description: `Accounts Receivable: ${existing.paymentNumber} (${existing.customerName})`,
        debit: 0,
        credit: amount,
      },
    ];

    const balanceDeltas: PaymentBalanceDelta[] = [
      {
        accountId: debitAccount.id,
        delta: calculateAccountBalanceDelta(
          debitAccount.accountType,
          amount,
          0,
        ),
      },
      {
        accountId: creditAccount.id,
        delta: calculateAccountBalanceDelta(
          creditAccount.accountType,
          0,
          amount,
        ),
      },
    ];

    const journalData: PaymentJournalEntryData = {
      entryNumber,
      entryDate,
      entryType: "PAYMENT_RECEIVED",
      narration: `Customer payment ${existing.paymentNumber} from ${existing.customerName}${existing.referenceNumber ? ` (Ref: ${existing.referenceNumber})` : ""}`,
      referenceNumber: existing.paymentNumber,
      totalDebit: amount,
      totalCredit: amount,
      lines,
    };

    const bankAccountDelta = existing.bankAccountId
      ? {
          id: existing.bankAccountId,
          delta: amount,
          paymentNumber: existing.paymentNumber,
          customerName: existing.customerName,
        }
      : null;

    return this.repository.postAndConfirmReceipt(
      scope,
      id,
      journalData,
      balanceDeltas,
      userId,
      bankAccountDelta,
    );
  }

  /**
   * Voids a receipt. If the receipt had an associated GL journal entry,
   * generates a balanced reversal journal entry and restores account balances.
   */
  async void(id: number) {
    const scope = this.tenantContext.getOrgScope();
    const userId = this.tenantContext.getUserId();

    const existing = await this.findOne(id);
    if (existing.status === "VOID") {
      throw new BusinessRuleViolationException(
        "Payment receipt is already voided",
        "PAYMENT_ALREADY_VOID",
      );
    }

    if (
      (existing.status === "CONFIRMED" || existing.status === "RECONCILED") &&
      existing.journalEntryId
    ) {
      // Reversal required
      const originalJournal = await this.prisma.financeJournalEntry.findFirst({
        where: {
          id: existing.journalEntryId,
          organizationId: scope.organizationId,
        },
        include: { lines: { include: { account: true } } },
      });

      if (!originalJournal) {
        throw new ResourceNotFoundException(
          "Associated journal voucher",
          existing.journalEntryId,
        );
      }

      const reversalEntryNumber =
        await this.journalRepository.generateNextEntryNumber(scope, "REV");
      const reversalDate = new Date();

      // Invert debits and credits
      const lines: PaymentJournalLineData[] = originalJournal.lines.map(
        (l, index) => ({
          accountId: l.accountId,
          lineOrder: index,
          description: `Reversal of ${originalJournal.entryNumber} line #${l.lineOrder}`,
          debit: Number(l.credit),
          credit: Number(l.debit),
        }),
      );

      const balanceDeltas: PaymentBalanceDelta[] = originalJournal.lines.map(
        (l) => {
          const delta = calculateAccountBalanceDelta(
            l.account.accountType,
            Number(l.credit),
            Number(l.debit),
          );
          return { accountId: l.accountId, delta };
        },
      );

      const reversalData: PaymentReversalData = {
        originalJournalEntryId: existing.journalEntryId,
        reversalEntryNumber,
        reversalDate,
        narration: `Void reversal of customer receipt ${existing.paymentNumber} voucher ${originalJournal.entryNumber}`,
        totalDebit: Number(originalJournal.totalDebit),
        totalCredit: Number(originalJournal.totalCredit),
        lines,
      };

      const bankAccountDelta = existing.bankAccountId
        ? {
            id: existing.bankAccountId,
            delta: -Number(originalJournal.totalDebit),
            paymentNumber: existing.paymentNumber,
            customerName: existing.customerName,
          }
        : null;

      return this.repository.voidAndReverseReceipt(
        scope,
        id,
        reversalData,
        balanceDeltas,
        userId,
        bankAccountDelta,
      );
    }

    // If DRAFT, void without GL reversal
    return this.repository.voidAndReverseReceipt(scope, id, null, [], userId);
  }

  /**
   * Allocates an invoice reference against unallocated receipt balance.
   */
  async addAllocation(id: number, dto: CreatePaymentAllocationDto) {
    const scope = this.tenantContext.getOrgScope();
    const userId = this.tenantContext.getUserId();

    const existing = await this.findOne(id);
    if (existing.status === "VOID") {
      throw new BusinessRuleViolationException(
        "Cannot allocate funds from a voided receipt",
        "PAYMENT_VOID",
      );
    }

    const allocAmount = Number(Number(dto.allocatedAmount).toFixed(2));
    if (allocAmount <= 0) {
      throw new BusinessRuleViolationException(
        "Allocated amount must be positive",
        "INVALID_ALLOCATED_AMOUNT",
      );
    }

    const unallocated = Number(existing.unallocatedAmount);
    if (allocAmount > unallocated) {
      throw new BusinessRuleViolationException(
        `Allocated amount (${allocAmount}) exceeds available unallocated balance (${unallocated})`,
        "EXCEEDS_UNALLOCATED_BALANCE",
      );
    }

    await this.repository.addAllocation(
      scope,
      id,
      {
        invoiceReference: dto.invoiceReference.trim(),
        allocatedAmount: allocAmount,
        notes: dto.notes ?? null,
      },
      userId,
    );

    return this.findOne(id);
  }

  /**
   * Removes an invoice allocation and restores the unallocated balance.
   */
  async removeAllocation(id: number, allocationId: number) {
    const scope = this.tenantContext.getOrgScope();
    const userId = this.tenantContext.getUserId();

    const existing = await this.findOne(id);
    if (existing.status === "VOID") {
      throw new BusinessRuleViolationException(
        "Cannot alter allocations on a voided receipt",
        "PAYMENT_VOID",
      );
    }

    const allocation = existing.allocations?.find((a) => a.id === allocationId);
    if (!allocation) {
      throw new ResourceNotFoundException("Payment allocation", allocationId);
    }

    await this.repository.removeAllocation(
      scope,
      id,
      allocationId,
      Number(allocation.allocatedAmount),
      userId,
    );

    return this.findOne(id);
  }

  async delete(id: number) {
    const scope = this.tenantContext.getOrgScope();
    const userId = this.tenantContext.getUserId();

    const existing = await this.findOne(id);
    if (existing.status === "CONFIRMED" || existing.status === "RECONCILED") {
      throw new BusinessRuleViolationException(
        "Cannot delete a confirmed payment receipt. Void it instead.",
        "CANNOT_DELETE_CONFIRMED_RECEIPT",
      );
    }

    return this.repository.softDelete(scope, id, userId);
  }

  // ---- Private Account Resolvers ------------------------------------------

  private async resolveGlDepositAccount(
    organizationId: number,
    bankAccountId?: number | null,
    paymentModeValue?: string,
  ): Promise<{ id: number; accountType: FinanceAccountType }> {
    // 1. Linked bank account GL account
    if (bankAccountId) {
      const ba = await this.prisma.financeBankAccount.findFirst({
        where: {
          id: bankAccountId,
          organizationId,
          isActive: true,
          deletedAt: null,
        },
      });
      if (ba?.glAccountId) {
        const gl = await this.prisma.financeAccount.findFirst({
          where: {
            id: ba.glAccountId,
            organizationId,
            isActive: true,
            deletedAt: null,
          },
        });
        if (gl) {
          return {
            id: gl.id,
            accountType: gl.accountType as FinanceAccountType,
          };
        }
      }
    }

    // 2. Cash on Hand -> "1010"
    if (paymentModeValue?.toLowerCase().includes("cash")) {
      const cashAcc = await this.prisma.financeAccount.findFirst({
        where: {
          organizationId,
          accountCode: "1010",
          isActive: true,
          deletedAt: null,
        },
      });
      if (cashAcc) {
        return {
          id: cashAcc.id,
          accountType: cashAcc.accountType as FinanceAccountType,
        };
      }
    }

    // 3. Operating Bank Account -> "1020"
    const bankAcc = await this.prisma.financeAccount.findFirst({
      where: {
        organizationId,
        accountCode: "1020",
        isActive: true,
        deletedAt: null,
      },
    });
    if (bankAcc) {
      return {
        id: bankAcc.id,
        accountType: bankAcc.accountType as FinanceAccountType,
      };
    }

    // 4. Fallback: Any ASSET account
    const anyAsset = await this.prisma.financeAccount.findFirst({
      where: {
        organizationId,
        accountType: "ASSET",
        isActive: true,
        deletedAt: null,
      },
      orderBy: { accountCode: "asc" },
    });
    if (anyAsset) {
      return {
        id: anyAsset.id,
        accountType: anyAsset.accountType as FinanceAccountType,
      };
    }

    throw new BusinessRuleViolationException(
      "No active Bank or Cash Asset account found in Chart of Accounts.",
      "MISSING_GL_DEPOSIT_ACCOUNT",
    );
  }

  private async resolveGlReceivableAccount(
    organizationId: number,
  ): Promise<{ id: number; accountType: FinanceAccountType }> {
    // 1. Accounts Receivable -> "1200"
    const arAcc = await this.prisma.financeAccount.findFirst({
      where: {
        organizationId,
        accountCode: "1200",
        isActive: true,
        deletedAt: null,
      },
    });
    if (arAcc) {
      return {
        id: arAcc.id,
        accountType: arAcc.accountType as FinanceAccountType,
      };
    }

    // 2. Fallback: Any ASSET account with "receivable" in name
    const namedAr = await this.prisma.financeAccount.findFirst({
      where: {
        organizationId,
        accountType: "ASSET",
        accountName: { contains: "receivable", mode: "insensitive" },
        isActive: true,
        deletedAt: null,
      },
    });
    if (namedAr) {
      return {
        id: namedAr.id,
        accountType: namedAr.accountType as FinanceAccountType,
      };
    }

    // 3. Fallback: Any ASSET account
    const anyAsset = await this.prisma.financeAccount.findFirst({
      where: {
        organizationId,
        accountType: "ASSET",
        isActive: true,
        deletedAt: null,
      },
      orderBy: { accountCode: "asc" },
    });
    if (anyAsset) {
      return {
        id: anyAsset.id,
        accountType: anyAsset.accountType as FinanceAccountType,
      };
    }

    throw new BusinessRuleViolationException(
      "No Accounts Receivable account found in Chart of Accounts (code 1200).",
      "MISSING_GL_RECEIVABLE_ACCOUNT",
    );
  }
}
