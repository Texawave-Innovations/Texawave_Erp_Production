import { Injectable } from "@nestjs/common";
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
import type { CreatePaymentMadeDto } from "./dto/create-payment-made.dto.js";
import type { QueryPaymentsMadeDto } from "./dto/query-payments-made.dto.js";
import type { UpdatePaymentMadeDto } from "./dto/update-payment-made.dto.js";
import {
  PaymentsMadeRepository,
  type PaymentMadeBalanceDelta,
  type PaymentMadeJournalEntryData,
  type PaymentMadeJournalLineData,
  type PaymentMadeReversalData,
} from "./payments-made.repository.js";

/**
 * Payments Made Service — business rules, vendor disbursements,
 * bank balance deductions, and double-entry General Ledger integration.
 */
@Injectable()
export class PaymentsMadeService {
  constructor(
    private readonly repository: PaymentsMadeRepository,
    private readonly journalRepository: JournalEntriesRepository,
    private readonly tenantContext: TenantContextService,
    private readonly prisma: PrismaService,
  ) {}

  async findAll(query: QueryPaymentsMadeDto) {
    const scope = this.tenantContext.getOrgScope();
    const { items, total } = await this.repository.findMany(scope, query);
    return new PaginatedResponseDto(items, total, query.page, query.limit);
  }

  async findOne(id: number) {
    const scope = this.tenantContext.getOrgScope();
    const payment = await this.repository.findById(scope, id);
    if (!payment) {
      throw new ResourceNotFoundException("Payment made", id);
    }
    return payment;
  }

