// One CSV cell, quoted, with a leading = + - @ neutralised so a spreadsheet
// never evaluates a cell as a formula (same rule as the payroll salary
// report's `cell`).
function cell(value: string | number | null | undefined): string {
  let s = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

// Written as a char code: a literal U+FEFF in source is invisible.
const UTF8_BOM = String.fromCharCode(0xfeff);

export interface CsvColumn<T> {
  header: string;
  value: (row: T) => string | number | null | undefined;
}

/** Builds a BOM-prefixed CSV (so Excel opens UTF-8 correctly) from typed
 * rows and column definitions — the shared export every SCM report uses. */
export function toCsv<T>(
  columns: readonly CsvColumn<T>[],
  rows: readonly T[],
): string {
  const lines = [
    columns.map((c) => c.header),
    ...rows.map((r) => columns.map((c) => c.value(r))),
  ];
  return `${UTF8_BOM}${lines.map((l) => l.map(cell).join(",")).join("\r\n")}\r\n`;
}

/** Saves CSV text as a file through a temporary object URL. */
export function downloadCsv(fileName: string, content: string): void {
  const url = URL.createObjectURL(
    new Blob([content], { type: "text/csv;charset=utf-8" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
