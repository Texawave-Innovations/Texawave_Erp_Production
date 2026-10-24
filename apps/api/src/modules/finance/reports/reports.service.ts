import { Injectable } from "@nestjs/common";
import {
  BusinessRuleViolationException,
  ResourceNotFoundException,
} from "../../../common/exceptions/business.exception.js";
import { TenantContextService } from "../../../platform/tenancy/tenant-context.service.js";
import type { FinanceAccountType } from "../finance.constants.js";
import type { QueryBalanceSheetDto } from "./dto/query-balance-sheet.dto.js";
import type { QueryCashBankSummaryDto } from "./dto/query-cash-bank-summary.dto.js";
import type { QueryGeneralLedgerDto } from "./dto/query-general-ledger.dto.js";
import type { QueryPeriodClosingDto } from "./dto/query-period-closing.dto.js";
import type { QueryProfitAndLossDto } from "./dto/query-profit-and-loss.dto.js";
import type { QueryTrialBalanceDto } from "./dto/query-trial-balance.dto.js";
import { ReportsRepository } from "./reports.repository.js";
import type {
  CashBankAccountSummaryItem,
  FinanceBalanceSheetReport,
  FinanceCashBankSummaryReport,
  FinancePeriodClosingStatus,
  FinanceProfitAndLossReport,
  FinanceTrialBalanceReport,
  FinancialReportAccountItem,
  GeneralLedgerAccountReport,
  GeneralLedgerTransactionItem,
  TrialBalanceItem,
} from "./reports.types.js";

function getNormalBalance(accountType: string): "DEBIT" | "CREDIT" {
  if (accountType === "ASSET" || accountType === "EXPENSE") {
    return "DEBIT";
  }
  return "CREDIT";
}

