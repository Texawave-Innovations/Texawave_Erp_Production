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
  type ExpenseGstEntryData,
  type ExpenseJournalEntryData,
  type ExpenseJournalLineData,
  type ExpenseReversalData,
} from "./expenses.repository.js";
import { GSTIN_PATTERN } from "./dto/create-expense.dto.js";

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

    // 7. Calculate amounts and tax details
    const amount = Number(Number(dto.amount).toFixed(2));
    const taxAmount = Number(Number(dto.taxAmount ?? 0).toFixed(2));
    const netAmount = Number((amount + taxAmount).toFixed(2));

    // Validate GSTIN format if provided
    const vendorGstin = dto.vendorGstin?.trim().toUpperCase() || null;
    if (vendorGstin && !GSTIN_PATTERN.test(vendorGstin)) {
      throw new BusinessRuleViolationException(
        "Invalid GSTIN format. Expected standard 15-character Indian GSTIN.",
        "INVALID_GSTIN_FORMAT",
      );
    }

    let jurisdiction: "INTRA_STATE" | "INTER_STATE" = "INTRA_STATE";
    let cgstAmount = 0;
    let sgstAmount = 0;
    let igstAmount = 0;

    if (taxAmount > 0) {
      const resolved = await this.resolveTaxDetails(
        scope.organizationId,
        amount,
        taxAmount,
        vendorGstin,
        dto.gstJurisdiction,
        dto.cgstAmount,
        dto.sgstAmount,
        dto.igstAmount,
      );
      jurisdiction = resolved.jurisdiction;
      cgstAmount = resolved.cgstAmount;
      sgstAmount = resolved.sgstAmount;
      igstAmount = resolved.igstAmount;
    }

    // Recoverable ITC requires taxAmount > 0, registered vendor GSTIN, and explicit or default opt-in
    const isItcEligible =
      taxAmount > 0 &&
      Boolean(vendorGstin) &&
      (dto.isItcEligible === undefined ? true : Boolean(dto.isItcEligible));

    const ineligibilityReason =
      !isItcEligible && taxAmount > 0 && dto.ineligibilityReason
        ? dto.ineligibilityReason.trim()
        : null;

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
      vendorGstin,
      vendorInvoiceNumber: dto.vendorInvoiceNumber?.trim() || null,
      vendorInvoiceDate: dto.vendorInvoiceDate
        ? new Date(dto.vendorInvoiceDate)
        : null,
      hsnSacCode: dto.hsnSacCode?.trim() || null,
      taxRate:
        dto.taxRate !== undefined && dto.taxRate !== null
          ? Number(dto.taxRate)
          : 0,
      cgstAmount,
      sgstAmount,
      igstAmount,
      isItcEligible,
      ineligibilityReason,
      gstJurisdiction: jurisdiction,
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

    const vendorGstin =
      dto.vendorGstin !== undefined
        ? dto.vendorGstin?.trim().toUpperCase() || null
        : existing.vendorGstin;
    if (dto.vendorGstin && vendorGstin && !GSTIN_PATTERN.test(vendorGstin)) {
      throw new BusinessRuleViolationException(
        "Invalid GSTIN format. Expected standard 15-character Indian GSTIN.",
        "INVALID_GSTIN_FORMAT",
      );
    }

    let jurisdiction: "INTRA_STATE" | "INTER_STATE" = "INTRA_STATE";
    let cgstAmount = 0;
    let sgstAmount = 0;
    let igstAmount = 0;

    if (taxAmount > 0) {
      const resolved = await this.resolveTaxDetails(
        scope.organizationId,
        amount,
        taxAmount,
        vendorGstin,
        dto.gstJurisdiction ??
          (existing.gstJurisdiction as
            "INTRA_STATE" | "INTER_STATE" | undefined),
        dto.cgstAmount ??
          (dto.taxAmount !== undefined
            ? undefined
            : Number(existing.cgstAmount)),
        dto.sgstAmount ??
          (dto.taxAmount !== undefined
            ? undefined
            : Number(existing.sgstAmount)),
        dto.igstAmount ??
          (dto.taxAmount !== undefined
            ? undefined
            : Number(existing.igstAmount)),
      );
      jurisdiction = resolved.jurisdiction;
      cgstAmount = resolved.cgstAmount;
      sgstAmount = resolved.sgstAmount;
      igstAmount = resolved.igstAmount;
    }

    const isItcEligible =
      taxAmount > 0 &&
      Boolean(vendorGstin) &&
      (dto.isItcEligible !== undefined
        ? Boolean(dto.isItcEligible)
        : existing.isItcEligible === true);

    const ineligibilityReason =
      !isItcEligible && taxAmount > 0
        ? (dto.ineligibilityReason ?? existing.ineligibilityReason ?? null)
        : null;

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
      ...(dto.vendorGstin !== undefined ? { vendorGstin } : {}),
      ...(dto.vendorInvoiceNumber !== undefined
        ? { vendorInvoiceNumber: dto.vendorInvoiceNumber?.trim() || null }
        : {}),
      ...(dto.vendorInvoiceDate !== undefined
        ? {
            vendorInvoiceDate: dto.vendorInvoiceDate
              ? new Date(dto.vendorInvoiceDate)
              : null,
          }
        : {}),
      ...(dto.hsnSacCode !== undefined
        ? { hsnSacCode: dto.hsnSacCode?.trim() || null }
        : {}),
      ...(dto.taxRate !== undefined ? { taxRate: Number(dto.taxRate) } : {}),
      cgstAmount,
      sgstAmount,
      igstAmount,
      isItcEligible,
      ineligibilityReason,
      gstJurisdiction: jurisdiction,
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

    const amount = Number(existing.amount);
    const taxAmount = Number(existing.taxAmount || 0);
    const netAmount = Number(existing.netAmount || amount + taxAmount);
    const shouldClaimItc = Boolean(
      taxAmount > 0 && existing.isItcEligible && existing.vendorGstin,
    );

    // 3. Prepare balanced journal lines & GST entry
    const entryDate = dto?.paymentDate
      ? new Date(dto.paymentDate)
      : new Date(existing.expenseDate);
    const entryNumber = await this.journalRepository.generateNextEntryNumber(
      scope,
      "JV",
    );

    let gstInputAccount: {
      id: number;
      accountType: FinanceAccountType;
    } | null = null;
    let gstEntryData: ExpenseGstEntryData | null = null;

    if (shouldClaimItc) {
      gstInputAccount = await this.resolveInputTaxAccount(scope.organizationId);

      const period = entryDate.toISOString().slice(0, 7);
      gstEntryData = {
        entryType: "INPUT_TAX_CREDIT",
        sourceType: "EXPENSE",
        sourceReference: existing.expenseNumber,
        gstin: existing.vendorGstin!,
        period,
        taxableAmount: amount,
        cgstAmount: Number(existing.cgstAmount || 0),
        sgstAmount: Number(existing.sgstAmount || 0),
        igstAmount: Number(existing.igstAmount || 0),
        totalTaxAmount: taxAmount,
      };
    }

    const lines: ExpenseJournalLineData[] = [];
    const balanceDeltas: ExpenseBalanceDelta[] = [];

    if (gstInputAccount && taxAmount > 0) {
      // Line 0: Debit Expense GL Account for subtotal
      lines.push({
        accountId: expenseGlAccount.id,
        lineOrder: 0,
        description: `Expense: ${existing.vendorName ?? existing.expenseNumber}`,
        debit: amount,
        credit: 0,
      });
      balanceDeltas.push({
        accountId: expenseGlAccount.id,
        delta: calculateAccountBalanceDelta(
          expenseGlAccount.accountType,
          amount,
          0,
        ),
      });

      // Line 1: Debit GST Input Tax Credit (Asset 1300)
      lines.push({
        accountId: gstInputAccount.id,
        lineOrder: 1,
        description: `GST Input Tax Credit: ${existing.expenseNumber}`,
        debit: taxAmount,
        credit: 0,
      });
      balanceDeltas.push({
        accountId: gstInputAccount.id,
        delta: calculateAccountBalanceDelta(
          gstInputAccount.accountType,
          taxAmount,
          0,
        ),
      });

      // Line 2: Credit Cash / Bank / Payable
      lines.push({
        accountId: creditGlAccount.id,
        lineOrder: 2,
        description: `Payment for ${existing.expenseNumber}`,
        debit: 0,
        credit: netAmount,
      });
      balanceDeltas.push({
        accountId: creditGlAccount.id,
        delta: calculateAccountBalanceDelta(
          creditGlAccount.accountType,
          0,
          netAmount,
        ),
      });
    } else {
      // Ineligible ITC (Section 17(5)) or Zero Tax:
      // Tax is absorbed directly into the Expense cost
      lines.push({
        accountId: expenseGlAccount.id,
        lineOrder: 0,
        description:
          taxAmount > 0
            ? `Expense (including blocked tax of ${taxAmount}): ${existing.vendorName ?? existing.expenseNumber}`
            : `Expense: ${existing.vendorName ?? existing.expenseNumber}`,
        debit: netAmount,
        credit: 0,
      });
      balanceDeltas.push({
        accountId: expenseGlAccount.id,
        delta: calculateAccountBalanceDelta(
          expenseGlAccount.accountType,
          netAmount,
          0,
        ),
      });

      lines.push({
        accountId: creditGlAccount.id,
        lineOrder: 1,
        description: `Payment for ${existing.expenseNumber}`,
        debit: 0,
        credit: netAmount,
      });
      balanceDeltas.push({
        accountId: creditGlAccount.id,
        delta: calculateAccountBalanceDelta(
          creditGlAccount.accountType,
          0,
          netAmount,
        ),
      });
    }

    const narration =
      !shouldClaimItc && taxAmount > 0
        ? `Payment for expense ${existing.expenseNumber}${existing.vendorName ? ` (${existing.vendorName})` : ""} (Ineligible ITC: INR ${taxAmount} incorporated into expense cost per Sec 17(5))`
        : `Payment for expense ${existing.expenseNumber}${existing.vendorName ? ` (${existing.vendorName})` : ""}`;

    const journalData: ExpenseJournalEntryData = {
      entryNumber,
      entryDate,
      entryType: "EXPENSE",
      narration,
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
      gstEntryData,
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
            fullName: true,
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

    const employeeName = claim.employee?.fullName?.trim() || "Employee";
    const employeeCode = claim.employee?.employeeCode || "";
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
      vendorName: employeeCode
        ? `Reimbursement: ${employeeName} (${employeeCode})`
        : `Reimbursement: ${employeeName}`,
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

  /**
   * Resolves the GST Input Tax Credit asset account.
   * Strictly enforces ASSET account type and targets account 1300.
   * NEVER falls back to output tax liability 2020 or unrelated assets.
   */
  private async resolveInputTaxAccount(
    organizationId: number,
  ): Promise<{ id: number; accountType: FinanceAccountType }> {
    // 1. Preferred: Account code "1300" with accountType "ASSET"
    const exact1300 = await this.prisma.financeAccount.findFirst({
      where: {
        organizationId,
        accountCode: "1300",
        accountType: "ASSET",
        isActive: true,
        deletedAt: null,
      },
    });
    if (exact1300) {
      return {
        id: exact1300.id,
        accountType: exact1300.accountType as FinanceAccountType,
      };
    }

    // 2. Keyword fallback strictly within active ASSET accounts
    for (const kw of ["GST Input", "Input Tax Credit", "ITC"]) {
      const match = await this.prisma.financeAccount.findFirst({
        where: {
          organizationId,
          accountType: "ASSET",
          accountName: { contains: kw, mode: "insensitive" },
          isActive: true,
          deletedAt: null,
        },
      });
      if (match) {
        return {
          id: match.id,
          accountType: match.accountType as FinanceAccountType,
        };
      }
    }

    // Fail safely with clear descriptive error - NEVER fallback to liability account 2020
    throw new BusinessRuleViolationException(
      "No active GST Input Tax Credit asset account (code 1300) found in the Chart of Accounts. Please configure account 1300 under Assets before claiming recoverable ITC.",
      "MISSING_INPUT_TAX_ACCOUNT",
    );
  }

  /**
   * Resolves tax jurisdiction (INTRA_STATE vs INTER_STATE) and validates or computes
   * tax component breakdowns (CGST, SGST, IGST).
   */
  private async resolveTaxDetails(
    organizationId: number,
    amount: number,
    taxAmount: number,
    vendorGstin?: string | null,
    overrideJurisdiction?: "INTRA_STATE" | "INTER_STATE",
    explicitCgst?: number,
    explicitSgst?: number,
    explicitIgst?: number,
  ) {
    if (taxAmount <= 0) {
      return {
        jurisdiction: "INTRA_STATE" as const,
        cgstAmount: 0,
        sgstAmount: 0,
        igstAmount: 0,
      };
    }

    // Determine jurisdiction
    let jurisdiction: "INTRA_STATE" | "INTER_STATE" = "INTRA_STATE";
    if (overrideJurisdiction) {
      jurisdiction = overrideJurisdiction;
    } else {
      const payroll =
        typeof this.prisma.payrollSetting?.findFirst === "function"
          ? await this.prisma.payrollSetting.findFirst({
              where: { organizationId },
              select: { companyGstin: true },
            })
          : null;
      const companyGstin = payroll?.companyGstin?.trim().toUpperCase() ?? null;
      const companyStateCode =
        companyGstin && companyGstin.length >= 2
          ? companyGstin.slice(0, 2)
          : null;
      const cleanVendorGstin = vendorGstin?.trim().toUpperCase() ?? null;
      const vendorStateCode =
        cleanVendorGstin && cleanVendorGstin.length >= 2
          ? cleanVendorGstin.slice(0, 2)
          : null;

      if (
        companyStateCode &&
        vendorStateCode &&
        companyStateCode.length === 2 &&
        vendorStateCode.length === 2
      ) {
        jurisdiction =
          companyStateCode === vendorStateCode ? "INTRA_STATE" : "INTER_STATE";
      } else {
        jurisdiction = "INTRA_STATE";
      }
    }

    // Validate or compute components
    let cgstAmount = 0;
    let sgstAmount = 0;
    let igstAmount = 0;

    if (
      explicitCgst !== undefined ||
      explicitSgst !== undefined ||
      explicitIgst !== undefined
    ) {
      cgstAmount = Number(explicitCgst ?? 0);
      sgstAmount = Number(explicitSgst ?? 0);
      igstAmount = Number(explicitIgst ?? 0);
      const componentsSum = Number(
        (cgstAmount + sgstAmount + igstAmount).toFixed(2),
      );
      if (Math.abs(componentsSum - taxAmount) > 0.02) {
        throw new BusinessRuleViolationException(
          `Tax components (CGST ₹${cgstAmount} + SGST ₹${sgstAmount} + IGST ₹${igstAmount} = ₹${componentsSum}) do not equal total tax amount (₹${taxAmount}).`,
          "IMBALANCED_TAX_COMPONENTS",
        );
      }
    } else {
      if (jurisdiction === "INTER_STATE") {
        igstAmount = taxAmount;
        cgstAmount = 0;
        sgstAmount = 0;
      } else {
        cgstAmount = Number((taxAmount / 2).toFixed(2));
        sgstAmount = Number((taxAmount - cgstAmount).toFixed(2));
        igstAmount = 0;
      }
    }

    return { jurisdiction, cgstAmount, sgstAmount, igstAmount };
  }
}
