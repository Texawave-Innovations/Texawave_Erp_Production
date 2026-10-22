import type { CrmExportResult } from "@texawave-erp/api-types";
import type { WorkSheet } from "xlsx";

export interface ParsedSheet {
  name: string;
  headers: string[];
  rows: string[][];
}

/** SheetJS only fills the top-left cell of a merged range; forward-fill the
 * anchor value into the rest of the merge (legacy excelIO.fillMergedCells). */
function fillMergedCells(ws: WorkSheet, raw: unknown[][]): void {
  for (const merge of ws["!merges"] ?? []) {
    const anchor = raw[merge.s.r]?.[merge.s.c];
    if (anchor === undefined || anchor === null || anchor === "") continue;
    for (let r = merge.s.r; r <= merge.e.r; r++) {
      for (let c = merge.s.c; c <= merge.e.c; c++) {
        if (r === merge.s.r && c === merge.s.c) continue;
        const row = raw[r] ?? (raw[r] = []);
        row[c] = anchor;
      }
    }
  }
}

export function sheetToParsed(
  name: string,
  utils: typeof import("xlsx").utils,
  ws: WorkSheet,
): ParsedSheet {
  const raw = utils.sheet_to_json<unknown[]>(ws, {
    header: 1,
    defval: "",
    blankrows: true,
    raw: false,
  });
  const first = raw[0];
  if (!first) return { name, headers: [], rows: [] };
  fillMergedCells(ws, raw);
  const headers = first.map((h) => String(h ?? "").trim());
  const rows = raw
    .slice(1)
    .filter((r) => r.some((c) => String(c ?? "").trim() !== ""))
    .map((r) => headers.map((_, i) => String(r[i] ?? "").trim()));
  return { name, headers, rows };
}

/** Reads every sheet of an .xlsx/.xls/.csv file in the browser. */
export async function parseWorkbookFile(file: File): Promise<ParsedSheet[]> {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
  return wb.SheetNames.map((name) => {
    const ws = wb.Sheets[name];
    return ws
      ? sheetToParsed(name, XLSX.utils, ws)
      : { name, headers: [], rows: [] };
  });
}

function widths(rows: (string | number)[][]): { wch: number }[] {
  const out: number[] = [];
  for (const row of rows)
    row.forEach((c, i) => {
      out[i] = Math.max(out[i] ?? 10, Math.min(String(c ?? "").length + 2, 40));
    });
  return out.map((wch) => ({ wch }));
}

async function writeSheet(
  fileName: string,
  sheetName: string,
  aoa: (string | number)[][],
) {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = widths(aoa);
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  XLSX.writeFile(wb, fileName);
}

const today = () => new Date().toISOString().split("T")[0];

export function downloadImportTemplate(
  labels: string[],
  sheetName: string,
  fileBaseName: string,
) {
  return writeSheet(`${fileBaseName}_import_template.xlsx`, sheetName, [
    labels,
    labels.map(() => ""),
  ]);
}

export function downloadErrorReport(
  issues: { rowNumber: number; message: string }[],
  fileBaseName: string,
) {
  return writeSheet(`${fileBaseName}_import_errors.xlsx`, "Errors", [
    ["Row", "Error"],
    ...issues.map((i) => [i.rowNumber, i.message]),
  ]);
}

export function exportToExcel(
  result: CrmExportResult,
  sheetName: string,
  fileBaseName: string,
) {
  const header = result.columns.map((c) => c.label);
  const body = result.rows.map((r) =>
    result.columns.map((c) => r[c.key] ?? ""),
  );
  return writeSheet(`${fileBaseName}_${today()}.xlsx`, sheetName, [
    header,
    ...body,
  ]);
}

export async function exportToPdf(
  result: CrmExportResult,
  title: string,
  fileBaseName: string,
) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a3" });
  doc.setFontSize(14);
  doc.text(`${title} - ${today()}`, 40, 36);
  autoTable(doc, {
    startY: 52,
    head: [result.columns.map((c) => c.label)],
    body: result.rows.map((r) =>
      result.columns.map((c) => String(r[c.key] ?? "")),
    ),
    styles: { fontSize: 7, cellPadding: 3 },
    headStyles: { fillColor: [77, 159, 75] },
  });
  doc.save(`${fileBaseName}_${today()}.pdf`);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Legacy "Document (.doc)" export: an HTML table Word opens as editable. */
export function exportToWord(
  result: CrmExportResult,
  title: string,
  fileBaseName: string,
) {
  const th = (s: string) =>
    `<th style="border:1px solid #cbd5e1;padding:6px 8px;background:#2454e8;color:#fff;text-align:left;">${escapeHtml(s)}</th>`;
  const head = result.columns.map((c) => th(c.label)).join("");
  const body = result.rows
    .map(
      (r) =>
        `<tr>${result.columns
          .map(
            (c) =>
              `<td style="border:1px solid #cbd5e1;padding:6px 8px;">${escapeHtml(String(r[c.key] ?? ""))}</td>`,
          )
          .join("")}</tr>`,
    )
    .join("");
  const n = result.rows.length;
  const html =
    `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title></head>` +
    `<body style="font-family:Arial,Helvetica,sans-serif;"><h2 style="margin-bottom:2px;">${escapeHtml(title)}</h2>` +
    `<p style="color:#64748b;font-size:11px;margin-top:0;">Generated ${new Date().toLocaleDateString("en-IN")} — ${n} record${n === 1 ? "" : "s"}</p>` +
    `<table style="border-collapse:collapse;width:100%;font-size:11px;"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></body></html>`;
  const blob = new Blob(["﻿", html], { type: "application/msword" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${fileBaseName}_${today()}.doc`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
