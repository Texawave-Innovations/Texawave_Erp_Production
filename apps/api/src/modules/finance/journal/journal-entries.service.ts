import { Injectable } from "@nestjs/common";
import { PaginatedResponseDto } from "../../../common/dto/paginated-response.dto.js";
import {
  BusinessRuleViolationException,
  InvalidStateTransitionException,
  ResourceConflictException,
  ResourceNotFoundException,
} from "../../../common/exceptions/business.exception.js";
import type { OrgScope } from "../../../common/tenancy/org-scope.js";
import { TenantContextService } from "../../../platform/tenancy/tenant-context.service.js";
import { AccountsRepository } from "../coa/accounts.repository.js";
import {
  calculateAccountBalanceDelta,
  type FinanceAccountType,
} from "../finance.constants.js";
import type { CreateJournalEntryDto } from "./dto/create-journal-entry.dto.js";
import type { CreateJournalLineDto } from "./dto/create-journal-line.dto.js";
import type { QueryJournalEntriesDto } from "./dto/query-journal-entries.dto.js";
import type { ReverseJournalEntryDto } from "./dto/reverse-journal-entry.dto.js";
import type { UpdateJournalEntryDto } from "./dto/update-journal-entry.dto.js";
import {
  type AccountBalanceDelta,
  JournalEntriesRepository,
  type PreparedJournalLineData,
} from "./journal-entries.repository.js";

interface ValidatedLinesResult {
  lines: PreparedJournalLineData[];
  totalDebit: number;
  totalCredit: number;
  accountMap: Map<
    number,
    { id: number; accountCode: string; accountType: FinanceAccountType }
  >;
}

