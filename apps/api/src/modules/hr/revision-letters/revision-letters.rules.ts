import { Prisma } from "@texawave-erp/database";
import { formatDateOnly } from "../../../common/dates/date-only.js";

/**
 * Pure rules for salary revision letters (legacy `RevisionLetter.tsx` and
 * `RevisionLetterTemplate.ts`). No I/O here — the repository owns persistence
 * and the document-number counter.
 */

/** Legacy form defaults. They are prefills in the legacy UI; the backend
 * applies them only when a create request omits the field. */
export const REVISION_LETTER_DEFAULTS = {
  location: "Chennai",
  signatoryName: "Amanullah Khan",
  signatoryDesignation: "Co-Founder",
} as const;

/** Prefix for the per-financial-year document-number counter. */
export const REVISION_DOC_PREFIX_ROOT = "TW/HR/REV";
export const REVISION_DOC_PADDING = 3;

/** India financial-year label such as "26-27" (April–March), from a UTC date.
 * Mirrors legacy `getFinancialYearLabel`, which runs on the issuing date. */
export function financialYearLabel(date: Date): string {
  const year = date.getUTCFullYear();
  const startYear = date.getUTCMonth() >= 3 ? year : year - 1; // April = index 3
  const endYear = startYear + 1;
  return `${String(startYear).slice(-2)}-${String(endYear).slice(-2)}`;
}

/** `TW/HR/REV/26-27/` — the counter prefix for one financial year. */
export function revisionDocPrefix(fy: string): string {
  return `${REVISION_DOC_PREFIX_ROOT}/${fy}/`;
}

/** Counter key in `platform.document_sequences`, one per financial year. */
export function revisionDocType(fy: string): string {
  return `hr_revision_letter_${fy}`;
}

/** Formats the issued number exactly as legacy `generateNextDocumentNo`. */
export function formatRevisionDocumentNo(
  prefix: string,
  padding: number,
  issued: number,
): string {
  return `${prefix}${String(issued).padStart(padding, "0")}`;
}

/** First day of the month after `today`, as `YYYY-MM-DD` (legacy default
 * effective date: "1st of next month, editable"). */
export function defaultEffectiveDate(today: Date): string {
  const first = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 1),
  );
  return formatDateOnly(first);
}

export interface SalaryComponents {
  basic: Prisma.Decimal;
  da: Prisma.Decimal;
  hra: Prisma.Decimal;
  ca: Prisma.Decimal;
}

/** Monthly gross = sum of the four components; annual = monthly × 12.
 * Exact decimal arithmetic, rounded to 2 dp for display. Legacy derives
 * `netMonthly = grossMonthly = basic+da+hra+ca` and `grossAnnual = ×12`. */
export function deriveGross(components: SalaryComponents): {
  grossMonthly: string;
  grossAnnual: string;
} {
  const monthly = components.basic
    .plus(components.da)
    .plus(components.hra)
    .plus(components.ca);
  return {
    grossMonthly: monthly.toFixed(2),
    grossAnnual: monthly.times(12).toFixed(2),
  };
}
