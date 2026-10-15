import { parseDateOnly } from "../../../common/dates/date-only.js";

/**
 * Payments Received — pure rules, no I/O.
 *
 * A payment's due date is when the invoice's remaining balance is due: the
 * payment's own `dueDate`, else the invoice's. A payment is overdue while
 * its invoice still has a balance (UNPAID / PARTIALLY_PAID) and that date
 * has passed.
 */

/** The codes the first payments API took, and the labels they print as. */
export const LEGACY_MODE_LABELS: Readonly<Record<string, string>> = {
  CASH: "Cash",
  BANK_TRANSFER: "Bank Transfer",
  UPI: "UPI",
  CHEQUE: "Cheque",
  CARD: "Card",
  OTHER: "Other",
};

/** A typed mode as stored: an old code becomes its label. */
export function modeLabel(mode: string): string {
  const text = mode.trim();
  return LEGACY_MODE_LABELS[text] ?? text;
}

/** Statuses with a balance left to pay. */
export const OPEN_INVOICE_STATUSES = ["UNPAID", "PARTIALLY_PAID"] as const;

/** `2026-02` → 1 Feb … 28 Feb 2026 (inclusive, date-only). */
export function monthRange(month: string): { from: Date; to: Date } {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const from = parseDateOnly(`${month}-01`);
  const to = new Date(Date.UTC(y, m, 0));
  return { from, to };
}

export function effectiveDueDate(
  paymentDue: Date | null,
  invoiceDue: Date | null,
): Date | null {
  return paymentDue ?? invoiceDue;
}

const DAY_MS = 86_400_000;

/** Days past due (≥ 1) while the invoice is open, else null. */
export function overdueDays(
  due: Date | null,
  invoiceStatus: string,
  today: Date,
): number | null {
  if (!due) return null;
  if (!(OPEN_INVOICE_STATUSES as readonly string[]).includes(invoiceStatus)) {
    return null;
  }
  const days = Math.floor((today.getTime() - due.getTime()) / DAY_MS);
  return days >= 1 ? days : null;
}