@Injectable()
export class JournalEntriesService {
  constructor(
    private readonly repository: JournalEntriesRepository,
    private readonly accountsRepository: AccountsRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  async findAll(query: QueryJournalEntriesDto) {
    const scope = this.tenantContext.getOrgScope();
    const { items, total } = await this.repository.findMany(scope, query);
    return new PaginatedResponseDto(items, total, query.page, query.limit);
  }

  async findOne(id: number) {
    const scope = this.tenantContext.getOrgScope();
    const entry = await this.repository.findById(scope, id);
    if (!entry) {
      throw new ResourceNotFoundException("Journal entry", id);
    }
    return entry;
  }

  async create(dto: CreateJournalEntryDto) {
    const scope = this.tenantContext.getOrgScope();
    const userId = this.tenantContext.getUserId();

    // 1. Resolve or validate entry number
    let entryNumber = dto.entryNumber;
    if (entryNumber) {
      const existing = await this.repository.findByEntryNumber(
        scope,
        entryNumber,
      );
      if (existing) {
        throw new ResourceConflictException(
          `Journal voucher number "${entryNumber}" already exists.`,
        );
      }
    } else {
      entryNumber = await this.repository.generateNextEntryNumber(scope, "JV");
    }

    // 2. Validate lines and referenced accounts
    const { lines, totalDebit, totalCredit } =
      await this.validateAndPrepareLines(scope, dto.lines);

    return this.repository.createDraft(
      scope,
      {
        entryNumber,
        entryDate: new Date(dto.entryDate),
        entryType: dto.entryType ?? "MANUAL",
        narration: dto.narration,
        referenceNumber: dto.referenceNumber ?? null,
        totalDebit,
        totalCredit,
        lines,
      },
      userId,
    );
  }

  async update(id: number, dto: UpdateJournalEntryDto) {
    const scope = this.tenantContext.getOrgScope();
    const userId = this.tenantContext.getUserId();

    const current = await this.repository.findById(scope, id);
    if (!current) {
      throw new ResourceNotFoundException("Journal entry", id);
    }

    if (current.status !== "DRAFT") {
      throw new BusinessRuleViolationException(
        `Cannot edit journal voucher with status "${current.status}". Only DRAFT vouchers can be modified.`,
        "IMMUTABLE_POSTED_JOURNAL",
      );
    }

    let preparedLines: PreparedJournalLineData[] | undefined;
    let totalDebit: number | undefined;
    let totalCredit: number | undefined;

    if (dto.lines) {
      const validated = await this.validateAndPrepareLines(scope, dto.lines);
      preparedLines = validated.lines;
      totalDebit = validated.totalDebit;
      totalCredit = validated.totalCredit;
    }

    const updated = await this.repository.updateDraft(
      scope,
      id,
      {
        ...(dto.entryDate ? { entryDate: new Date(dto.entryDate) } : {}),
        ...(dto.narration !== undefined ? { narration: dto.narration } : {}),
        ...(dto.referenceNumber !== undefined
          ? { referenceNumber: dto.referenceNumber }
          : {}),
        ...(totalDebit !== undefined ? { totalDebit } : {}),
        ...(totalCredit !== undefined ? { totalCredit } : {}),
        ...(preparedLines !== undefined ? { lines: preparedLines } : {}),
      },
      userId,
    );

    if (!updated) {
      throw new ResourceNotFoundException("Journal entry", id);
    }

    return updated;
  }

  async post(id: number) {
    const scope = this.tenantContext.getOrgScope();
    const userId = this.tenantContext.getUserId();

    const current = await this.repository.findById(scope, id);
    if (!current) {
      throw new ResourceNotFoundException("Journal entry", id);
    }

    if (current.status === "POSTED") {
      throw new BusinessRuleViolationException(
        `Journal entry "${current.entryNumber}" is already posted.`,
        "JOURNAL_ALREADY_POSTED",
      );
    }

    if (current.status !== "DRAFT") {
      throw new InvalidStateTransitionException(
        "Journal entry",
        current.status,
        "POSTED",
        "Only DRAFT entries can be posted",
      );
    }

    // Ensure all accounts exist, belong to tenant, and remain active
    const deltasByAccount = new Map<number, number>();

    for (const line of current.lines) {
      const account = await this.accountsRepository.findById(
        scope,
        line.accountId,
      );
      if (!account) {
        throw new ResourceNotFoundException("Finance account", line.accountId);
      }
      if (!account.isActive) {
        throw new BusinessRuleViolationException(
          `Account "${account.accountCode}" is inactive and cannot accept postings.`,
          "ACCOUNT_INACTIVE",
        );
      }

      const debit = Number(line.debit);
      const credit = Number(line.credit);
      const delta = calculateAccountBalanceDelta(
        account.accountType,
        debit,
        credit,
      );
      deltasByAccount.set(
        line.accountId,
        (deltasByAccount.get(line.accountId) ?? 0) + delta,
      );
    }

    const balanceDeltas: AccountBalanceDelta[] = Array.from(
      deltasByAccount.entries(),
    ).map(([accountId, delta]) => ({
      accountId,
      delta: Math.round(delta * 100) / 100,
    }));

    const posted = await this.repository.postEntry(
      scope,
      id,
      balanceDeltas,
      userId,
    );

    if (!posted) {
      throw new BusinessRuleViolationException(
        `Failed to post journal entry "${current.entryNumber}".`,
        "POSTING_FAILED",
      );
    }

    return posted;
  }

  async reverse(id: number, dto: ReverseJournalEntryDto) {
    const scope = this.tenantContext.getOrgScope();
    const userId = this.tenantContext.getUserId();

    const current = await this.repository.findById(scope, id);
    if (!current) {
      throw new ResourceNotFoundException("Journal entry", id);
    }

    if (current.status !== "POSTED") {
      throw new BusinessRuleViolationException(
        `Only POSTED journal vouchers can be reversed. Current status is "${current.status}".`,
        "INVALID_STATE_TRANSITION",
      );
    }

    if (current.reversedEntryId || current.reversedEntry) {
      throw new BusinessRuleViolationException(
        `Journal entry "${current.entryNumber}" has already been reversed.`,
        "JOURNAL_ALREADY_REVERSED",
      );
    }

    if (current.entryType === "REVERSAL") {
      throw new BusinessRuleViolationException(
        "Cannot reverse a reversal journal voucher.",
        "CANNOT_REVERSE_REVERSAL",
      );
    }

    // Generate reversal number
    const reversalNumber = await this.repository.generateNextEntryNumber(
      scope,
      "REV",
    );
    const reversalDate = dto.reversalDate
      ? new Date(dto.reversalDate)
      : new Date();
    const narration =
      dto.reason ?? `Reversal of ${current.entryNumber}: ${current.narration}`;

    // Invert lines: swap debits and credits
    const reversedLines: PreparedJournalLineData[] = current.lines.map(
      (line) => ({
        accountId: line.accountId,
        lineOrder: line.lineOrder,
        description: `Reversal of ${line.description ?? current.entryNumber}`,
        debit: Number(line.credit),
        credit: Number(line.debit),
      }),
    );

    // Calculate reverse balance deltas
    const deltasByAccount = new Map<number, number>();
    for (const line of reversedLines) {
      const accountType = line.accountId
        ? (current.lines.find((l) => l.accountId === line.accountId)?.account
            ?.accountType ?? "ASSET")
        : "ASSET";

      const delta = calculateAccountBalanceDelta(
        accountType,
        line.debit,
        line.credit,
      );
      deltasByAccount.set(
        line.accountId,
        (deltasByAccount.get(line.accountId) ?? 0) + delta,
      );
    }

    const balanceDeltas: AccountBalanceDelta[] = Array.from(
      deltasByAccount.entries(),
    ).map(([accountId, delta]) => ({
      accountId,
      delta: Math.round(delta * 100) / 100,
    }));

    return this.repository.reverseEntry(
      scope,
      id,
      reversalNumber,
      reversalDate,
      narration,
      reversedLines,
      Number(current.totalCredit),
      Number(current.totalDebit),
      balanceDeltas,
      userId,
    );
  }

  async remove(id: number): Promise<void> {
    const scope = this.tenantContext.getOrgScope();

    const current = await this.repository.findById(scope, id);
    if (!current) {
      throw new ResourceNotFoundException("Journal entry", id);
    }

    if (current.status !== "DRAFT") {
      throw new BusinessRuleViolationException(
        `Cannot delete journal voucher with status "${current.status}". Only DRAFT vouchers can be deleted.`,
        "IMMUTABLE_POSTED_JOURNAL",
      );
    }

    const deleted = await this.repository.deleteDraft(scope, id);
    if (!deleted) {
      throw new ResourceNotFoundException("Journal entry", id);
    }
  }

  private async validateAndPrepareLines(
    scope: OrgScope,
    linesDto: CreateJournalLineDto[],
  ): Promise<ValidatedLinesResult> {
    if (!linesDto || linesDto.length < 2) {
      throw new BusinessRuleViolationException(
        "A journal voucher must have at least 2 lines (double-entry requirement).",
        "INSUFFICIENT_JOURNAL_LINES",
      );
    }

    let totalDebitCents = 0;
    let totalCreditCents = 0;
    const preparedLines: PreparedJournalLineData[] = [];
    const accountMap = new Map<
      number,
      { id: number; accountCode: string; accountType: FinanceAccountType }
    >();

    for (let i = 0; i < linesDto.length; i++) {
      const line = linesDto[i]!;
      const debitCents = Math.round((line.debit ?? 0) * 100);
      const creditCents = Math.round((line.credit ?? 0) * 100);

      // Rule: Exactly one of debit or credit must be positive
      if (
        (debitCents <= 0 && creditCents <= 0) ||
        (debitCents > 0 && creditCents > 0)
      ) {
        throw new BusinessRuleViolationException(
          `Line ${i + 1} must have either a positive debit or a positive credit, not both or neither.`,
          "INVALID_LINE_AMOUNTS",
        );
      }

      // Verify account existence and active status in caller's organization
      if (!accountMap.has(line.accountId)) {
        const account = await this.accountsRepository.findById(
          scope,
          line.accountId,
        );
        if (!account) {
          throw new ResourceNotFoundException(
            "Finance account",
            line.accountId,
          );
        }
        if (!account.isActive) {
          throw new BusinessRuleViolationException(
            `Account "${account.accountCode}" is inactive and cannot accept journal postings.`,
            "ACCOUNT_INACTIVE",
          );
        }
        accountMap.set(line.accountId, {
          id: account.id,
          accountCode: account.accountCode,
          accountType: account.accountType as FinanceAccountType,
        });
      }

      totalDebitCents += debitCents;
      totalCreditCents += creditCents;

      preparedLines.push({
        accountId: line.accountId,
        lineOrder: i,
        description: line.description ?? null,
        debit: debitCents / 100,
        credit: creditCents / 100,
      });
    }

    if (totalDebitCents <= 0) {
      throw new BusinessRuleViolationException(
        "Total journal debit amount must be greater than zero.",
        "ZERO_AMOUNT_JOURNAL",
      );
    }

    if (totalDebitCents !== totalCreditCents) {
      const debitStr = (totalDebitCents / 100).toFixed(2);
      const creditStr = (totalCreditCents / 100).toFixed(2);
      throw new BusinessRuleViolationException(
        `Journal entry is unbalanced: total debit (${debitStr}) does not equal total credit (${creditStr}).`,
        "UNBALANCED_JOURNAL",
      );
    }

    return {
      lines: preparedLines,
      totalDebit: totalDebitCents / 100,
      totalCredit: totalCreditCents / 100,
      accountMap,
    };
  }
}
