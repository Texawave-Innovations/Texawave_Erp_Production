/**
 * Ported verbatim from legacy TexaWave_ERP/src/modules/crm/domain/currency.ts
 * `round2()` — rounds to 2 decimal places without the classic
 * floating-point drift. `computeLineBreakdown` below, and every future
 * caller that needs identical line-item math (Quotes, when implemented),
 * must import this rather than re-deriving it — legacy's own comment on
 * `round2` states it is shared precisely so "a future rounding-mode
 * change only ever needs to happen in one place."
 */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export interface LineBreakdown {
  gross: number;
  discountAmount: number;
  taxableAmount: number;
  taxAmount: number;
  total: number;
}

/**
 * Ported verbatim from legacy's domain/dealProductsService.ts
 * `computeLineBreakdown` — same formula, same per-step rounding (each
 * intermediate step is rounded independently, not just the final total).
 * Legacy shares this one function between the Deal Products tab and
 * `QuoteForm.tsx`'s line table so both agree bit-for-bit on identical
 * inputs; this port exists so a future Quotes implementation can import
 * the same function instead of re-deriving the formula, per
 * Docs/CRM_PRODUCTS_LEGACY_PARITY.md §2.7.
 */
export function computeLineBreakdown(
  quantity: number,
  unitPrice: number,
  discountPercent = 0,
  taxPercent = 0,
): LineBreakdown {
  const gross = round2((quantity || 0) * (unitPrice || 0));
  const discountAmount = round2(gross * ((discountPercent || 0) / 100));
  const taxableAmount = round2(gross - discountAmount);
  const taxAmount = round2(taxableAmount * ((taxPercent || 0) / 100));
  const total = round2(taxableAmount + taxAmount);
  return { gross, discountAmount, taxableAmount, taxAmount, total };
}
