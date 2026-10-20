import { BusinessRuleViolationException } from "../../../common/exceptions/business.exception.js";

/** Rounds to 2 decimals without classic floating-point drift. */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Line amounts. The discount is clamped to the gross amount so a line can
 * never go negative (legacy `lineTotal`). */
export function lineTotal(
  qty: number,
  unitPrice: number,
  discount: number,
  taxRate: number,
) {
  const gross = Math.max(0, qty) * Math.max(0, unitPrice);
  const afterDiscount = Math.max(0, gross - Math.max(0, discount));
  const taxAmount = round2(afterDiscount * (Math.max(0, taxRate) / 100));
  const total = round2(afterDiscount + taxAmount);
  return { taxAmount, total };
}

export interface PricedLine {
  productName: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  taxAmount: number;
}

/** Document totals, with the subtotal clamped per line exactly like
 * `lineTotal`. This is the single implementation — legacy had two independent
 * ones that could drift. */
export function documentTotals(
  lines: PricedLine[],
  freight: number,
  discount: number,
) {
  const subtotal = round2(
    lines.reduce(
      (s, it) => s + Math.max(0, it.quantity * it.unitPrice - it.discount),
      0,
    ),
  );
  const taxAmount = round2(lines.reduce((s, it) => s + it.taxAmount, 0));
  const total = round2(subtotal + taxAmount + freight - discount);
  return { subtotal, taxAmount, total };
}

/** Rejects negative prices/charges and a line discount larger than the
 * line's gross amount. Throws a 422 naming the offending line. */
export function assertValidPricing(
  lines: PricedLine[],
  freight: number,
  discount: number,
): void {
  const fail = (message: string): never => {
    throw new BusinessRuleViolationException(message, "INVALID_PRICING");
  };
  for (const it of lines) {
    if (it.unitPrice < 0)
      fail(`${it.productName}: unit price cannot be negative`);
    if (it.discount < 0) fail(`${it.productName}: discount cannot be negative`);
    if (it.discount > it.quantity * it.unitPrice) {
      fail(`${it.productName}: discount cannot exceed the line amount`);
    }
  }
  if (freight < 0) fail("Freight cannot be negative");
  if (discount < 0) fail("Overall discount cannot be negative");
}

/** Throws when a product appears on more than one line. */
export function assertNoDuplicateProducts(
  lines: { productId: number }[],
  label: (productId: number) => string,
): void {
  const seen = new Set<number>();
  for (const { productId } of lines) {
    if (seen.has(productId)) {
      throw new BusinessRuleViolationException(
        `${label(productId)} appears on more than one line — combine them into one line`,
        "DUPLICATE_PRODUCT",
      );
    }
    seen.add(productId);
  }
}

export const RFQ_OPEN_FOR_RESPONSES = [
  "RESPONSES_PENDING",
  "PARTIALLY_RESPONDED",
  "RESPONDED",
] as const;
export const SELECTABLE_QUOTATION_STATUSES = [
  "RECEIVED",
  "SHORTLISTED",
] as const;
export const RECEIVABLE_PO_STATUSES = ["SENT", "PARTIALLY_RECEIVED"] as const;
export const OPEN_PO_STATUSES = [
  "APPROVED",
  "SENT",
  "PARTIALLY_RECEIVED",
] as const;
export const CANCELLABLE_PO_STATUSES = [
  "DRAFT",
  "PENDING_APPROVAL",
  "APPROVED",
  "SENT",
] as const;
export const CLOSABLE_PO_STATUSES = ["RECEIVED", "PARTIALLY_RECEIVED"] as const;
