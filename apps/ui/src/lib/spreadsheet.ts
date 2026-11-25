/**
 * The one Excel export for the app. Every "Export to Excel" button builds a
 * real `.xlsx` through this helper instead of hand-rolling a CSV.
 *
 * Why not CSV: a CSV carries no column widths and no cell types. Excel opens
 * every column at its default width, so a date wider than ~8 characters shows
 * as `####`, and a `DD/MM/YYYY` string is silently re-read per the PC's
 * regional settings (05/11/2026 becomes May 11 on a US machine). Here each
 * column declares its type, dates are written as real Excel dates with an
 * unambiguous format, numbers as numbers, and widths are fitted to content.
 *
 * Plain `text` columns are written as strings and never converted, so codes
 * such as `EMP-000012`, `007` or phone numbers stay exactly as given. A string
 * cell is never evaluated as a formula, so no `'` prefix is needed.
 *
 * Import templates and files uploaded to an external portal stay CSV - they
 * are formats other systems expect, not reports for people to read.
 */
import { downloadBlob } from "./download";

export type SheetColumnType =
  "text" | "date" | "datetime" | "integer" | "number" | "amount" | "percent";

export type SheetCellInput = string | number | Date | null | undefined;

export interface SheetColumn<T> {
  header: string;
  value: (row: T) => SheetCellInput;
  /** How the value is written to Excel. Defaults to `text`. */
  type?: SheetColumnType;
  /** Fixed width in characters; otherwise fitted to the content. */
  width?: number;
  /** Set `false` to leave a numeric column out of the totals row. */
  total?: boolean;
}

export interface SheetSpec<T> {
  /** Worksheet tab name (sanitised to Excel's rules). */
  name: string;
  columns: readonly SheetColumn<T>[];
  rows: readonly T[];
  /** Optional report title, shown merged across a row above the header. */
  title?: string;
  /**
   * Adds a final bold row that sums every `integer` / `number` / `amount`
   * column. A string sets the label shown in the first column ("TOTALS" by
   * default). Columns of any other type are left blank.
   */
  totals?: boolean | string;
}

export type SheetCell = string | number | Date | null;

export interface SheetModel {
  name: string;
  title: string | null;
  headers: string[];
  rows: SheetCell[][];
  /** The totals row, or null when the sheet has none. */
  totalsRow: SheetCell[] | null;
  /** Excel number format per column, or null for General. */
  formats: (string | null)[];
  /** Column widths in characters. */
  widths: number[];
}

export const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export const DATE_FORMAT = "dd-mmm-yyyy";
export const DATETIME_FORMAT = "dd-mmm-yyyy hh:mm";
const AMOUNT_FORMAT = "#,##0.00";
const NUMBER_FORMAT = "#,##0.00";
const INTEGER_FORMAT = "0";
const PERCENT_FORMAT = '0.00"%"';

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const MIN_WIDTH = 8;
const MAX_WIDTH = 60;

/** `2026-11-18` or `18/11/2026` -> UTC midnight of that calendar day. */
function parseCalendarDay(text: string): Date | null {
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  const dmy = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text);
  const [y, m, d] = iso
    ? [Number(iso[1]), Number(iso[2]), Number(iso[3])]
    : dmy
      ? [Number(dmy[3]), Number(dmy[2]), Number(dmy[1])]
      : [NaN, NaN, NaN];
  if (!Number.isFinite(y)) return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  // Reject 31/02/2026 style overflow rather than silently rolling over.
  return date.getUTCMonth() === m - 1 && date.getUTCDate() === d ? date : null;
}

/** An instant -> the same wall-clock numbers in IST, stored as UTC so Excel
 * (which has no time zone) displays Indian time. */
function istWallClock(instant: Date): Date {
  return new Date(instant.getTime() + IST_OFFSET_MS);
}

