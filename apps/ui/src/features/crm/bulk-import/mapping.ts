import type {
  CrmImportFieldSpec,
  CrmImportRowInput,
} from "@texawave-erp/api-types";
import type { ParsedSheet } from "./excel";

/** Per-column target: a field key, or one of these two sentinels. */
export const IGNORE_COLUMN = "__ignore__";
/** Unrecognised header: auto-creates (idempotently) a custom field. */
export const CUSTOM_COLUMN = "__custom__";

/** Server exact/alias match result -> initial per-column target. An
 * unmatched, non-blank header defaults to a custom field (legacy
 * auto-create); a blank header is ignored. */
export function initialTargets(
  headers: readonly string[],
  matched: readonly (string | null)[],
): string[] {
  return headers.map((h, i) => {
    const m = matched[i];
    if (m) return m;
    return h.trim() ? CUSTOM_COLUMN : IGNORE_COLUMN;
  });
}

export function missingRequiredFields(
  fields: readonly CrmImportFieldSpec[],
  targets: readonly string[],
): CrmImportFieldSpec[] {
  return fields.filter((f) => f.required && !targets.includes(f.key));
}

/** Builds the commit payload rows: mapped columns -> `values` by field key
 * (first non-empty column wins if two columns target one field); custom
 * columns -> `custom` by original header. */
export function buildImportRows(
  sheet: Pick<ParsedSheet, "headers" | "rows">,
  targets: readonly string[],
): CrmImportRowInput[] {
  return sheet.rows.map((cells, idx) => {
    const values: Record<string, string> = {};
    const custom: Record<string, string> = {};
    targets.forEach((target, col) => {
      const cell = (cells[col] ?? "").trim();
      if (target === IGNORE_COLUMN) return;
      if (target === CUSTOM_COLUMN) {
        const header = (sheet.headers[col] ?? "").trim();
        if (header && cell && !custom[header]) custom[header] = cell;
        return;
      }
      if (cell && !values[target]) values[target] = cell;
    });
    return {
      rowNumber: idx + 1,
      values,
      ...(Object.keys(custom).length > 0 ? { custom } : {}),
    };
  });
}

export function chunk<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size)
    out.push(items.slice(i, i + size));
  return out;
}

export type CrmSheetKind =
  | "mining-rows"
  | "leads"
  | "meetings"
  | "call-back-send-info"
  | "not-interested"
  | "keep-in-touch"
  | "cold-calling"
  | "overall-data"
  | "unrecognized";

const normSheetName = (s: string) =>
  s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/\s*-\s*/g, "-");

/** Legacy `SHEET_NAME_TO_KIND`. */
const SHEET_KIND: Record<string, CrmSheetKind> = {
  "accounts mining sheet": "mining-rows",
  "accounts mining": "mining-rows",
  leads: "leads",
  "yet to happen": "meetings",
  "call back-send info": "call-back-send-info",
  "call back send info": "call-back-send-info",
  "not interested": "not-interested",
  "keep in touch": "keep-in-touch",
  "cold calling status": "cold-calling",
  "cold calling": "cold-calling",
  "overall data": "overall-data",
};

export function detectSheetKind(sheetName: string): CrmSheetKind {
  return SHEET_KIND[normSheetName(sheetName)] ?? "unrecognized";
}
