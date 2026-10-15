/**
 * Sales master list — code formats. Pure, no I/O.
 *
 * Two shapes:
 * - a customer code is `<PREFIX>-<COUNTRY>-<NUMBER>`, e.g. CUS-IN-001, from a
 *   per-organization, per-country counter;
 * - a document number is `<PREFIX>/<FY>/<NUMBER>`, e.g. TW/QUO/26-27/0001,
 *   from a per-organization, per-type counter that restarts every financial
 *   year (April–March).
 *
 * The prefix and the number width come from the master list; a code type
 * nobody has configured yet uses its default below.
 */
export const CODE_TYPES = [
  "customer",
  "quotation",
  "proforma_invoice",
  "tax_invoice",
  "delivery_challan",
] as const;
export type CodeType = (typeof CODE_TYPES)[number];
export type DocumentCodeType = Exclude<CodeType, "customer">;

export interface CodeFormat {
  prefix: string;
  padding: number;
}

export const DEFAULT_CODE_FORMATS: Readonly<Record<CodeType, CodeFormat>> = {
  customer: { prefix: "CUS", padding: 3 },
  quotation: { prefix: "TW/QUO", padding: 4 },
  proforma_invoice: { prefix: "TW/PI", padding: 4 },
  tax_invoice: { prefix: "TW/IN", padding: 4 },
  delivery_challan: { prefix: "TW/DC", padding: 4 },
};

/** A customer prefix has no separators (it is joined with dashes). */
export const CUSTOMER_PREFIX_PATTERN = /^[A-Z][A-Z0-9]{0,9}$/;
/** A document prefix may hold `/`-separated parts, e.g. TW/QUO. */
export const DOCUMENT_PREFIX_PATTERN = /^[A-Z][A-Z0-9]*(\/[A-Z0-9]+)*$/;

export function isCodeType(value: string): value is CodeType {
  return (CODE_TYPES as readonly string[]).includes(value);
}

/** CUS + IN + 7 (padding 3) → `CUS-IN-007`; grows past the width
 * (`CUS-IN-1000`). */
export function formatCode(
  format: CodeFormat,
  country: string,
  issued: number,
): string {
  return `${format.prefix}-${country}-${String(issued).padStart(format.padding, "0")}`;
}

/** The `platform.document_sequences` counter key for one code type and
 * country, e.g. `sales_customer_IN`. */
export function sequenceDocType(codeType: CodeType, country: string): string {
  return `sales_${codeType}_${country}`;
}

/** The financial year (April–March) a date falls in, as the two-digit label
 * printed in document numbers: 15 Oct 2026 → `26-27`, 10 Feb 2027 → `26-27`. */
export function fiscalYearLabel(date: Date): string {
  const start =
    date.getUTCMonth() >= 3 ? date.getUTCFullYear() : date.getUTCFullYear() - 1;
  const two = (y: number) => String(y % 100).padStart(2, "0");
  return `${two(start)}-${two(start + 1)}`;
}

/** TW/QUO + 26-27 + 7 (padding 4) → `TW/QUO/26-27/0007`. */
export function formatDocumentNumber(
  format: CodeFormat,
  fiscalYear: string,
  issued: number,
): string {
  return `${format.prefix}/${fiscalYear}/${String(issued).padStart(format.padding, "0")}`;
}

/** The counter key for one document type and financial year, e.g.
 * `sales_quotation_26-27` — so numbering restarts each year. */
export function documentSequenceDocType(
  codeType: DocumentCodeType,
  fiscalYear: string,
): string {
  return `sales_${codeType}_${fiscalYear}`;
}

/** What the first code of a type looks like, for the master-list screen. */
export function exampleCode(
  codeType: CodeType,
  format: CodeFormat,
  today: Date,
): string {
  return codeType === "customer"
    ? formatCode(format, "IN", 1)
    : formatDocumentNumber(format, fiscalYearLabel(today), 1);
}
