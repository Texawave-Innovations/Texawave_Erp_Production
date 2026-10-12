// Shared Bulk Import / Excel Export engine for the CRM module.
// Used by every CRM data tab (sheet tabs + CRM Core Domain tabs) — one implementation of
// header-matching, mapping, validation, duplicate handling and batch import so each tab only
// needs to declare its own field schema and a `commitImport` function.

export type ImportFieldType =
  "string" | "number" | "currency" | "email" | "date" | "select" | "boolean";

export interface FieldRelation {
  /** Display label for the related entity, e.g. "Account". */
  label: string;
  /** Resolve a raw cell value (already trimmed) to an existing record's id, or undefined if no match. */
  lookup: (raw: string) => string | undefined;
  /** When true, a value that fails to resolve is a validation error rather than left blank. */
  required?: boolean;
}

export interface FieldSchema<T = Record<string, unknown>> {
  /** Target CRM field key. */
  key: string;
  /** CRM field display name — also the Excel template header and default export column header. */
  label: string;
  /** Extra header spellings that should confidently auto-map to this field (case/whitespace-insensitive). */
  aliases?: string[];
  required?: boolean;
  type?: ImportFieldType;
  /** Options for a 'select' field — import value must match one (case-insensitive) or validation fails. */
  options?: string[];
  /** One of the fields used to detect duplicate rows against existing CRM records. */
  isDuplicateKey?: boolean;
  /** Export-side: compute the cell value from a full record. Defaults to `record[key]`. */
  exportValue?: (record: T) => string | number | undefined;
  /** Import-side: resolve this field to an existing record's id (Account, Contact, Product, ...). */
  relation?: FieldRelation;
  /** Column is import-only (e.g. relation ids) — omitted from the export template's example guidance. */
  importOnly?: boolean;
  /** Excluded from Bulk Import entirely — export-only column (e.g. computed/read-only fields). */
  exportOnly?: boolean;
  /** True for a field auto-created by CRM Bulk Import because no built-in field matched the Excel
   *  header (see `../bulkImport/crmCustomFieldsService.ts`) — tells a module's commit function to
   *  nest this value under `record.customFields[key]` instead of writing `record[key]` directly. */
  custom?: boolean;
}

/** Fields that belong on an export (Excel or document) — everything except an import-only column
 *  (e.g. a relation id) that was never meant to be shown back to the user. Shared by `excelIO.ts`
 *  and `documentExport.ts` so a future third export target can't silently diverge on which columns
 *  it includes. */
export function exportableFields<T>(
  fields: FieldSchema<T>[],
): FieldSchema<T>[] {
  return fields.filter((f) => !f.importOnly || f.exportOnly);
}

export type HeaderMapping = Record<number, string | null>; // excel column index -> field key | null (ignored)

export interface ParsedWorkbook {
  headers: string[];
  rows: string[][];
}

export type DuplicateStrategy = "skip" | "update" | "create";

export interface ImportRowIssue {
  rowNumber: number; // 1-based, excludes header row
  message: string;
}

export interface MappedImportRow {
  rowNumber: number;
  /** field key -> parsed value */
  data: Record<string, unknown>;
  errors: string[];
  isDuplicate: boolean;
  /** Existing record's id, when this row matched one (needed for the "update" duplicate strategy). */
  duplicateId?: string;
  /** Human-readable label for the matched existing record (shown in the preview). */
  duplicateLabel?: string;
}

export interface ImportSummary {
  totalRows: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  errors?: string[];
}

export interface DuplicateConfig {
  /** Field keys (from the schema) used to detect a duplicate. A row matches when ALL of these
   *  values (case-insensitive, trimmed) are present in the mapped row. */
  keys: string[];
  /** Look up an existing record matching the mapped row's duplicate-key values. */
  findExisting: (
    mapped: Record<string, unknown>,
  ) => { id: string; label: string } | undefined;
}
