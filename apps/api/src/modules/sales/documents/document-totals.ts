import { Prisma } from "@texawave-erp/database";
import { BusinessRuleViolationException } from "../../../common/exceptions/business.exception.js";

/**
 * Pure money rules for quotations and invoices. No I/O. Decimal arithmetic
 * throughout (never JS floats); every stored amount has 2 decimals.
 *
 * - line amount        = quantity × unit price (rounded to the paisa)
 * - items subtotal     = Σ line amounts
 * - taxable amount     = items subtotal + transport charge
 * - tax mode           = INTRA when the place of supply is the supplier's
 *                        state (CGST + SGST), else INTER (IGST)
 * - each tax amount    = taxable × rate / 100 (rounded to the paisa)
 * - total              = taxable + taxes, rounded to the whole rupee
 * - round off          = total − (taxable + taxes)
 */

type Dec = Prisma.Decimal;
const D = (v: Prisma.Decimal.Value) => new Prisma.Decimal(v);
const HALF_UP = Prisma.Decimal.ROUND_HALF_UP;
const paisa = (v: Dec) => v.toDecimalPlaces(2, HALF_UP);

export type TaxMode = "INTRA" | "INTER";

export interface RateSet {
  cgstRate: number | null;
  sgstRate: number | null;
  igstRate: number | null;
}

export interface ResolvedRates {
  taxMode: TaxMode;
  cgstRate: Dec;
  sgstRate: Dec;
  igstRate: Dec;
}

export function taxModeFor(
  supplierStateCode: string,
  placeOfSupply: string,
): TaxMode {
  return supplierStateCode === placeOfSupply ? "INTRA" : "INTER";
}

/**
 * The rates a document is taxed at. Each rate comes from the document if it
 * was entered there, else from the customer (rates are manual — there is no
 * built-in default). Intra-state needs CGST and SGST; inter-state needs IGST,
 * or — when only CGST/SGST were entered, as on the legacy form — their sum.
 * The rates of the other mode are stored as 0.
 */
export function resolveRates(
  mode: TaxMode,
  entered: RateSet,
  customer: RateSet,
): ResolvedRates {
  const cgst = entered.cgstRate ?? customer.cgstRate;
  const sgst = entered.sgstRate ?? customer.sgstRate;
  const zero = D(0);
  if (mode === "INTRA") {
    if (cgst === null || sgst === null) {
      throw new BusinessRuleViolationException(
        "Intra-state supply needs a CGST and an SGST rate (enter them on the document or the customer)",
        "GST_RATE_REQUIRED",
      );
    }
    return {
      taxMode: mode,
      cgstRate: D(cgst),
      sgstRate: D(sgst),
      igstRate: zero,
    };
  }
  const igst =
    entered.igstRate ??
    (entered.cgstRate !== null && entered.sgstRate !== null
      ? entered.cgstRate + entered.sgstRate
      : null) ??
    customer.igstRate ??
    (cgst !== null && sgst !== null ? cgst + sgst : null);
  if (igst === null) {
    throw new BusinessRuleViolationException(
      "Inter-state supply needs an IGST rate (or CGST + SGST rates to add up)",
      "GST_RATE_REQUIRED",
    );
  }
  if (igst > 100) {
    throw new BusinessRuleViolationException(
      "The IGST rate cannot exceed 100%",
      "GST_RATE_INVALID",
    );
  }
  return { taxMode: mode, cgstRate: zero, sgstRate: zero, igstRate: D(igst) };
}

export interface LineInput {
  quantity: number;
  unitPrice: number;
}

export interface DocumentTotals {
  lineAmounts: Dec[];
  itemsSubtotal: Dec;
  transportCharge: Dec;
  taxableAmount: Dec;
  cgstAmount: Dec;
  sgstAmount: Dec;
  igstAmount: Dec;
  roundOff: Dec;
  totalAmount: Dec;
}

export function computeTotals(
  lines: readonly LineInput[],
  transportCharge: number,
  rates: ResolvedRates,
): DocumentTotals {
  const lineAmounts = lines.map((l) => paisa(D(l.quantity).times(l.unitPrice)));
  const itemsSubtotal = lineAmounts.reduce((a, b) => a.plus(b), D(0));
  const transport = paisa(D(transportCharge));
  const taxableAmount = itemsSubtotal.plus(transport);
  const tax = (rate: Dec) => paisa(taxableAmount.times(rate).dividedBy(100));
  const cgstAmount = tax(rates.cgstRate);
  const sgstAmount = tax(rates.sgstRate);
  const igstAmount = tax(rates.igstRate);
  const raw = taxableAmount.plus(cgstAmount).plus(sgstAmount).plus(igstAmount);
  const totalAmount = raw.toDecimalPlaces(0, HALF_UP);
  return {
    lineAmounts,
    itemsSubtotal,
    transportCharge: transport,
    taxableAmount,
    cgstAmount,
    sgstAmount,
    igstAmount,
    roundOff: totalAmount.minus(raw),
    totalAmount,
  };
}

export type PaymentStatus = "UNPAID" | "PARTIALLY_PAID" | "PAID";

/** An invoice's payment status from what has been received. */
export function paymentStatus(total: Dec, received: Dec): PaymentStatus {
  if (received.isZero()) return total.isZero() ? "PAID" : "UNPAID";
  return received.greaterThanOrEqualTo(total) ? "PAID" : "PARTIALLY_PAID";
}
