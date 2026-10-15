import type { Prisma } from "@texawave-erp/database";
import { BusinessRuleViolationException } from "../../../common/exceptions/business.exception.js";
import { gstStateName } from "../shared/gst.js";
import {
  computeTotals,
  type RateSet,
  resolveRates,
  taxModeFor,
  type TaxMode,
} from "./document-totals.js";

/**
 * Pure rules shared by quotations, invoices and delivery challans. No I/O.
 */

/** The customer fields a document needs (a subset of the customer view). */
export interface CustomerForDocument {
  id: number;
  customerCode: string;
  companyName: string;
  contactPerson: string;
  email: string;
  mobileCountryCode: string;
  mobileNumber: string;
  gstin: string | null;
  stateCode: string | null;
  cgstRate: Prisma.Decimal | null;
  sgstRate: Prisma.Decimal | null;
  igstRate: Prisma.Decimal | null;
  status: string;
  addresses: Array<{
    addressType: string;
    street: string;
    area: string | null;
    city: string;
    stateCode: string;
    pincode: string;
    country: string;
    isDefault: boolean;
  }>;
}

/** The customer as printed, frozen on the document when it is saved. */
export interface CustomerSnapshot {
  customerId: number;
  customerCode: string;
  companyName: string;
  contactPerson: string;
  email: string;
  mobile: string;
  gstin: string | null;
  stateCode: string | null;
  stateName: string | null;
  billingAddress: string | null;
  shippingAddress: string | null;
}

type Address = CustomerForDocument["addresses"][number];

function pick(c: CustomerForDocument, type: string): Address | null {
  const of = c.addresses.filter((a) => a.addressType === type);
  return of.find((a) => a.isDefault) ?? of[0] ?? null;
}

function formatAddress(a: Address | null): string | null {
  if (!a) return null;
  const state = gstStateName(a.stateCode);
  return [a.street, a.area, `${a.city} - ${a.pincode}`, state, a.country]
    .filter((p) => p)
    .join(", ");
}

export function customerSnapshot(c: CustomerForDocument): CustomerSnapshot {
  const billing = pick(c, "BILLING");
  return {
    customerId: c.id,
    customerCode: c.customerCode,
    companyName: c.companyName,
    contactPerson: c.contactPerson,
    email: c.email,
    mobile: `${c.mobileCountryCode} ${c.mobileNumber}`,
    gstin: c.gstin,
    stateCode: c.stateCode ?? billing?.stateCode ?? null,
    stateName: gstStateName(c.stateCode ?? billing?.stateCode ?? null),
    billingAddress: formatAddress(billing),
    shippingAddress: formatAddress(pick(c, "SHIPPING")),
  };
}

/** New documents may only be raised for active customers. */
export function assertCustomerActive(c: CustomerForDocument): void {
  if (c.status !== "ACTIVE") {
    throw new BusinessRuleViolationException(
      `Customer ${c.customerCode} is inactive`,
      "CUSTOMER_INACTIVE",
    );
  }
}

/** Entered place of supply, else the customer's GST state, else the state
 * of its default billing address. */
export function placeOfSupplyFor(
  c: CustomerForDocument,
  entered: string | null | undefined,
): string {
  const state = entered ?? c.stateCode ?? pick(c, "BILLING")?.stateCode;
  if (!state) {
    throw new BusinessRuleViolationException(
      `Customer ${c.customerCode} has no GST state or billing address; enter the place of supply`,
      "PLACE_OF_SUPPLY_REQUIRED",
    );
  }
  if (!gstStateName(state)) {
    throw new BusinessRuleViolationException(
      `Unknown GST state code "${state}"`,
      "INVALID_STATE_CODE",
    );
  }
  return state;
}

export function customerRates(c: CustomerForDocument): RateSet {
  const n = (v: Prisma.Decimal | null) => (v === null ? null : v.toNumber());
  return {
    cgstRate: n(c.cgstRate),
    sgstRate: n(c.sgstRate),
    igstRate: n(c.igstRate),
  };
}

export interface PricingInput {
  lines: ReadonlyArray<{
    description: string;
    hsnCode?: string | null | undefined;
    quantity: number;
    unitPrice: number;
  }>;
  transportCharge: number;
  /** Rates entered on the document; null = take the customer's. */
  rates: RateSet;
}

export interface PricedColumns {
  supplierStateCode: string;
  placeOfSupply: string;
  taxMode: TaxMode;
  transportCharge: Prisma.Decimal;
  cgstRate: Prisma.Decimal;
  sgstRate: Prisma.Decimal;
  igstRate: Prisma.Decimal;
  itemsSubtotal: Prisma.Decimal;
  taxableAmount: Prisma.Decimal;
  cgstAmount: Prisma.Decimal;
  sgstAmount: Prisma.Decimal;
  igstAmount: Prisma.Decimal;
  roundOff: Prisma.Decimal;
  totalAmount: Prisma.Decimal;
}

export interface PricedLine {
  lineNo: number;
  description: string;
  hsnCode: string | null;
  quantity: number;
  unitPrice: number;
  amount: Prisma.Decimal;
}

/** Tax mode, rates, line amounts and totals for a quotation or invoice. */
export function price(
  input: PricingInput,
  customer: CustomerForDocument,
  supplierStateCode: string,
  placeOfSupply: string,
): { columns: PricedColumns; lines: PricedLine[] } {
  const mode = taxModeFor(supplierStateCode, placeOfSupply);
  const rates = resolveRates(mode, input.rates, customerRates(customer));
  const totals = computeTotals(input.lines, input.transportCharge, rates);
  return {
    columns: {
      supplierStateCode,
      placeOfSupply,
      taxMode: mode,
      transportCharge: totals.transportCharge,
      cgstRate: rates.cgstRate,
      sgstRate: rates.sgstRate,
      igstRate: rates.igstRate,
      itemsSubtotal: totals.itemsSubtotal,
      taxableAmount: totals.taxableAmount,
      cgstAmount: totals.cgstAmount,
      sgstAmount: totals.sgstAmount,
      igstAmount: totals.igstAmount,
      roundOff: totals.roundOff,
      totalAmount: totals.totalAmount,
    },
    lines: input.lines.map((l, i) => ({
      lineNo: i + 1,
      description: l.description,
      hsnCode: l.hsnCode ?? null,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      amount: totals.lineAmounts[i] as Prisma.Decimal,
    })),
  };
}

/** The rates a saved document was entered with, as "entered" values for a
 * re-price: the rates of its tax mode, nothing for the other mode. */
export function storedRates(doc: {
  taxMode: string;
  cgstRate: Prisma.Decimal;
  sgstRate: Prisma.Decimal;
  igstRate: Prisma.Decimal;
}): RateSet {
  return doc.taxMode === "INTRA"
    ? {
        cgstRate: doc.cgstRate.toNumber(),
        sgstRate: doc.sgstRate.toNumber(),
        igstRate: null,
      }
    : { cgstRate: null, sgstRate: null, igstRate: doc.igstRate.toNumber() };
}

/** `undefined` keeps the stored value, anything else (incl. null) replaces
 * it. */
export function pickDefined<T>(entered: T | undefined, stored: T): T {
  return entered === undefined ? stored : entered;
}

/** Today in UTC as a date-only `YYYY-MM-DD`. */
export function todayDateOnly(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/** Digits for a wa.me link from a stored "+91 98765 43210". */
export function whatsappNumber(mobile: string): string {
  return mobile.replace(/[^0-9]/g, "");
}
