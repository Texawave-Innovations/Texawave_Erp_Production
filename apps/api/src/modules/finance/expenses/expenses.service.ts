import { Injectable } from "@nestjs/common";
import { PaginatedResponseDto } from "../../../common/dto/paginated-response.dto.js";
import {
  BusinessRuleViolationException,
  InvalidStateTransitionException,
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
import type { CreateExpenseFromClaimDto } from "./dto/create-expense-from-claim.dto.js";
import type { CreateExpenseDto } from "./dto/create-expense.dto.js";
import type { QueryExpensesDto } from "./dto/query-expenses.dto.js";
import type { RecordExpensePaymentDto } from "./dto/record-expense-payment.dto.js";
import type { UpdateExpenseDto } from "./dto/update-expense.dto.js";
import {
  ExpensesRepository,
  type ExpenseBalanceDelta,
  type ExpenseJournalEntryData,
  type ExpenseJournalLineData,
  type ExpenseReversalData,
} from "./expenses.repository.js";

/**
 * Expenses Service — business logic, lifecycle transitions, HR claim integration,
 * and double-entry General Ledger synchronization for operating expenses.
 */
@Injectable()
export class ExpensesService {
  constructor(
    private readonly repository: ExpensesRepository,
    private readonly journalRepository: JournalEntriesRepository,
    private readonly tenantContext: TenantContextService,
    private readonly prisma: PrismaService,
  ) {}

  async findAll(query: QueryExpensesDto) {
    const scope = this.tenantContext.getOrgScope();
    const { items, total } = await this.repository.findMany(scope, query);
    return new PaginatedResponseDto(items, total, query.page, query.limit);
  }

  async findOne(id: number) {
    const scope = this.tenantContext.getOrgScope();
    const expense = await this.repository.findById(scope, id);
    if (!expense) {
      throw new ResourceNotFoundException("Expense", id);
    }
    return expense;
  }

  async create(dto: CreateExpenseDto) {
    const scope = this.tenantContext.getOrgScope();
    const userId = this.tenantContext.getUserId();

    // 1. Date cannot be in the future
    const todayStr = new Date().toISOString().slice(0, 10);
    if (dto.expenseDate > todayStr) {
      throw new BusinessRuleViolationException(
        "Expense date cannot be in the future",
        "FUTURE_EXPENSE_DATE",
      );
    }

    // 2. Validate expense type in Finance Master List
    const expenseType = await this.prisma.financeMasterListItem.findFirst({
      where: {
        id: dto.expenseTypeId,
        organizationId: scope.organizationId,
        category: "expense_type",
        isActive: true,
        deletedAt: null,
      },
    });
    if (!expenseType) {
      throw new ResourceNotFoundException("Expense type", dto.expenseTypeId);
    }

    // 3. Validate payment mode if provided
    if (dto.paymentModeId) {
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

    // 5. Validate GL Account if provided
    if (dto.glAccountId) {
      await this.validateGlExpenseAccount(
        scope.organizationId,
        dto.glAccountId,
      );
    }

    // 6. Expense Number resolution
    let expenseNumber = dto.expenseNumber;
    if (expenseNumber) {
      const existing = await this.repository.findByExpenseNumber(
        scope,
        expenseNumber,
      );
      if (existing) {
        throw new ResourceConflictException(
          `Expense with number '${expenseNumber}' already exists`,
        );
      }
    } else {
      expenseNumber = await this.repository.generateNextExpenseNumber(scope);
    }

    // 7. Calculate amounts
    const amount = Number(Number(dto.amount).toFixed(2));
    const taxAmount = Number(Number(dto.taxAmount ?? 0).toFixed(2));
    const netAmount = Number((amount + taxAmount).toFixed(2));

    const initialStatus = dto.status ?? "DRAFT";

    // 8. Create record
    const created = await this.repository.create(scope, {
      organizationId: scope.organizationId,
      expenseNumber,
      expenseTypeId: dto.expenseTypeId,
      expenseDate: new Date(dto.expenseDate),
      amount,
      taxAmount,
      netAmount,
      paymentModeId: dto.paymentModeId ?? null,
      bankAccountId: dto.bankAccountId ?? null,
      glAccountId: dto.glAccountId ?? null,
      vendorName: dto.vendorName ?? null,
      notes: dto.notes ?? null,
      receiptUrl: dto.receiptUrl ?? null,
      status: initialStatus === "PAID" ? "DRAFT" : initialStatus,
      createdBy: userId,
      updatedBy: userId,
    });

    // If initial status requested is PAID, immediately execute GL payment & posting
    if (initialStatus === "PAID") {
      const paymentDto: RecordExpensePaymentDto = {
        paymentDate: dto.expenseDate,
      };
      if (dto.paymentModeId !== undefined) {
        paymentDto.paymentModeId = dto.paymentModeId;
      }
      if (dto.bankAccountId !== undefined) {
        paymentDto.bankAccountId = dto.bankAccountId;
      }
      if (dto.notes !== undefined) {
        paymentDto.notes = dto.notes;
      }
      return this.pay(created.id, paymentDto);
    }

    return created;
  }

  async update(id: number, dto: UpdateExpenseDto) {
    const scope = this.tenantContext.getOrgScope();
    const userId = this.tenantContext.getUserId();

    const existing = await this.findOne(id);
    if (existing.status === "PAID" || existing.status === "CANCELLED") {
      throw new BusinessRuleViolationException(
        `Cannot edit an expense in '${existing.status}' status`,
        "IMMUTABLE_EXPENSE",
      );
    }

    if (dto.expenseDate) {
      const todayStr = new Date().toISOString().slice(0, 10);
      if (dto.expenseDate > todayStr) {
        throw new BusinessRuleViolationException(
          "Expense date cannot be in the future",
          "FUTURE_EXPENSE_DATE",
        );
      }
    }

    if (dto.expenseTypeId) {
      const expenseType = await this.prisma.financeMasterListItem.findFirst({
        where: {
          id: dto.expenseTypeId,
          organizationId: scope.organizationId,
          category: "expense_type",
          isActive: true,
          deletedAt: null,
        },
      });
      if (!expenseType) {
        throw new ResourceNotFoundException("Expense type", dto.expenseTypeId);
      }
    }

    if (dto.paymentModeId) {
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
    }

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

    if (dto.glAccountId) {
      await this.validateGlExpenseAccount(
        scope.organizationId,
        dto.glAccountId,
      );
    }

    const amount =
      dto.amount !== undefined
        ? Number(Number(dto.amount).toFixed(2))
        : Number(existing.amount);
    const taxAmount =
      dto.taxAmount !== undefined
        ? Number(Number(dto.taxAmount).toFixed(2))
        : Number(existing.taxAmount);
    const netAmount = Number((amount + taxAmount).toFixed(2));

    const updated = await this.repository.update(scope, id, {
      ...(dto.expenseTypeId ? { expenseTypeId: dto.expenseTypeId } : {}),
      ...(dto.expenseDate ? { expenseDate: new Date(dto.expenseDate) } : {}),
      ...(dto.amount !== undefined ? { amount } : {}),
      ...(dto.taxAmount !== undefined ? { taxAmount } : {}),
      ...(dto.amount !== undefined || dto.taxAmount !== undefined
        ? { netAmount }
        : {}),
      ...(dto.paymentModeId !== undefined
        ? { paymentModeId: dto.paymentModeId }
        : {}),
      ...(dto.bankAccountId !== undefined
        ? { bankAccountId: dto.bankAccountId }
        : {}),
      ...(dto.glAccountId !== undefined
        ? { glAccountId: dto.glAccountId }
        : {}),
      ...(dto.vendorName !== undefined ? { vendorName: dto.vendorName } : {}),
      ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
      ...(dto.receiptUrl !== undefined ? { receiptUrl: dto.receiptUrl } : {}),
      updatedBy: userId,
    });

    return updated;
  }

  async submit(id: number) {
    const scope = this.tenantContext.getOrgScope();
    const userId = this.tenantContext.getUserId();

    const existing = await this.findOne(id);
    if (existing.status !== "DRAFT") {
      throw new InvalidStateTransitionException(
        "Expense",
        existing.status,
        "PENDING_APPROVAL",
      );
    }

    return this.repository.updateStatus(
      scope,
      id,
      ["DRAFT"],
      "PENDING_APPROVAL",
      userId,
    );
  }

  async approve(id: number) {
    const scope = this.tenantContext.getOrgScope();
    const userId = this.tenantContext.getUserId();

    const existing = await this.findOne(id);
    if (existing.status !== "PENDING_APPROVAL") {
      throw new InvalidStateTransitionException(
        "Expense",
        existing.status,
        "APPROVED",
      );
    }

    return this.repository.updateStatus(
      scope,
      id,
      ["PENDING_APPROVAL"],
      "APPROVED",
      userId,
    );
  }

  async reject(id: number) {
    const scope = this.tenantContext.getOrgScope();
    const userId = this.tenantContext.getUserId();

    const existing = await this.findOne(id);
    if (existing.status !== "PENDING_APPROVAL") {
      throw new InvalidStateTransitionException(
        "Expense",
        existing.status,
        "DRAFT",
      );
    }

    return this.repository.updateStatus(
      scope,
      id,
      ["PENDING_APPROVAL"],
      "DRAFT",
      userId,
    );
  }

  /**
   * Disburses payment for an expense and atomically creates a balanced
   * double-entry journal voucher in the General Ledger.
   */
  async pay(id: number, dto?: RecordExpensePaymentDto) {
    const scope = this.tenantContext.getOrgScope();
    const userId = this.tenantContext.getUserId();

    const existing = await this.findOne(id);

    if (existing.status === "PAID") {
      throw new BusinessRuleViolationException(
        "Expense is already marked as paid",
        "EXPENSE_ALREADY_PAID",
      );
    }
    if (existing.status === "CANCELLED") {
      throw new BusinessRuleViolationException(
        "Cannot pay a cancelled expense",
        "EXPENSE_CANCELLED",
      );
    }

    const effectivePaymentModeId = dto?.paymentModeId ?? existing.paymentModeId;
    const effectiveBankAccountId = dto?.bankAccountId ?? existing.bankAccountId;

    // Validate payment mode if provided
    let paymentModeValue = "";
    if (effectivePaymentModeId) {
      const pm = await this.prisma.financeMasterListItem.findFirst({
        where: {
          id: effectivePaymentModeId,
          organizationId: scope.organizationId,
          category: "payment_mode",
          isActive: true,
          deletedAt: null,
        },
      });
      if (!pm) {
        throw new ResourceNotFoundException(
          "Payment mode",
          effectivePaymentModeId,
        );
      }
      paymentModeValue = pm.value.toLowerCase();
    }

    // Validate bank account if provided
    let bankAccountGlAccountId: number | null = null;
    if (effectiveBankAccountId) {
      const ba = await this.prisma.financeBankAccount.findFirst({
        where: {
          id: effectiveBankAccountId,
          organizationId: scope.organizationId,
          isActive: true,
          deletedAt: null,
        },
      });
      if (!ba) {
        throw new ResourceNotFoundException(
          "Bank account",
          effectiveBankAccountId,
        );
      }
      bankAccountGlAccountId = ba.glAccountId;
    }

    // 1. Resolve GL Expense Account (Debit)
    const expenseGlAccount = await this.resolveGlExpenseAccount(
      scope.organizationId,
      existing.glAccountId,
    );

    // 2. Resolve GL Credit Account (Cash / Bank / Payable)
    const creditGlAccount = await this.resolveGlCreditAccount(
      scope.organizationId,
      bankAccountGlAccountId,
      paymentModeValue,
    );

    const netAmount = Number(existing.netAmount);

    // 3. Prepare balanced journal lines
    const entryDate = dto?.paymentDate
      ? new Date(dto.paymentDate)
      : new Date(existing.expenseDate);
    const entryNumber = await this.journalRepository.generateNextEntryNumber(
      scope,
      "JV",
    );

    const lines: ExpenseJournalLineData[] = [
      {
        accountId: expenseGlAccount.id,
        lineOrder: 0,
        description: `Expense: ${existing.vendorName ?? existing.expenseNumber}`,
        debit: netAmount,
        credit: 0,
      },
      {
        accountId: creditGlAccount.id,
        lineOrder: 1,
        description: `Payment for ${existing.expenseNumber}`,
        debit: 0,
        credit: netAmount,
      },
    ];

    const balanceDeltas: ExpenseBalanceDelta[] = [
      {
        accountId: expenseGlAccount.id,
        delta: calculateAccountBalanceDelta(
          expenseGlAccount.accountType,
          netAmount,
          0,
        ),
      },
      {
        accountId: creditGlAccount.id,
        delta: calculateAccountBalanceDelta(
          creditGlAccount.accountType,
          0,
          netAmount,
        ),
      },
    ];

    const journalData: ExpenseJournalEntryData = {
      entryNumber,
      entryDate,
      entryType: "EXPENSE",
      narration: `Payment for expense ${existing.expenseNumber}${existing.vendorName ? ` (${existing.vendorName})` : ""}`,
      referenceNumber: existing.expenseNumber,
      totalDebit: netAmount,
      totalCredit: netAmount,
      lines,
    };

    return this.repository.payAndPostExpense(
      scope,
      id,
      journalData,
      balanceDeltas,
      {
        paymentModeId: effectivePaymentModeId,
        bankAccountId: effectiveBankAccountId,
        glAccountId: expenseGlAccount.id,
      },
      userId,
    );
  }

  /**
   * Cancels an expense. If the expense was PAID and has an associated GL journal entry,
   * generates a balanced reversal journal entry and restores account balances.
   */
  async cancel(id: number) {
    const scope = this.tenantContext.getOrgScope();
    const userId = this.tenantContext.getUserId();

    const existing = await this.findOne(id);
    if (existing.status === "CANCELLED") {
      throw new BusinessRuleViolationException(
        "Expense is already cancelled",
        "EXPENSE_ALREADY_CANCELLED",
      );
    }

    if (existing.status === "PAID" && existing.journalEntryId) {
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

      // Invert debit and credit
      const lines: ExpenseJournalLineData[] = originalJournal.lines.map(
        (l, index) => ({
          accountId: l.accountId,
          lineOrder: index,
          description: `Reversal of ${originalJournal.entryNumber} line #${l.lineOrder}`,
          debit: Number(l.credit),
          credit: Number(l.debit),
        }),
      );

      const balanceDeltas: ExpenseBalanceDelta[] = originalJournal.lines.map(
        (l) => {
          const delta = calculateAccountBalanceDelta(
            l.account.accountType,
            Number(l.credit),
            Number(l.debit),
          );
          return { accountId: l.accountId, delta };
        },
      );

      const reversalData: ExpenseReversalData = {
        originalJournalEntryId: existing.journalEntryId,
        reversalEntryNumber,
        reversalDate,
        narration: `Reversal of expense ${existing.expenseNumber} voucher ${originalJournal.entryNumber}`,
        totalDebit: Number(originalJournal.totalDebit),
        totalCredit: Number(originalJournal.totalCredit),
        lines,
      };

      return this.repository.cancelAndReverseExpense(
        scope,
        id,
        reversalData,
        balanceDeltas,
        userId,
      );
    }

    // If not paid or no GL entry, cancel cleanly
    return this.repository.cancelAndReverseExpense(scope, id, null, [], userId);
  }

  async delete(id: number) {
    const scope = this.tenantContext.getOrgScope();
    const userId = this.tenantContext.getUserId();

    const existing = await this.findOne(id);
    if (existing.status === "PAID") {
      throw new BusinessRuleViolationException(
        "Cannot delete a paid expense. Cancel it instead.",
        "CANNOT_DELETE_PAID_EXPENSE",
      );
    }
    if (
      existing.status === "PENDING_APPROVAL" ||
      existing.status === "APPROVED"
    ) {
      throw new BusinessRuleViolationException(
        `Cannot delete an expense in '${existing.status}' status. Reject to draft or cancel it first.`,
        "CANNOT_DELETE_ACTIVE_EXPENSE",
      );
    }

    return this.repository.softDelete(scope, id, userId);
  }

  /**
   * Converts an approved HR Expense Claim into a Finance operating expense record.
   */
  async createFromClaim(claimId: number, dto: CreateExpenseFromClaimDto) {
    const scope = this.tenantContext.getOrgScope();
    const userId = this.tenantContext.getUserId();

    // 1. Check claim exists in tenant
    const claim = await this.prisma.expenseClaim.findFirst({
      where: {
        id: claimId,
        organizationId: scope.organizationId,
      },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeCode: true,
          },
        },
      },
    });

    if (!claim) {
      throw new ResourceNotFoundException("HR Expense claim", claimId);
    }

    if (claim.status !== "APPROVED") {
      throw new BusinessRuleViolationException(
        `Only APPROVED expense claims can be recorded in Finance. Current status is '${claim.status}'.`,
        "CLAIM_NOT_APPROVED",
      );
    }

    // 2. Check not already linked
    const existing = await this.repository.findByHrExpenseClaimId(
      scope,
      claimId,
    );
    if (existing) {
      throw new ResourceConflictException(
        `A Finance expense already exists for claim #${claimId} (${existing.expenseNumber})`,
      );
    }

    // 3. Resolve matching expense type in Finance Master List
    let expenseType = await this.prisma.financeMasterListItem.findFirst({
      where: {
        organizationId: scope.organizationId,
        category: "expense_type",
        value: { contains: claim.expenseType, mode: "insensitive" },
        isActive: true,
        deletedAt: null,
      },
    });

    if (!expenseType) {
      // Fallback to first available active expense type
      expenseType = await this.prisma.financeMasterListItem.findFirst({
        where: {
          organizationId: scope.organizationId,
          category: "expense_type",
          isActive: true,
          deletedAt: null,
        },
      });
    }

    if (!expenseType) {
      throw new BusinessRuleViolationException(
        "No active expense types configured in Finance Settings. Please add expense types first.",
        "MISSING_EXPENSE_TYPE",
      );
    }

    const employeeName =
      `${claim.employee.firstName} ${claim.employee.lastName}`.trim();
    const expenseNumber =
      await this.repository.generateNextExpenseNumber(scope);
    const amount = Number(Number(claim.amount).toFixed(2));

    return this.repository.create(scope, {
      organizationId: scope.organizationId,
      expenseNumber,
      expenseTypeId: expenseType.id,
      expenseDate: claim.expenseDate,
      amount,
      taxAmount: 0,
      netAmount: amount,
      paymentModeId: dto.paymentModeId ?? null,
      bankAccountId: dto.bankAccountId ?? null,
      glAccountId: dto.glAccountId ?? null,
      vendorName: `Reimbursement: ${employeeName} (${claim.employee.employeeCode})`,
      notes: dto.notes ?? claim.description,
      receiptUrl: claim.receiptRef ?? null,
      status: "APPROVED", // Ready for payout
      hrExpenseClaimId: claim.id,
      createdBy: userId,
      updatedBy: userId,
    });
  }

  // ---- Private Helpers -----------------------------------------------------

  private async validateGlExpenseAccount(
    organizationId: number,
    accountId: number,
  ) {
    const acc = await this.prisma.financeAccount.findFirst({
      where: {
        id: accountId,
        organizationId,
        isActive: true,
        deletedAt: null,
      },
    });
    if (!acc) {
      throw new ResourceNotFoundException("GL account", accountId);
    }
    if (acc.accountType !== "EXPENSE" && acc.accountType !== "ASSET") {
      throw new BusinessRuleViolationException(
        `GL account #${accountId} (${acc.accountCode}) is of type '${acc.accountType}', expected EXPENSE or ASSET`,
        "INVALID_GL_ACCOUNT_TYPE",
      );
    }
    return acc;
  }

  private async resolveGlExpenseAccount(
    organizationId: number,
    preferredAccountId?: number | null,
  ): Promise<{ id: number; accountType: FinanceAccountType }> {
    if (preferredAccountId) {
      const acc = await this.prisma.financeAccount.findFirst({
        where: {
          id: preferredAccountId,
          organizationId,
          isActive: true,
          deletedAt: null,
        },
      });
      if (acc) {
        return {
          id: acc.id,
          accountType: acc.accountType as FinanceAccountType,
        };
      }
    }

    // Fallback: Account code "5020" ("General Operating Expenses")
    const defaultAcc = await this.prisma.financeAccount.findFirst({
      where: {
        organizationId,
        accountCode: "5020",
        isActive: true,
        deletedAt: null,
      },
    });
    if (defaultAcc) {
      return {
        id: defaultAcc.id,
        accountType: defaultAcc.accountType as FinanceAccountType,
      };
    }

    // Fallback: any EXPENSE account
    const anyExpense = await this.prisma.financeAccount.findFirst({
      where: {
        organizationId,
        accountType: "EXPENSE",
        isActive: true,
        deletedAt: null,
      },
      orderBy: { accountCode: "asc" },
    });
    if (anyExpense) {
      return {
        id: anyExpense.id,
        accountType: anyExpense.accountType as FinanceAccountType,
      };
    }

    throw new BusinessRuleViolationException(
      "No active Expense account found in Chart of Accounts. Please create account 5020 or an EXPENSE account first.",
      "MISSING_GL_EXPENSE_ACCOUNT",
    );
  }

  private async resolveGlCreditAccount(
    organizationId: number,
    bankAccountGlAccountId?: number | null,
    paymentModeValue?: string,
  ): Promise<{ id: number; accountType: FinanceAccountType }> {
    if (bankAccountGlAccountId) {
      const acc = await this.prisma.financeAccount.findFirst({
        where: {
          id: bankAccountGlAccountId,
          organizationId,
          isActive: true,
          deletedAt: null,
        },
      });
      if (acc) {
        return {
          id: acc.id,
          accountType: acc.accountType as FinanceAccountType,
        };
      }
    }

    // Cash mode -> 1010 "Cash on Hand"
    if (paymentModeValue?.includes("cash")) {
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

    // Bank transfer / UPI / Cheque -> 1020 "Operating Bank Account"
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

    // Accounts Payable -> 2010
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

    // Fallback: any ASSET account
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
      "No active Cash, Bank, or Accounts Payable account found in Chart of Accounts.",
      "MISSING_GL_PAYMENT_ACCOUNT",
    );
  }
}
