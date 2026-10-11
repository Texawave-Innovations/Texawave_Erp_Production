/**
 * Minimal RFC 4180 CSV reading and writing, so CSV export/import needs no
 * new dependency. Excel opens and saves this format natively.
 */

/** Characters a spreadsheet treats as the start of a formula. A cell that
 * starts with one is prefixed with `'` so a value like `=HYPERLINK(...)`
 * entered by a user is shown as text, never executed (CSV injection). */
const FORMULA_START = /^[=+\-@\t\r]/;

/** UTF-8 byte-order mark, as an escape so it stays visible in the source. */
export const BOM = String.fromCharCode(0xfeff);

function cell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let text = value instanceof Date ? value.toISOString() : String(value);
  if (FORMULA_START.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Header row plus one line per record, CRLF-separated, with a UTF-8 BOM so
 * Excel detects the encoding (names with non-ASCII characters stay intact). */
export function toCsv(
  headers: readonly string[],
  rows: ReadonlyArray<readonly unknown[]>,
): string {
  const lines = [headers, ...rows].map((r) => r.map(cell).join(","));
  return `${BOM}${lines.join("\r\n")}\r\n`;
}

export class CsvParseError extends Error {}

/**
 * Parses CSV text into rows of strings. Handles quoted fields containing
 * commas, quotes (`""`) and line breaks, CRLF or LF line endings, and a
 * leading BOM. Fully blank lines are skipped.
 */
export function parseCsv(input: string): string[][] {
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  let i = 0;

  const endRow = () => {
    row.push(field);
    if (row.some((f) => f.trim() !== "")) rows.push(row);
    row = [];
    field = "";
  };

  while (i < text.length) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        quoted = false;
        i += 1;
        continue;
      }
      field += ch;
      i += 1;
      continue;
    }
    if (ch === '"') {
      if (field !== "") {
        throw new CsvParseError(
          `Unexpected quote inside an unquoted field on line ${rows.length + 1}`,
        );
      }
      quoted = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i += 1;
      endRow();
    } else {
      field += ch;
    }
    i += 1;
  }
  if (quoted) throw new CsvParseError("Unterminated quoted field");
  if (field !== "" || row.length > 0) endRow();
  return rows;
}
