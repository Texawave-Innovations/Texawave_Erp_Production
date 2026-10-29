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
import { BankAccountsRepository } from "./bank-accounts.repository.js";
import {
  BankTransactionsRepository,
  type BankTransactionJournalData,
} from "./bank-transactions.repository.js";
import type { CreateBankAccountDto } from "./dto/create-bank-account.dto.js";
import type { CreateBankTransactionDto } from "./dto/create-bank-transaction.dto.js";
import type { QueryBankAccountsDto } from "./dto/query-bank-accounts.dto.js";
import type { QueryBankTransactionsDto } from "./dto/query-bank-transactions.dto.js";
import type { ReconcileTransactionDto } from "./dto/reconcile-transaction.dto.js";
import type { UpdateBankAccountDto } from "./dto/update-bank-account.dto.js";

@Injectable()
export class BankingService {
  constructor(
    private readonly bankAccountsRepository: BankAccountsRepository,
    private readonly bankTransactionsRepository: BankTransactionsRepository,
    private readonly journalRepository: JournalEntriesRepository,
    private readonly tenantContext: TenantContextService,
    private readonly prisma: PrismaService,
  ) {}

  // ---- Bank Account Operations --------------------------------------------

  async findAllAccounts(query: QueryBankAccountsDto) {
    const scope = this.tenantContext.getOrgScope();
    const { items, total } = await this.bankAccountsRepository.findMany(
      scope,
      query,
    );
    return new PaginatedResponseDto(items, total, query.page, query.limit);
  }

  async findAccountById(id: number) {
    const scope = this.tenantContext.getOrgScope();
    const account = await this.bankAccountsRepository.findById(scope, id);
    if (!account) {
      throw new ResourceNotFoundException("Bank account", id);
    }
    return account;
  }

  async createAccount(dto: CreateBankAccountDto) {
    const scope = this.tenantContext.getOrgScope();
    const userId = this.tenantContext.getUserId();

    // 1. Check duplicate account number within organization
    const existing = await this.bankAccountsRepository.findByAccountNumber(
      scope,
      dto.accountNumber.trim(),
    );
    if (existing) {
      throw new ResourceConflictException(
        `Bank account with number '${dto.accountNumber}' already exists in this organization`,
      );
    }

    // 2. Validate linked GL Account if provided
    if (dto.glAccountId) {
      const glAccount = await this.prisma.financeAccount.findFirst({
        where: {
          id: dto.glAccountId,
          organizationId: scope.organizationId,
          deletedAt: null,
        },
      });
      if (!glAccount) {
        throw new ResourceNotFoundException("GL Account", dto.glAccountId);
      }
      if (glAccount.accountType !== "ASSET") {
        throw new BusinessRuleViolationException(
          "Linked GL account for a bank account must be an ASSET account",
          "INVALID_GL_ACCOUNT_TYPE",
        );
      }
    }

    const openingBalance = Number(Number(dto.openingBalance ?? 0).toFixed(2));

    return this.bankAccountsRepository.create(scope, {
      accountName: dto.accountName.trim(),
      accountNumber: dto.accountNumber.trim(),
      bankName: dto.bankName.trim(),
      ifscCode: dto.ifscCode.trim(),
      branchName: dto.branchName ? dto.branchName.trim() : null,
      accountType: dto.accountType ?? "CURRENT",
      currency: dto.currency ?? "INR",
      openingBalance,
      currentBalance: openingBalance,
      glAccountId: dto.glAccountId ?? null,
      isActive: dto.isActive ?? true,
      createdBy: userId,
      updatedBy: userId,
      organizationId: scope.organizationId,
    });
  }

