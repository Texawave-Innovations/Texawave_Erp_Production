/** One calendar month of posted revenue and expense, same rules as the P&L. */
export interface MonthlyPnl {
  /** `YYYY-MM`. */
  month: string;
  revenue: number;
  expenses: number;
  netIncome: number;
}

export interface TrendLine {
  debit: number | { toString(): string };
  credit: number | { toString(): string };
  journalEntry: { entryDate: Date };
  account: { accountType: string };
}

/** The `count` calendar months ending at `today`'s month, oldest first (`YYYY-MM`). */
export function trendMonths(today: string, count: number): string[] {
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7)) - 1;
  return Array.from({ length: count }, (_, i) =>
    new Date(Date.UTC(year, month - (count - 1 - i), 1))
      .toISOString()
      .slice(0, 7),
  );
}

/** Last calendar day of a `YYYY-MM` month, `YYYY-MM-DD`. */
export function monthEnd(month: string): string {
  const [y, m] = month.split("-").map(Number) as [number, number];
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}

/**
 * Buckets posted journal lines by the month of their entry date. Revenue is
 * credit − debit on REVENUE accounts and expense is debit − credit on EXPENSE
 * accounts, exactly as `getProfitAndLoss` computes them, so a month here
 * equals the P&L for that month.
 */
export function bucketMonthlyPnl(
  lines: readonly TrendLine[],
  months: readonly string[],
): MonthlyPnl[] {
  const byMonth = new Map(
    months.map((month) => [month, { revenue: 0, expenses: 0 }]),
  );
  for (const l of lines) {
    const bucket = byMonth.get(
      l.journalEntry.entryDate.toISOString().slice(0, 7),
    );
    if (!bucket) continue;
    const debit = Number(l.debit);
    const credit = Number(l.credit);
    if (l.account.accountType === "REVENUE") bucket.revenue += credit - debit;
    else if (l.account.accountType === "EXPENSE")
      bucket.expenses += debit - credit;
  }
  return months.map((month) => {
    const b = byMonth.get(month) as { revenue: number; expenses: number };
    const revenue = Number(b.revenue.toFixed(2));
    const expenses = Number(b.expenses.toFixed(2));
    return {
      month,
      revenue,
      expenses,
      netIncome: Number((revenue - expenses).toFixed(2)),
    };
  });
}