  async create(dto: CreatePaymentMadeDto) {
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

    // 2. Validate amount is positive
    const amount = Number(Number(dto.amount).toFixed(2));
    if (amount <= 0) {
      throw new BusinessRuleViolationException(
        "Payment amount must be greater than zero",
        "INVALID_PAYMENT_AMOUNT",
      );
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

    // 5. Validate linked ScmSupplierPayment if provided
    if (dto.scmSupplierPaymentId) {
      const scmPayment = await this.prisma.scmSupplierPayment.findFirst({
        where: {
          id: dto.scmSupplierPaymentId,
          organizationId: scope.organizationId,
        },
      });
      if (!scmPayment) {
        throw new ResourceNotFoundException(
          "Supplier payment",
          dto.scmSupplierPaymentId,
        );
      }
    }

    // 6. Payment number resolution
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
    const created = await this.repository.create(scope, {
      organizationId: scope.organizationId,
      paymentNumber,
      paymentDate: new Date(dto.paymentDate),
      vendorName: dto.vendorName.trim(),
      amount,
      paymentModeId: dto.paymentModeId,
      bankAccountId: dto.bankAccountId ?? null,
      referenceNumber: dto.referenceNumber ?? null,
      billReference: dto.billReference ?? null,
      scmSupplierPaymentId: dto.scmSupplierPaymentId ?? null,
      notes: dto.notes ?? null,
      status: initialStatus === "CONFIRMED" ? "DRAFT" : initialStatus,
      createdBy: userId,
      updatedBy: userId,
    });

    if (!created) {
      throw new Error("COULD_NOT_CREATE_PAYMENT_MADE_RECORD");
    }

    // 8. If CONFIRMED status requested, execute atomic GL journal posting & bank deduction
    if (initialStatus === "CONFIRMED") {
      return this.confirm(created.id);
    }

    return created;
  }

  async update(id: number, dto: UpdatePaymentMadeDto) {
    const scope = this.tenantContext.getOrgScope();
    const userId = this.tenantContext.getUserId();

    const existing = await this.findOne(id);
    if (existing.status === "VOID") {
      throw new BusinessRuleViolationException(
        "Cannot modify a voided payment disbursement",
        "IMMUTABLE_VOID_PAYMENT",
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

    return this.repository.update(scope, id, {
      ...(dto.paymentDate ? { paymentDate: new Date(dto.paymentDate) } : {}),
      ...(dto.vendorName !== undefined
        ? { vendorName: dto.vendorName.trim() }
        : {}),
      ...(dto.referenceNumber !== undefined
        ? { referenceNumber: dto.referenceNumber }
        : {}),
      ...(dto.billReference !== undefined
        ? { billReference: dto.billReference }
        : {}),
      ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
      updatedBy: userId,
    });
  }

  /**
   * Confirms an outgoing payment disbursement and atomically posts
   * a balanced double-entry journal voucher to the General Ledger:
   *   Debit Accounts Payable (2010):   amount  (Decreases Liability)
   *   Credit Bank/Cash Account:       amount  (Decreases Asset)
   * And decreases the bank account current balance with a DEBIT BankTransaction record.
   */
  async confirm(id: number) {
    const scope = this.tenantContext.getOrgScope();
    const userId = this.tenantContext.getUserId();

    const existing = await this.findOne(id);

    if (existing.status === "CONFIRMED") {
      throw new BusinessRuleViolationException(
        "Payment disbursement is already confirmed",
        "PAYMENT_ALREADY_CONFIRMED",
      );
    }
    if (existing.status === "VOID") {
      throw new BusinessRuleViolationException(
        "Cannot confirm a voided payment disbursement",
        "PAYMENT_VOID",
      );
    }

    // 1. Resolve Accounts Payable GL Account (Debit: decreases liability)
    const debitAccount = await this.resolveGlPayableAccount(
      scope.organizationId,
    );

    // 2. Resolve Bank/Cash GL Account (Credit: decreases asset)
    const creditAccount = await this.resolveGlDisbursementAccount(
      scope.organizationId,
      existing.bankAccountId,
      existing.paymentMode?.value,
    );

    const amount = Number(existing.amount);

    // 3. Prepare balanced journal lines
    const entryDate = new Date(existing.paymentDate);
    const entryNumber = await this.journalRepository.generateNextEntryNumber(
      scope,
      "JV",
    );

    const lines: PaymentMadeJournalLineData[] = [
      {
        accountId: debitAccount.id,
        lineOrder: 0,
        description: `Accounts Payable: ${existing.paymentNumber} to ${existing.vendorName}`,
        debit: amount,
        credit: 0,
      },
      {
        accountId: creditAccount.id,
        lineOrder: 1,
        description: `Disbursement: ${existing.paymentNumber} (${existing.vendorName})`,
        debit: 0,
        credit: amount,
      },
    ];

    const balanceDeltas: PaymentMadeBalanceDelta[] = [
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

    const journalData: PaymentMadeJournalEntryData = {
      entryNumber,
      entryDate,
      entryType: "PAYMENT_MADE",
      narration: `Vendor payment ${existing.paymentNumber} to ${existing.vendorName}${existing.referenceNumber ? ` (Ref: ${existing.referenceNumber})` : ""}${existing.billReference ? ` (Bill: ${existing.billReference})` : ""}`,
      referenceNumber: existing.paymentNumber,
      totalDebit: amount,
      totalCredit: amount,
      lines,
    };

    const bankAccountDelta = existing.bankAccountId
      ? {
          id: existing.bankAccountId,
          delta: -amount,
          paymentNumber: existing.paymentNumber,
          vendorName: existing.vendorName,
        }
      : null;

    return this.repository.postAndConfirmPayment(
      scope,
      id,
      journalData,
      balanceDeltas,
      bankAccountDelta,
      userId,
    );
  }

  /**
   * Voids an outgoing disbursement. If the payment was confirmed with an
   * associated GL journal entry, generates a balanced reversal journal entry,
   * restores GL account balances, and refunds the bank account balance.
   */
  async void(id: number) {
    const scope = this.tenantContext.getOrgScope();
    const userId = this.tenantContext.getUserId();

    const existing = await this.findOne(id);
    if (existing.status === "VOID") {
      throw new BusinessRuleViolationException(
        "Payment disbursement is already voided",
        "PAYMENT_ALREADY_VOID",
      );
    }

    if (existing.status === "CONFIRMED" && existing.journalEntryId) {
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
      const lines: PaymentMadeJournalLineData[] = originalJournal.lines.map(
        (l, index) => ({
          accountId: l.accountId,
          lineOrder: index,
          description: `Reversal of ${originalJournal.entryNumber} line #${l.lineOrder}`,
          debit: Number(l.credit),
          credit: Number(l.debit),
        }),
      );

      const balanceDeltas: PaymentMadeBalanceDelta[] =
        originalJournal.lines.map((l) => {
          const delta = calculateAccountBalanceDelta(
            l.account.accountType,
            Number(l.credit),
            Number(l.debit),
          );
          return { accountId: l.accountId, delta };
        });

      const reversalData: PaymentMadeReversalData = {
        originalJournalEntryId: existing.journalEntryId,
        reversalEntryNumber,
        reversalDate,
        narration: `Void reversal of vendor payment ${existing.paymentNumber} voucher ${originalJournal.entryNumber}`,
        totalDebit: Number(originalJournal.totalDebit),
        totalCredit: Number(originalJournal.totalCredit),
        lines,
      };

      const bankAccountDelta = existing.bankAccountId
        ? {
            id: existing.bankAccountId,
            delta: Number(existing.amount),
            paymentNumber: existing.paymentNumber,
            vendorName: existing.vendorName,
          }
        : null;

      return this.repository.voidAndReversePayment(
        scope,
        id,
        reversalData,
        balanceDeltas,
        bankAccountDelta,
        userId,
      );
    }

    // If DRAFT, void without GL reversal
    return this.repository.voidAndReversePayment(
      scope,
      id,
      null,
      [],
      null,
      userId,
    );
  }

  async delete(id: number) {
    const scope = this.tenantContext.getOrgScope();
    const userId = this.tenantContext.getUserId();

    const existing = await this.findOne(id);
    if (existing.status === "CONFIRMED") {
      throw new BusinessRuleViolationException(
        "Cannot delete a confirmed payment disbursement. Void it instead.",
        "CANNOT_DELETE_CONFIRMED_PAYMENT",
      );
    }

    return this.repository.softDelete(scope, id, userId);
  }

  // ---- Private Account Resolvers ------------------------------------------

  private async resolveGlPayableAccount(
    organizationId: number,
  ): Promise<{ id: number; accountType: FinanceAccountType }> {
    // 1. Accounts Payable -> "2010"
    const apAcc = await this.prisma.financeAccount.findFirst({
      where: {
        organizationId,
        accountCode: "2010",
        isActive: true,
        deletedAt: null,
      },
    });
    if (apAcc) {
      return {
        id: apAcc.id,
        accountType: apAcc.accountType as FinanceAccountType,
      };
    }

    // 2. Fallback: Any LIABILITY account with "payable" in name
    const namedAp = await this.prisma.financeAccount.findFirst({
      where: {
        organizationId,
        accountType: "LIABILITY",
        accountName: { contains: "payable", mode: "insensitive" },
        isActive: true,
        deletedAt: null,
      },
    });
    if (namedAp) {
      return {
        id: namedAp.id,
        accountType: namedAp.accountType as FinanceAccountType,
      };
    }

    // 3. Fallback: Any LIABILITY account
    const anyLiability = await this.prisma.financeAccount.findFirst({
      where: {
        organizationId,
        accountType: "LIABILITY",
        isActive: true,
        deletedAt: null,
      },
      orderBy: { accountCode: "asc" },
    });
    if (anyLiability) {
      return {
        id: anyLiability.id,
        accountType: anyLiability.accountType as FinanceAccountType,
      };
    }

    throw new BusinessRuleViolationException(
      "No Accounts Payable liability account found in Chart of Accounts (code 2010).",
      "MISSING_GL_PAYABLE_ACCOUNT",
    );
  }

  private async resolveGlDisbursementAccount(
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
      "MISSING_GL_DISBURSEMENT_ACCOUNT",
    );
  }
}
