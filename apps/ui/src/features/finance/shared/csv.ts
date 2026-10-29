function cell(value: string | number | null | undefined): string {
  let s = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

const UTF8_BOM = String.fromCharCode(0xfeff);

export interface CsvColumn<T> {
  header: string;
  value: (row: T) => string | number | null | undefined;
}

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
