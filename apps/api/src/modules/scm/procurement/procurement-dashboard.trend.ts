/** PO statuses that commit spend: approved onwards, never drafts or cancellations. */
export const COMMITTED_PO_STATUSES = [
  "APPROVED",
  "SENT",
  "PARTIALLY_RECEIVED",
  "RECEIVED",
  "CLOSED",
] as const;

export interface MonthlySpend {
  /** `YYYY-MM`. */
  month: string;
  total: number;
  orders: number;
}

/** The `count` calendar months ending at `today`'s month, oldest first (`YYYY-MM`). */
export function trendMonths(today: string, count: number): string[] {
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7)) - 1;
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(Date.UTC(year, month - (count - 1 - i), 1));
    return d.toISOString().slice(0, 7);
  });
}

/**
 * Sums PO totals into months of their `poDate` (a calendar date column, so its
 * UTC ISO prefix is the business date). Months with no orders stay at zero.
 */
export function bucketMonthlySpend(
  rows: ReadonlyArray<{ poDate: Date; total: number | { toString(): string } }>,
  months: readonly string[],
): MonthlySpend[] {
  const byMonth = new Map<string, MonthlySpend>(
    months.map((month) => [month, { month, total: 0, orders: 0 }]),
  );
  for (const r of rows) {
    const bucket = byMonth.get(r.poDate.toISOString().slice(0, 7));
    if (!bucket) continue;
    bucket.total += Number(r.total);
    bucket.orders += 1;
  }
  return months.map((month) => {
    const m = byMonth.get(month) as MonthlySpend;
    return { ...m, total: Math.round(m.total * 100) / 100 };
  });
}

export interface ApprovalItem {
  type: "REQUISITION" | "PURCHASE_ORDER";
  id: number;
  number: string;
  /** Requester for a requisition, supplier for a PO. */
  party: string;
  /** Request date / PO date, `YYYY-MM-DD`. */
  date: string;
  total: number;
}

/** Oldest-waiting first across both document types, capped at `limit`. */
export function mergeApprovalQueue(
  items: readonly ApprovalItem[],
  limit: number,
): ApprovalItem[] {
  return [...items]
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        a.type.localeCompare(b.type) ||
        a.id - b.id,
    )
    .slice(0, limit);
}
