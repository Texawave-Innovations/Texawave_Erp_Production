/**
 * Pure rules for promotion letters. A promotion letter is a revision letter
 * with a new designation from the master, so the financial-year, default
 * effective date, gross derivation and form defaults are the revision-letter
 * rules, re-exported here rather than copied. Only the document numbering is
 * the promotion letter's own. No I/O here.
 */
export {
  defaultEffectiveDate,
  deriveGross,
  financialYearLabel,
  REVISION_LETTER_DEFAULTS as PROMOTION_LETTER_DEFAULTS,
} from "../revision-letters/revision-letters.rules.js";

/** Prefix for the per-financial-year document-number counter. */
export const PROMOTION_DOC_PREFIX_ROOT = "TW/HR/PRO";
export const PROMOTION_DOC_PADDING = 3;

/** `TW/HR/PRO/26-27/` — the counter prefix for one financial year. */
export function promotionDocPrefix(fy: string): string {
  return `${PROMOTION_DOC_PREFIX_ROOT}/${fy}/`;
}

/** Counter key in `platform.document_sequences`, one per financial year. */
export function promotionDocType(fy: string): string {
  return `hr_promotion_letter_${fy}`;
}

export function formatPromotionDocumentNo(
  prefix: string,
  padding: number,
  issued: number,
): string {
  return `${prefix}${String(issued).padStart(padding, "0")}`;
}

export type SalaryHistoryKind = "REVISION" | "PROMOTION";

export interface SalaryHistoryEntry {
  kind: SalaryHistoryKind;
  id: number;
  effectiveDate: string;
}

/** Newest effective date first; on a tie the later-issued letter (higher id,
 * promotions after revisions) first. Dates are `YYYY-MM-DD`, so string order
 * is date order. */
export function compareSalaryHistory(
  a: SalaryHistoryEntry,
  b: SalaryHistoryEntry,
): number {
  if (a.effectiveDate !== b.effectiveDate) {
    return a.effectiveDate < b.effectiveDate ? 1 : -1;
  }
  if (a.kind !== b.kind) return a.kind === "PROMOTION" ? -1 : 1;
  return b.id - a.id;
}
