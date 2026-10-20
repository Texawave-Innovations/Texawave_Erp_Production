/** Client-side preview of the server's authoritative pricing math
 * (apps/api/src/modules/scm/procurement/procurement.helpers.ts). The API
 * always recomputes these amounts; this only drives live totals in forms. */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

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
  return { taxAmount, total, afterDiscount };
}

export interface PricedDraft {
  quantity: number;
  unitPrice: number;
  discount: number;
  taxRate: number;
}

export function documentTotals(
  lines: PricedDraft[],
  freight: number,
  discount: number,
) {
  let subtotal = 0;
  let tax = 0;
  for (const l of lines) {
    const t = lineTotal(l.quantity, l.unitPrice, l.discount, l.taxRate);
    subtotal += t.afterDiscount;
    tax += t.taxAmount;
  }
  subtotal = round2(subtotal);
  tax = round2(tax);
  return { subtotal, tax, total: round2(subtotal + tax + freight - discount) };
}

export function today(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}
