// CRM Core Domain — shared currency formatting. Opportunities/Quotes/Quotas can each be
// denominated in a different currency (`currency?: string` on each, defaulting to INR when
// unset), so anywhere amounts are combined across records must group by currency rather than
// summing raw numbers and slapping a single ₹ symbol on the result.
import { CrmQuotationStatus } from "./types";
import { CURRENCY_SYMBOLS } from "@/lib/currencySymbols";

export const CRM_CURRENCY_SYMBOLS = CURRENCY_SYMBOLS;

/** Badge styling per Quotation status — shared by QuoteForm.tsx and Quotes.tsx so the list view
 *  and the edit/detail view can never disagree on what a status looks like. */
export const QUOTATION_STATUS_STYLE: Record<CrmQuotationStatus, string> = {
  Draft: "bg-slate-100 text-slate-600 border-slate-200",
  Sent: "bg-blue-50 text-blue-700 border-blue-200",
  Accepted: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Rejected: "bg-red-50 text-red-700 border-red-200",
  Expired: "bg-amber-50 text-amber-700 border-amber-200",
};

export function currencySymbol(code?: string): string {
  const c = code || "INR";
  return CRM_CURRENCY_SYMBOLS[c] || `${c} `;
}

/** Rounds to 2 decimal places without the classic floating-point drift — shared by every module
 *  that computes money math (this file's formatMoney, and dealProductsService.ts's line-item
 *  totals) so a future rounding-mode change only ever needs to happen in one place. */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Formats a monetary amount with its currency symbol, e.g. `"₹1,20,000.00"` — shared by
 *  QuoteForm.tsx and Quotes.tsx so a rounding fix in one always reaches the other. */
export function formatMoney(amount: number, code?: string): string {
  const formatted = round2(amount).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${currencySymbol(code)}${formatted}`;
}

/** Groups `items` by currency (missing/blank -> INR) and sums each group separately, instead of
 *  adding raw numbers across currencies. Renders as `"₹1,20,000"`, or `"₹1,20,000 + $500"` when
 *  more than one currency is present in the set. */
export function formatMultiCurrencyTotal(
  items: Array<{ amount: number; currency?: string }>,
): string {
  const byCurrency = new Map<string, number>();
  items.forEach(({ amount, currency }) => {
    const c = currency || "INR";
    byCurrency.set(c, (byCurrency.get(c) || 0) + amount);
  });
  if (byCurrency.size === 0) return `${currencySymbol("INR")}0`;
  return Array.from(byCurrency.entries())
    .map(([c, total]) => `${currencySymbol(c)}${total.toLocaleString("en-IN")}`)
    .join(" + ");
}