@Injectable()
export class ReportsService {
  constructor(
    private readonly repository: ReportsRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  /**
   * Profit & Loss Report
   * Aggregates posted REVENUE (Credits - Debits) and EXPENSE (Debits - Credits)
   * within the specified date range. Excludes drafts and voided entries.
   */
  async getProfitAndLoss(
    dto: QueryProfitAndLossDto,
  ): Promise<FinanceProfitAndLossReport> {
    const scope = this.tenantContext.getOrgScope();
    const { startDate, endDate, startStr, endStr } = this.resolveDateRange(
      dto.startDate,
      dto.endDate,
    );

    const lines = await this.repository.getPostedJournalLinesInDateRange(
      scope,
      startDate,
      endDate,
    );

    const revenueMap = new Map<number, FinancialReportAccountItem>();
    const expenseMap = new Map<number, FinancialReportAccountItem>();

    let totalRevenue = 0;
    let totalExpenses = 0;

    for (const l of lines) {
      const debit = Number(l.debit);
      const credit = Number(l.credit);
      const acc = l.account;

      if (acc.accountType === "REVENUE") {
        const netCredit = credit - debit;
        totalRevenue += netCredit;
        const existing = revenueMap.get(acc.id) ?? {
          accountId: acc.id,
          accountCode: acc.accountCode,
          accountName: acc.accountName,
          amount: 0,
        };
        existing.amount = Number((existing.amount + netCredit).toFixed(2));
        revenueMap.set(acc.id, existing);
      } else if (acc.accountType === "EXPENSE") {
        const netDebit = debit - credit;
        totalExpenses += netDebit;
        const existing = expenseMap.get(acc.id) ?? {
          accountId: acc.id,
          accountCode: acc.accountCode,
          accountName: acc.accountName,
          amount: 0,
        };
        existing.amount = Number((existing.amount + netDebit).toFixed(2));
        expenseMap.set(acc.id, existing);
      }
    }

    totalRevenue = Number(totalRevenue.toFixed(2));
    totalExpenses = Number(totalExpenses.toFixed(2));
    const netIncome = Number((totalRevenue - totalExpenses).toFixed(2));

    const revenueAccounts = Array.from(revenueMap.values()).sort((a, b) =>
      a.accountCode.localeCompare(b.accountCode),
    );
    const expenseAccounts = Array.from(expenseMap.values()).sort((a, b) =>
      a.accountCode.localeCompare(b.accountCode),
    );

    return {
      period: {
        startDate: startStr,
        endDate: endStr,
      },
      revenue: {
        accounts: revenueAccounts,
        total: totalRevenue,
      },
      expenses: {
        accounts: expenseAccounts,
        total: totalExpenses,
      },
      netIncome,
      isProfitable: netIncome >= 0,
      currency: "INR",
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Balance Sheet Report
   * Point-in-time financial snapshot: Assets, Liabilities, and Equity as of a given date.
   * Verifies the accounting equation: Assets = Liabilities + Equity.
   */
  async getBalanceSheet(
    dto: QueryBalanceSheetDto,
  ): Promise<FinanceBalanceSheetReport> {
    const scope = this.tenantContext.getOrgScope();
    const asOfStr = dto.asOfDate ?? new Date().toISOString().slice(0, 10);
    const asOfDate = new Date(`${asOfStr}T23:59:59.999Z`);

    const lines = await this.repository.getPostedJournalLinesUpToDate(
      scope,
      asOfDate,
    );

    const assetMap = new Map<number, FinancialReportAccountItem>();
    const liabilityMap = new Map<number, FinancialReportAccountItem>();
    const equityMap = new Map<number, FinancialReportAccountItem>();

    let totalAssets = 0;
    let totalLiabilities = 0;
    let totalEquityAccounts = 0;
    let cumulativeRevenue = 0;
    let cumulativeExpenses = 0;

    for (const l of lines) {
      const debit = Number(l.debit);
      const credit = Number(l.credit);
      const acc = l.account;

      if (acc.accountType === "ASSET") {
        const netDebit = debit - credit;
        totalAssets += netDebit;
        const item = assetMap.get(acc.id) ?? {
          accountId: acc.id,
          accountCode: acc.accountCode,
          accountName: acc.accountName,
          amount: 0,
        };
        item.amount = Number((item.amount + netDebit).toFixed(2));
        assetMap.set(acc.id, item);
      } else if (acc.accountType === "LIABILITY") {
        const netCredit = credit - debit;
        totalLiabilities += netCredit;
        const item = liabilityMap.get(acc.id) ?? {
          accountId: acc.id,
          accountCode: acc.accountCode,
          accountName: acc.accountName,
          amount: 0,
        };
        item.amount = Number((item.amount + netCredit).toFixed(2));
        liabilityMap.set(acc.id, item);
      } else if (acc.accountType === "EQUITY") {
        const netCredit = credit - debit;
        totalEquityAccounts += netCredit;
        const item = equityMap.get(acc.id) ?? {
          accountId: acc.id,
          accountCode: acc.accountCode,
          accountName: acc.accountName,
          amount: 0,
        };
        item.amount = Number((item.amount + netCredit).toFixed(2));
        equityMap.set(acc.id, item);
      } else if (acc.accountType === "REVENUE") {
        cumulativeRevenue += credit - debit;
      } else if (acc.accountType === "EXPENSE") {
        cumulativeExpenses += debit - credit;
      }
    }

    totalAssets = Number(totalAssets.toFixed(2));
    totalLiabilities = Number(totalLiabilities.toFixed(2));
    totalEquityAccounts = Number(totalEquityAccounts.toFixed(2));
    const retainedEarnings = Number(
      (cumulativeRevenue - cumulativeExpenses).toFixed(2),
    );
    const totalEquity = Number(
      (totalEquityAccounts + retainedEarnings).toFixed(2),
    );

    const diff = Math.abs(totalAssets - (totalLiabilities + totalEquity));
    const difference = Number(diff.toFixed(2));
    const isBalanced = difference < 0.01;

    return {
      asOfDate: asOfStr,
      assets: {
        accounts: Array.from(assetMap.values()).sort((a, b) =>
          a.accountCode.localeCompare(b.accountCode),
        ),
        total: totalAssets,
      },
      liabilities: {
        accounts: Array.from(liabilityMap.values()).sort((a, b) =>
          a.accountCode.localeCompare(b.accountCode),
        ),
        total: totalLiabilities,
      },
      equity: {
        accounts: Array.from(equityMap.values()).sort((a, b) =>
          a.accountCode.localeCompare(b.accountCode),
        ),
        retainedEarnings,
        total: totalEquity,
      },
      isBalanced,
      difference,
      currency: "INR",
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Trial Balance Report
   * Summarizes opening, period movement, and closing debit/credit totals
   * for every account in the Chart of Accounts. Verifies Total Debit = Total Credit.
   */
  async getTrialBalance(
    dto: QueryTrialBalanceDto,
  ): Promise<FinanceTrialBalanceReport> {
    const scope = this.tenantContext.getOrgScope();
    const asOfStr =
      dto.asOfDate ?? dto.endDate ?? new Date().toISOString().slice(0, 10);
    const asOfDate = new Date(`${asOfStr}T23:59:59.999Z`);

    const startStr = dto.startDate ?? `${asOfStr.slice(0, 7)}-01`;
    const startDate = new Date(`${startStr}T00:00:00.000Z`);

    const accounts = await this.repository.getAccounts(scope);
    const lines = await this.repository.getPostedJournalLinesUpToDate(
      scope,
      asOfDate,
    );

    // Group lines by accountId into opening (< startDate) and period (>= startDate && <= asOfDate)
    const openingSums = new Map<number, { debit: number; credit: number }>();
    const periodSums = new Map<number, { debit: number; credit: number }>();

    for (const l of lines) {
      const debit = Number(l.debit);
      const credit = Number(l.credit);

      const isPrior = l.journalEntry?.entryDate
        ? new Date(l.journalEntry.entryDate) < startDate
        : false;

      if (isPrior) {
        const cur = openingSums.get(l.accountId) ?? { debit: 0, credit: 0 };
        cur.debit += debit;
        cur.credit += credit;
        openingSums.set(l.accountId, cur);
      } else {
        const cur = periodSums.get(l.accountId) ?? { debit: 0, credit: 0 };
        cur.debit += debit;
        cur.credit += credit;
        periodSums.set(l.accountId, cur);
      }
    }

    let totalDebit = 0;
    let totalCredit = 0;
    const items: TrialBalanceItem[] = [];

    for (const acc of accounts) {
      const open = openingSums.get(acc.id) ?? { debit: 0, credit: 0 };
      const period = periodSums.get(acc.id) ?? { debit: 0, credit: 0 };

      const totalD = open.debit + period.debit;
      const totalC = open.credit + period.credit;

      let closingDebit = 0;
      let closingCredit = 0;

      const normalBalance = getNormalBalance(acc.accountType);

      if (normalBalance === "DEBIT") {
        const net = totalD - totalC;
        if (net >= 0) {
          closingDebit = Number(net.toFixed(2));
        } else {
          closingCredit = Number((-net).toFixed(2));
        }
      } else {
        const net = totalC - totalD;
        if (net >= 0) {
          closingCredit = Number(net.toFixed(2));
        } else {
          closingDebit = Number((-net).toFixed(2));
        }
      }

      totalDebit += closingDebit;
      totalCredit += closingCredit;

      items.push({
        accountId: acc.id,
        accountCode: acc.accountCode,
        accountName: acc.accountName,
        accountType: acc.accountType as FinanceAccountType,
        normalBalance,
        openingDebit: Number(open.debit.toFixed(2)),
        openingCredit: Number(open.credit.toFixed(2)),
        periodDebit: Number(period.debit.toFixed(2)),
        periodCredit: Number(period.credit.toFixed(2)),
        closingDebit,
        closingCredit,
      });
    }

    totalDebit = Number(totalDebit.toFixed(2));
    totalCredit = Number(totalCredit.toFixed(2));
    const diff = Math.abs(totalDebit - totalCredit);
    const difference = Number(diff.toFixed(2));
    const isBalanced = difference < 0.01;

    return {
      asOfDate: asOfStr,
      period: {
        startDate: startStr,
        endDate: asOfStr,
      },
      accounts: items,
      totalDebit,
      totalCredit,
      isBalanced,
      difference,
      currency: "INR",
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * General Ledger Report
   * Account-level statement with opening balance, chronologically ordered
   * posted journal transactions, sequential running balances, and closing balance.
   */
  async getGeneralLedger(
    dto: QueryGeneralLedgerDto,
  ): Promise<GeneralLedgerAccountReport> {
    const scope = this.tenantContext.getOrgScope();
    const { startDate, endDate, startStr, endStr } = this.resolveDateRange(
      dto.startDate,
      dto.endDate,
    );

    // 1. Resolve target account
    let account = null;
    if (dto.accountId) {
      account = await this.repository.getAccountById(scope, dto.accountId);
    } else if (dto.accountCode) {
      account = await this.repository.getAccountByCode(scope, dto.accountCode);
    } else {
      // Default to operating bank account 1020 or cash 1010
      account = await this.repository.getAccountByCode(scope, "1020");
      if (!account) {
        account = await this.repository.getAccountByCode(scope, "1010");
      }
      if (!account) {
        const all = await this.repository.getAccounts(scope);
        account = all[0] ?? null;
      }
    }

    if (!account) {
      throw new ResourceNotFoundException(
        "FinanceAccount",
        dto.accountId ?? dto.accountCode ?? "default",
      );
    }

    // 2. Calculate opening balance prior to startDate
    const priorTotals = await this.repository.getAccountPriorTotals(
      scope,
      account.id,
      startDate,
    );

    const normalBalance = getNormalBalance(account.accountType);
    const isDebitNormal = normalBalance === "DEBIT";
    const openingBalance = isDebitNormal
      ? Number((priorTotals.totalDebit - priorTotals.totalCredit).toFixed(2))
      : Number((priorTotals.totalCredit - priorTotals.totalDebit).toFixed(2));

    // 3. Fetch period transactions
    const { lines, total } = await this.repository.getAccountLedgerLines(
      scope,
      account.id,
      startDate,
      endDate,
      dto.skip,
      dto.limit,
    );

    let runningBalance = openingBalance;
    let totalDebit = 0;
    let totalCredit = 0;

    const transactions: GeneralLedgerTransactionItem[] = lines.map((l) => {
      const debit = Number(l.debit);
      const credit = Number(l.credit);
      totalDebit += debit;
      totalCredit += credit;

      if (isDebitNormal) {
        runningBalance = Number((runningBalance + debit - credit).toFixed(2));
      } else {
        runningBalance = Number((runningBalance + credit - debit).toFixed(2));
      }

      return {
        id: l.id,
        journalEntryId: l.journalEntryId,
        entryNumber: l.journalEntry.entryNumber,
        entryDate: l.journalEntry.entryDate.toISOString().slice(0, 10),
        entryType: l.journalEntry.entryType,
        referenceNumber: l.journalEntry.referenceNumber,
        narration: l.journalEntry.narration,
        description: l.description,
        debit,
        credit,
        runningBalance,
      };
    });

    totalDebit = Number(totalDebit.toFixed(2));
    totalCredit = Number(totalCredit.toFixed(2));
    const closingBalance = runningBalance;

    return {
      account: {
        id: account.id,
        accountCode: account.accountCode,
        accountName: account.accountName,
        accountType: account.accountType as FinanceAccountType,
        normalBalance,
      },
      period: {
        startDate: startStr,
        endDate: endStr,
      },
      openingBalance,
      transactions,
      totalDebit,
      totalCredit,
      closingBalance,
      totalTransactions: total,
    };
  }

  /**
   * Cash & Bank Summary
   * Summarizes opening, inflows, outflows, and closing balances for all
   * liquid cash and bank accounts.
   */
  async getCashBankSummary(
    dto: QueryCashBankSummaryDto,
  ): Promise<FinanceCashBankSummaryReport> {
    const scope = this.tenantContext.getOrgScope();
    const { startDate, endDate, startStr, endStr } = this.resolveDateRange(
      dto.startDate,
      dto.endDate,
    );

    const bankAccounts = await this.repository.getBankAccounts(scope);
    const liquidGlAccounts = await this.repository.getAccounts(scope, [
      "ASSET",
    ]);
    const cashOrBankGl = liquidGlAccounts.filter(
      (a) => a.accountCode === "1010" || a.accountCode === "1020",
    );

    const accountItems: CashBankAccountSummaryItem[] = [];
    let totalOpening = 0;
    let totalInflows = 0;
    let totalOutflows = 0;
    let totalClosing = 0;

    for (const ba of bankAccounts) {
      const glId = ba.glAccountId;
      let open = 0;
      let debit = 0;
      let credit = 0;

      if (glId) {
        const prior = await this.repository.getAccountPriorTotals(
          scope,
          glId,
          startDate,
        );
        open = prior.totalDebit - prior.totalCredit;
        const lines = await this.repository.getPostedJournalLinesInDateRange(
          scope,
          startDate,
          endDate,
        );
        const accLines = lines.filter((l) => l.accountId === glId);
        for (const l of accLines) {
          debit += Number(l.debit);
          credit += Number(l.credit);
        }
      } else {
        open = Number(ba.openingBalance);
        debit = 0;
        credit = 0;
      }

      const closing = Number((open + debit - credit).toFixed(2));
      totalOpening += open;
      totalInflows += debit;
      totalOutflows += credit;
      totalClosing += closing;

      accountItems.push({
        id: ba.id,
        name: ba.accountName,
        type: "BANK",
        accountNumber: ba.accountNumber,
        bankName: ba.bankName,
        openingBalance: Number(open.toFixed(2)),
        totalInflows: Number(debit.toFixed(2)),
        totalOutflows: Number(credit.toFixed(2)),
        closingBalance: closing,
      });
    }

    // Add Cash on Hand if not already captured
    const cashGl = cashOrBankGl.find((a) => a.accountCode === "1010");
    if (cashGl) {
      const prior = await this.repository.getAccountPriorTotals(
        scope,
        cashGl.id,
        startDate,
      );
      const open = prior.totalDebit - prior.totalCredit;
      const lines = await this.repository.getPostedJournalLinesInDateRange(
        scope,
        startDate,
        endDate,
      );
      const accLines = lines.filter((l) => l.accountId === cashGl.id);
      let debit = 0;
      let credit = 0;
      for (const l of accLines) {
        debit += Number(l.debit);
        credit += Number(l.credit);
      }
      const closing = Number((open + debit - credit).toFixed(2));

      totalOpening += open;
      totalInflows += debit;
      totalOutflows += credit;
      totalClosing += closing;

      accountItems.unshift({
        id: cashGl.id,
        name: cashGl.accountName,
        type: "CASH",
        openingBalance: Number(open.toFixed(2)),
        totalInflows: Number(debit.toFixed(2)),
        totalOutflows: Number(credit.toFixed(2)),
        closingBalance: closing,
      });
    }

    return {
      period: {
        startDate: startStr,
        endDate: endStr,
      },
      accounts: accountItems,
      totalOpeningBalance: Number(totalOpening.toFixed(2)),
      totalInflows: Number(totalInflows.toFixed(2)),
      totalOutflows: Number(totalOutflows.toFixed(2)),
      totalClosingBalance: Number(totalClosing.toFixed(2)),
      currency: "INR",
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Period Closing Status & Validation Audit
   * Validates whether a financial period is eligible for closing:
   * - No unposted draft vouchers exist in the period.
   * - Total posted debits equal total posted credits.
   * - Unreconciled bank transactions count.
   * - Computes net income and revenue/expense summary.
   */
  async getPeriodClosingStatus(
    dto: QueryPeriodClosingDto,
  ): Promise<FinancePeriodClosingStatus> {
    const scope = this.tenantContext.getOrgScope();
    const period = dto.period; // e.g. "2026-10"

    const [yearStr, monthStr] = period.split("-");
    const year = parseInt(yearStr ?? "2026", 10);
    const month = parseInt(monthStr ?? "10", 10);

    const startDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
    const lastDay = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
    const startStr = `${period}-01`;
    const endStr = `${period}-${String(lastDay.getUTCDate()).padStart(2, "0")}`;

    const auditData = await this.repository.getPeriodClosingAuditData(
      scope,
      startDate,
      lastDay,
    );

    const pl = await this.getProfitAndLoss({
      startDate: startStr,
      endDate: endStr,
    });

    const isBalanced =
      Math.abs(auditData.totalDebit - auditData.totalCredit) < 0.01;
    const validationMessages: string[] = [];

    if (auditData.draftEntriesCount > 0) {
      validationMessages.push(
        `${auditData.draftEntriesCount} unposted draft journal entry/entries must be posted or deleted before closing.`,
      );
    }

    if (!isBalanced) {
      validationMessages.push(
        `Period debits (${auditData.totalDebit}) do not balance with credits (${auditData.totalCredit}).`,
      );
    }

    if (auditData.unreconciledBankTransactionsCount > 0) {
      validationMessages.push(
        `${auditData.unreconciledBankTransactionsCount} bank transaction(s) remain unreconciled.`,
      );
    }

    const canClose = auditData.draftEntriesCount === 0 && isBalanced;

    return {
      period,
      startDate: startStr,
      endDate: endStr,
      draftEntriesCount: auditData.draftEntriesCount,
      postedEntriesCount: auditData.postedEntriesCount,
      totalDebit: auditData.totalDebit,
      totalCredit: auditData.totalCredit,
      isBalanced,
      unreconciledBankTransactionsCount:
        auditData.unreconciledBankTransactionsCount,
      revenueTotal: pl.revenue.total,
      expenseTotal: pl.expenses.total,
      netIncome: pl.netIncome,
      canClose,
      validationMessages,
    };
  }

  // ---- Private Helpers ----------------------------------------------------

  private resolveDateRange(
    startInput?: string,
    endInput?: string,
  ): { startDate: Date; endDate: Date; startStr: string; endStr: string } {
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);

    const endStr = endInput ?? todayStr;
    const startStr = startInput ?? `${endStr.slice(0, 7)}-01`;

    if (startStr > endStr) {
      throw new BusinessRuleViolationException(
        "Start date cannot be after end date",
        "INVALID_DATE_RANGE",
      );
    }

    const startDate = new Date(`${startStr}T00:00:00.000Z`);
    const endDate = new Date(`${endStr}T23:59:59.999Z`);

    return { startDate, endDate, startStr, endStr };
  }
}