function toDateCell(value: SheetCellInput, withTime: boolean): SheetCell {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return value;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    const wall = istWallClock(value);
    return withTime
      ? wall
      : new Date(
          Date.UTC(
            wall.getUTCFullYear(),
            wall.getUTCMonth(),
            wall.getUTCDate(),
          ),
        );
  }
  const text = value.trim();
  const day = parseCalendarDay(text);
  if (day) return day;
  const instant = new Date(text);
  if (!Number.isNaN(instant.getTime()) && /\d{4}-\d{2}-\d{2}T/.test(text)) {
    return toDateCell(instant, withTime);
  }
  // Not a recognisable date: keep what the user sees rather than lose it.
  return text;
}

function toNumberCell(value: SheetCellInput): SheetCell {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (value instanceof Date) return null;
  const cleaned = value.replace(/[\s,₹$]/g, "");
  if (cleaned === "" || !/^[+-]?\d*\.?\d+$/.test(cleaned)) return value.trim();
  return Number(cleaned);
}

function toCell(type: SheetColumnType, value: SheetCellInput): SheetCell {
  switch (type) {
    case "date":
      return toDateCell(value, false);
    case "datetime":
      return toDateCell(value, true);
    case "integer":
    case "number":
    case "amount":
    case "percent":
      return toNumberCell(value);
    default:
      if (value === null || value === undefined) return null;
      return value instanceof Date ? value.toISOString() : String(value);
  }
}

function formatFor(type: SheetColumnType): string | null {
  switch (type) {
    case "date":
      return DATE_FORMAT;
    case "datetime":
      return DATETIME_FORMAT;
    case "amount":
      return AMOUNT_FORMAT;
    case "number":
      return NUMBER_FORMAT;
    case "integer":
      return INTEGER_FORMAT;
    case "percent":
      return PERCENT_FORMAT;
    default:
      return null;
  }
}

/** How many characters a cell needs once Excel has formatted it. */
function displayLength(cell: SheetCell, format: string | null): number {
  if (cell === null) return 0;
  if (cell instanceof Date) {
    return format === DATETIME_FORMAT ? 17 : 11;
  }
  if (typeof cell === "number") {
    if (format === INTEGER_FORMAT) return String(Math.trunc(cell)).length;
    return cell.toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).length;
  }
  // Longest line: Excel shows a wrapped cell one line at a time.
  return Math.max(...cell.split(/\r?\n/).map((l) => l.length));
}

/** Column types a totals row adds up. */
const SUMMABLE: readonly SheetColumnType[] = ["integer", "number", "amount"];

/** Pure: turns typed columns + rows into cell values, formats and widths. */
export function buildSheetModel<T>(spec: SheetSpec<T>): SheetModel {
  const types = spec.columns.map((c) => c.type ?? "text");
  const formats = types.map(formatFor);
  const rows = spec.rows.map((row) =>
    spec.columns.map((c, i) => toCell(types[i]!, c.value(row))),
  );
  const widths = spec.columns.map((c, i) => {
    if (c.width !== undefined) return c.width;
    let longest = c.header.length;
    for (const r of rows)
      longest = Math.max(longest, displayLength(r[i]!, formats[i]!));
    if (spec.totals) {
      const label = typeof spec.totals === "string" ? spec.totals : "TOTALS";
      if (i === 0) longest = Math.max(longest, label.length);
      else if (SUMMABLE.includes(types[i]!)) longest = Math.max(longest, 14);
    }
    return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, longest + 2));
  });
  const totalsRow = spec.totals ? buildTotalsRow(spec, types, rows) : null;
  return {
    name: sanitiseSheetName(spec.name),
    title: spec.title ?? null,
    headers: spec.columns.map((c) => c.header),
    rows,
    totalsRow,
    formats,
    widths,
  };
}

function buildTotalsRow<T>(
  spec: SheetSpec<T>,
  types: SheetColumnType[],
  rows: SheetCell[][],
): SheetCell[] {
  const label = typeof spec.totals === "string" ? spec.totals : "TOTALS";
  return types.map((type, i) => {
    if (i === 0) return label;
    if (!SUMMABLE.includes(type) || spec.columns[i]!.total === false) {
      return null;
    }
    let sum = 0;
    for (const r of rows) {
      const v = r[i];
      if (typeof v === "number") sum += v;
    }
    // Round away float noise (0.1 + 0.2) to cents before it reaches Excel.
    return Math.round(sum * 100) / 100;
  });
}

