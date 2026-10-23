export const BILL_STATUSES = [
  "OPEN",
  "PARTIALLY_PAID",
  "PAID",
  "CANCELLED",
] as const;
export type BillStatus = (typeof BILL_STATUSES)[number];

export const PAYMENT_MODES = [
  "BANK_TRANSFER",
  "CASH",
  "CHEQUE",
  "UPI",
  "CARD",
  "OTHER",
] as const;

export const PAYMENT_STATUSES = ["POSTED", "VOIDED"] as const;

export const DOCUMENT_TYPES = [
  "GST_CERTIFICATE",
  "PAN",
  "BANK_DETAILS",
  "CONTRACT",
  "COMPLIANCE",
  "OTHER",
] as const;

const cents = (n: number) => Math.round(n * 100);

/** Status a bill takes from what has been paid against it. CANCELLED is a
 * terminal state set explicitly, never derived. */
export function billStatusFor(total: number, paid: number): BillStatus {
  if (cents(paid) <= 0) return "OPEN";
  return cents(paid) >= cents(total) ? "PAID" : "PARTIALLY_PAID";
}

/** Amount still payable on a bill, never negative. */
export function outstanding(total: number, paid: number): number {
  return Math.max(0, (cents(total) - cents(paid)) / 100);
}

/** `Net 30` / `30 Days` / `45` -> 30 / 30 / 45; null when no day count. */
export function paymentTermDays(
  terms: string | null | undefined,
): number | null {
  const match = /(\d{1,3})/.exec(terms ?? "");
  return match ? Number(match[1]) : null;
}

/** Due date from the bill date and the supplier's payment terms (`YYYY-MM-DD`). */
export function dueDateFrom(
  billDate: string,
  terms: string | null | undefined,
): string | null {
  const days = paymentTermDays(terms);
  if (days === null) return null;
  const d = new Date(`${billDate}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** A bill is overdue while it is unpaid, not cancelled and past its due date. */
export function isOverdue(
  bill: { status: string; dueDate: Date | null },
  today: Date = new Date(),
): boolean {
  if (!bill.dueDate) return false;
  if (bill.status !== "OPEN" && bill.status !== "PARTIALLY_PAID") return false;
  const t = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return bill.dueDate.getTime() < t;
}