  async updateAccount(id: number, dto: UpdateBankAccountDto) {
    const scope = this.tenantContext.getOrgScope();
    const userId = this.tenantContext.getUserId();

    await this.findAccountById(id);

    // Validate GL account if updated
    if (dto.glAccountId !== undefined && dto.glAccountId !== null) {
      const glAccount = await this.prisma.financeAccount.findFirst({
        where: {
          id: dto.glAccountId,
          organizationId: scope.organizationId,
          deletedAt: null,
        },
      });
      if (!glAccount) {
        throw new ResourceNotFoundException("GL Account", dto.glAccountId);
      }
      if (glAccount.accountType !== "ASSET") {
        throw new BusinessRuleViolationException(
          "Linked GL account for a bank account must be an ASSET account",
          "INVALID_GL_ACCOUNT_TYPE",
        );
      }
    }

    return this.bankAccountsRepository.update(scope, id, {
      ...(dto.accountName ? { accountName: dto.accountName.trim() } : {}),
      ...(dto.bankName ? { bankName: dto.bankName.trim() } : {}),
      ...(dto.ifscCode ? { ifscCode: dto.ifscCode.trim() } : {}),
      ...(dto.branchName !== undefined ? { branchName: dto.branchName } : {}),
      ...(dto.accountType ? { accountType: dto.accountType } : {}),
      ...(dto.glAccountId !== undefined
        ? {
            glAccount: dto.glAccountId
              ? { connect: { id: dto.glAccountId } }
              : { disconnect: true },
          }
        : {}),
      ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      updatedBy: userId,
    });
  }

  async deleteAccount(id: number) {
    const scope = this.tenantContext.getOrgScope();
    const userId = this.tenantContext.getUserId();

    await this.findAccountById(id);
    return this.bankAccountsRepository.softDelete(scope, id, userId);
  }

  // ---- Bank Transaction Operations ----------------------------------------

  async findAllTransactions(query: QueryBankTransactionsDto) {
    const scope = this.tenantContext.getOrgScope();
    const { items, total } = await this.bankTransactionsRepository.findMany(
      scope,
      query,
    );
    return new PaginatedResponseDto(items, total, query.page, query.limit);
  }

  async findTransactionById(id: number) {
    const scope = this.tenantContext.getOrgScope();
    const tx = await this.bankTransactionsRepository.findById(scope, id);
    if (!tx) {
      throw new ResourceNotFoundException("Bank transaction", id);
    }
    return tx;
  }

  async recordTransaction(dto: CreateBankTransactionDto) {
    const scope = this.tenantContext.getOrgScope();
    const userId = this.tenantContext.getUserId();

    // 1. Validate transaction date not in future
    const todayStr = new Date().toISOString().slice(0, 10);
    if (dto.transactionDate > todayStr) {
      throw new BusinessRuleViolationException(
        "Bank transaction date cannot be in the future",
        "FUTURE_TRANSACTION_DATE",
      );
    }

    // 2. Validate amount
    const amount = Number(Number(dto.amount).toFixed(2));
    if (amount <= 0) {
      throw new BusinessRuleViolationException(
        "Transaction amount must be positive",
        "INVALID_AMOUNT",
      );
    }

    // 3. Verify bank account exists and is active
    const bankAccount = await this.bankAccountsRepository.findById(
      scope,
      dto.bankAccountId,
    );
    if (!bankAccount) {
      throw new ResourceNotFoundException("Bank account", dto.bankAccountId);
    }
    if (!bankAccount.isActive) {
      throw new BusinessRuleViolationException(
        "Cannot record transactions on an inactive bank account",
        "INACTIVE_BANK_ACCOUNT",
      );
    }

    // 4. If counter GL account is provided, prepare balanced double-entry journal
    let journalData: BankTransactionJournalData | null = null;
    if (dto.counterGlAccountId) {
      const counterGl = await this.prisma.financeAccount.findFirst({
        where: {
          id: dto.counterGlAccountId,
          organizationId: scope.organizationId,
          isActive: true,
          deletedAt: null,
        },
      });
      if (!counterGl) {
        throw new ResourceNotFoundException(
          "Counter GL account",
          dto.counterGlAccountId,
        );
      }

      const bankGl = await this.resolveBankGlAccount(
        scope.organizationId,
        bankAccount.glAccountId,
      );

      const entryNumber = await this.journalRepository.generateNextEntryNumber(
        scope,
        "JV",
      );

      const isDebit = dto.transactionType === "DEBIT"; // money out of bank
      const lines = isDebit
        ? [
            {
              accountId: counterGl.id,
              lineOrder: 0,
              description: dto.description,
              debit: amount,
              credit: 0,
            },
            {
              accountId: bankGl.id,
              lineOrder: 1,
              description: `Bank withdrawal: ${bankAccount.accountName}`,
              debit: 0,
              credit: amount,
            },
          ]
        : [
            {
              accountId: bankGl.id,
              lineOrder: 0,
              description: `Bank deposit: ${bankAccount.accountName}`,
              debit: amount,
              credit: 0,
            },
            {
              accountId: counterGl.id,
              lineOrder: 1,
              description: dto.description,
              debit: 0,
              credit: amount,
            },
          ];

      const balanceDeltas = isDebit
        ? [
            {
              accountId: counterGl.id,
              delta: calculateAccountBalanceDelta(
                counterGl.accountType,
                amount,
                0,
              ),
            },
            {
              accountId: bankGl.id,
              delta: calculateAccountBalanceDelta(
                bankGl.accountType,
                0,
                amount,
              ),
            },
          ]
        : [
            {
              accountId: bankGl.id,
              delta: calculateAccountBalanceDelta(
                bankGl.accountType,
                amount,
                0,
              ),
            },
            {
              accountId: counterGl.id,
              delta: calculateAccountBalanceDelta(
                counterGl.accountType,
                0,
                amount,
              ),
            },
          ];

      journalData = {
        entryNumber,
        entryDate: new Date(dto.transactionDate),
        entryType: "BANK_TRANSFER",
        narration: `Bank transaction: ${dto.description}${dto.referenceNumber ? ` (Ref: ${dto.referenceNumber})` : ""}`,
        referenceNumber: dto.referenceNumber ?? null,
        totalDebit: amount,
        totalCredit: amount,
        lines,
        balanceDeltas,
      };
    }

    return this.bankTransactionsRepository.recordTransactionWithBalance(
      scope,
      dto.bankAccountId,
      {
        transactionDate: new Date(dto.transactionDate),
        transactionType: dto.transactionType,
        amount,
        description: dto.description.trim(),
        referenceNumber: dto.referenceNumber
          ? dto.referenceNumber.trim()
          : null,
        createdBy: userId,
      },
      journalData,
    );
  }