/** Excel tab names: max 31 chars, none of `[]:*?/\`, not empty. */
export function sanitiseSheetName(name: string): string {
  const cleaned = name.replace(/[[\]:*?/\\]/g, " ").trim();
  return (cleaned || "Sheet1").slice(0, 31);
}

/** `Report.csv` / `Report` -> `Report.xlsx`. */
export function xlsxFileName(fileName: string): string {
  return `${fileName.replace(/\.(csv|xlsx)$/i, "")}.xlsx`;
}

/** Builds the workbook bytes. exceljs is loaded on demand (it is large). */
export async function buildWorkbook(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- sheets of different row types share one workbook
  sheets: readonly SheetSpec<any>[],
): Promise<ArrayBuffer> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "TexaOne";
  wb.created = new Date();
  const usedNames = new Set<string>();

  for (const spec of sheets) {
    const model = buildSheetModel(spec);
    let name = model.name;
    for (let n = 2; usedNames.has(name.toLowerCase()); n++) {
      name = `${model.name.slice(0, 28)} ${n}`;
    }
    usedNames.add(name.toLowerCase());

    const headerRow = model.title ? 2 : 1;
    const ws = wb.addWorksheet(name, {
      views: [{ state: "frozen", ySplit: headerRow }],
    });
    const lastCol = Math.max(1, model.headers.length);

    if (model.title) {
      const titleRow = ws.getRow(1);
      titleRow.getCell(1).value = model.title;
      ws.mergeCells(1, 1, 1, lastCol);
      titleRow.height = 26;
      titleRow.getCell(1).font = {
        bold: true,
        size: 14,
        color: { argb: "FF0A3271" },
      };
      titleRow.getCell(1).alignment = {
        vertical: "middle",
        horizontal: "left",
      };
    }

    model.widths.forEach((w, i) => {
      ws.getColumn(i + 1).width = w;
    });
    model.formats.forEach((format, i) => {
      if (format) ws.getColumn(i + 1).numFmt = format;
    });
    // Long text wraps instead of running off the sheet.
    model.widths.forEach((w, i) => {
      if (w >= MAX_WIDTH) {
        ws.getColumn(i + 1).alignment = { vertical: "top", wrapText: true };
      }
    });

    const header = ws.getRow(headerRow);
    model.headers.forEach((text, i) => {
      header.getCell(i + 1).value = text;
    });
    header.height = 22;
    header.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.alignment = {
        vertical: "middle",
        horizontal: "center",
        wrapText: true,
      };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF1769F5" },
      };
      cell.border = { bottom: { style: "thin", color: { argb: "FF0284C7" } } };
    });

    for (const row of model.rows) ws.addRow(row);

    if (model.totalsRow) {
      const totals = ws.addRow(model.totalsRow);
      totals.eachCell({ includeEmpty: true }, (cell, col) => {
        if (col > lastCol) return;
        cell.font = { bold: true, color: { argb: "FF0A3271" } };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFE0F2FE" },
        };
        cell.border = {
          top: { style: "thin", color: { argb: "FF38BDF8" } },
          bottom: { style: "double", color: { argb: "FF0284C7" } },
        };
      });
    }

    if (model.headers.length > 0) {
      ws.autoFilter = {
        from: { row: headerRow, column: 1 },
        to: { row: headerRow, column: lastCol },
      };
    }
  }

  return wb.xlsx.writeBuffer() as Promise<ArrayBuffer>;
}

/** Builds and saves a one- or multi-sheet workbook. */
export async function downloadWorkbook(
  fileName: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- see buildWorkbook
  sheets: readonly SheetSpec<any>[],
): Promise<void> {
  const buffer = await buildWorkbook(sheets);
  downloadBlob(xlsxFileName(fileName), new Blob([buffer], { type: XLSX_MIME }));
}
