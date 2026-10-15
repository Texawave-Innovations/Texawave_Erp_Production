/**
 * Sales master list — code formats. Pure, no I/O.
 *
 * A code is `<PREFIX>-<COUNTRY>-<NUMBER>`, e.g. CUS-IN-001: the prefix and
 * the number width come from the master list, the country from the record,
 * and the number from a per-organization, per-country counter. A code type
 * nobody has configured yet uses its default below.
 */
export const CODE_TYPES = ["customer"] as const;
export type CodeType = (typeof CODE_TYPES)[number];

export interface CodeFormat {
  prefix: string;
  padding: number;
}

export const DEFAULT_CODE_FORMATS: Readonly<Record<CodeType, CodeFormat>> = {
  customer: { prefix: "CUS", padding: 3 },
};

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