  async reconcileTransaction(id: number, dto: ReconcileTransactionDto) {
    const scope = this.tenantContext.getOrgScope();
    await this.findTransactionById(id);

    if (dto.matchedJournalEntryId) {
      const journal = await this.prisma.financeJournalEntry.findFirst({
        where: {
          id: dto.matchedJournalEntryId,
          organizationId: scope.organizationId,
        },
      });
      if (!journal) {
        throw new ResourceNotFoundException(
          "Journal entry",
          dto.matchedJournalEntryId,
        );
      }
    }

    return this.bankTransactionsRepository.reconcile(
      scope,
      id,
      dto.matchedJournalEntryId,
    );
  }

  async unreconcileTransaction(id: number) {
    const scope = this.tenantContext.getOrgScope();
    await this.findTransactionById(id);
    return this.bankTransactionsRepository.unreconcile(scope, id);
  }

  // ---- Private Helpers ----------------------------------------------------

  private async resolveBankGlAccount(
    organizationId: number,
    glAccountId?: number | null,
  ): Promise<{ id: number; accountType: FinanceAccountType }> {
    if (glAccountId) {
      const acc = await this.prisma.financeAccount.findFirst({
        where: {
          id: glAccountId,
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

    // Default code 1020
    const code1020 = await this.prisma.financeAccount.findFirst({
      where: {
        accountCode: "1020",
        organizationId,
        isActive: true,
        deletedAt: null,
      },
    });
    if (code1020) {
      return {
        id: code1020.id,
        accountType: code1020.accountType as FinanceAccountType,
      };
    }

    // Fallback any ASSET
    const asset = await this.prisma.financeAccount.findFirst({
      where: {
        accountType: "ASSET",
        organizationId,
        isActive: true,
        deletedAt: null,
      },
    });
    if (asset) {
      return {
        id: asset.id,
        accountType: asset.accountType as FinanceAccountType,
      };
    }

    throw new BusinessRuleViolationException(
      "No Bank Asset account found in Chart of Accounts (1020).",
      "MISSING_BANK_GL_ACCOUNT",
    );
  }
}
