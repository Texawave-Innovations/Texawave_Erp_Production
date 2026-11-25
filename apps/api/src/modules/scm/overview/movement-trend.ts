import { businessDateOf } from "../../../common/dates/business-date.js";

/** One IST business day of stock movement, summed across every product/warehouse. */
export interface MovementTrendDay {
  /** `YYYY-MM-DD` (IST). */
  date: string;
  inbound: number;
  outbound: number;
}

export interface MovementRow {
  transactionDate: Date;
  quantityIn: number | { toString(): string };
  quantityOut: number | { toString(): string };
}

/** The `days` IST dates ending at `today`, oldest first. */
export function trendDates(today: string, days: number): string[] {
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(`${today}T00:00:00.000Z`);
    d.setUTCDate(d.getUTCDate() - (days - 1 - i));
    return d.toISOString().slice(0, 10);
  });
}

/** Start of an IST calendar day as an instant (IST is UTC+05:30, no DST). */
export function istDayStart(date: string): Date {
  return new Date(`${date}T00:00:00.000+05:30`);
}

/**
 * Sums ledger quantities into IST business days. Rows outside `dates` are
 * ignored; days with no movement are kept as zeroes so the chart has no gaps.
 */
export function bucketMovements(
  rows: readonly MovementRow[],
  dates: readonly string[],
): MovementTrendDay[] {
  const byDate = new Map<string, MovementTrendDay>(
    dates.map((date) => [date, { date, inbound: 0, outbound: 0 }]),
  );
  for (const r of rows) {
    const day = byDate.get(businessDateOf(r.transactionDate));
    if (!day) continue;
    day.inbound += Number(r.quantityIn);
    day.outbound += Number(r.quantityOut);
  }
  return dates.map((date) => {
    const d = byDate.get(date) as MovementTrendDay;
    // Ledger quantities are Decimal(14,3); keep that precision, drop float noise.
    return {
      date,
      inbound: Math.round(d.inbound * 1000) / 1000,
      outbound: Math.round(d.outbound * 1000) / 1000,
    };
  });
}
