// Excel read/write helpers built on the `xlsx` package already used elsewhere in the app
// (see src/modules/hr/*.tsx for the existing export-only usage). This file adds the first
// import (read) path in the codebase, alongside export and template generation.
import * as XLSX from "xlsx";
import { FieldSchema, ParsedWorkbook, exportableFields } from "./types";

function autoColWidths(rows: (string | number)[][]): { wch: number }[] {
  const widths: number[] = [];
  rows.forEach((row) => {
    row.forEach((cell, i) => {
      const len = String(cell ?? "").length;
      widths[i] = Math.max(widths[i] || 10, Math.min(len + 2, 40));
    });
  });
  return widths.map((w) => ({ wch: w }));
}

/**
 * SheetJS's `sheet_to_json` only returns a value on the top-left cell of a merged range — every
 * other row/column the merge visually spans comes back blank, even though Excel shows it filled.
 * Real-world CRM trackers merge cells constantly (one "Domain"/"Name of the Company"/etc. cell
 * spanning a group of related rows), so without this, those rows fail Bulk Import's required-field
 * validation despite looking correctly filled in the source file. Forward-fills the anchor cell's
 * value into every cell its merge spans, mutating `raw` in place before headers/rows are read from it.
 */
function fillMergedCells(ws: XLSX.WorkSheet, raw: unknown[][]): void {
  const merges = ws["!merges"] || [];
  merges.forEach((merge) => {
    const anchorRow = raw[merge.s.r] as unknown[] | undefined;
    const anchorValue = anchorRow?.[merge.s.c];
    if (anchorValue === undefined || anchorValue === null || anchorValue === "")
      return;
    for (let r = merge.s.r; r <= merge.e.r; r++) {
      for (let c = merge.s.c; c <= merge.e.c; c++) {
        if (r === merge.s.r && c === merge.s.c) continue;
        if (!raw[r]) raw[r] = [];
        (raw[r] as unknown[])[c] = anchorValue;
      }
    }
  });
}

function sheetToParsedWorkbook(ws: XLSX.WorkSheet): ParsedWorkbook {
  // `blankrows: true` here (not the previous `false`) is required for `fillMergedCells` to work at
  // all: a merge range's `{s,e}` coordinates are the ORIGINAL sheet row/column indices, and
  // `blankrows: false` would have already spliced out any row that was entirely blank pre-fill
  // (e.g. one made up solely of merge-continuation cells), shifting every later row's index out of
  // alignment with those coordinates. Blank rows are filtered out manually below instead, after the
  // fill, so a row is only dropped once merged values have had a chance to fill it in.
  const raw: unknown[][] = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    defval: "",
    blankrows: true,
    raw: false,
  });
  if (raw.length === 0) return { headers: [], rows: [] };
  fillMergedCells(ws, raw);
  const headers = (raw[0] as unknown[]).map((h) => String(h ?? "").trim());
  const dataRows = raw
    .slice(1)
    .filter((r) =>
      (r as unknown[]).some((cell) => String(cell ?? "").trim() !== ""),
    );
  const rows = dataRows.map((r) =>
    headers.map((_, i) => String((r as unknown[])[i] ?? "").trim()),
  );
  return { headers, rows };
}

/** Reads an uploaded .xlsx/.xls/.csv File into a headers row + string data rows (first sheet only). */
export async function parseWorkbookFile(file: File): Promise<ParsedWorkbook> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: "array" });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return { headers: [], rows: [] };
  return sheetToParsedWorkbook(wb.Sheets[sheetName]);
}

export interface ParsedWorkbookSheet {
  sheetName: string;
  parsed: ParsedWorkbook;
}

/** Reads EVERY sheet of an uploaded .xlsx/.xls/.csv workbook, each into its own headers + string
 *  data rows — used by CRM Bulk Import's multi-sheet workflow (`../bulkImport/`), which routes each
 *  sheet to its own CRM module in one pass rather than importing only the first sheet like
 *  `parseWorkbookFile` above (kept as-is — every single-tab Bulk Import dialog still uses it). */
export async function parseWorkbookAllSheets(
  file: File,
): Promise<ParsedWorkbookSheet[]> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: "array" });
  return wb.SheetNames.map((sheetName) => ({
    sheetName,
    parsed: sheetToParsedWorkbook(wb.Sheets[sheetName]),
  }));
}

/** Exports an array of records to a downloaded .xlsx file, one row per record, using the given fields' labels as headers. */
export function exportRecordsToExcel<T>(
  records: T[],
  fields: FieldSchema<T>[],
  sheetName: string,
  fileBaseName: string,
): void {
  const exportFields = exportableFields(fields);
  const headerRow = exportFields.map((f) => f.label);
  const dataRows = records.map((record) =>
    exportFields.map((f) => {
      const value = f.exportValue
        ? f.exportValue(record)
        : (record as Record<string, unknown>)[f.key];
      return value ?? "";
    }),
  );
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([headerRow, ...dataRows]);
  ws["!cols"] = autoColWidths([headerRow, ...dataRows] as (
    string | number
  )[][]);
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  XLSX.writeFile(
    wb,
    `${fileBaseName}_${new Date().toISOString().split("T")[0]}.xlsx`,
  );
}

/** Downloads a blank import template with the correct CRM headers (matching Bulk Import's mapping) and one example row. */
export function downloadImportTemplate<T>(
  fields: FieldSchema<T>[],
  sheetName: string,
  fileBaseName: string,
  exampleRow?: Record<string, string>,
): void {
  const importFields = fields.filter((f) => !f.exportOnly);
  const headerRow = importFields.map((f) => f.label);
  const example = importFields.map((f) => exampleRow?.[f.key] ?? "");
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([headerRow, example]);
  ws["!cols"] = autoColWidths([headerRow, example]);
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  XLSX.writeFile(wb, `${fileBaseName}_import_template.xlsx`);
}

/** Downloads a plain error report (.xlsx) — one row per validation issue. */
export function downloadErrorReport(
  issues: { rowNumber: number; message: string }[],
  fileBaseName: string,
): void {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([
    ["Row", "Error"],
    ...issues.map((i) => [i.rowNumber, i.message]),
  ]);
  ws["!cols"] = [{ wch: 8 }, { wch: 80 }];
  XLSX.utils.book_append_sheet(wb, ws, "Errors");
  XLSX.writeFile(wb, `${fileBaseName}_import_errors.xlsx`);
}
