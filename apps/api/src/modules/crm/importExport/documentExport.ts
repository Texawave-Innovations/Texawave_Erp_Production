// PDF / Word ("Document") export for Export Data — same rows/columns as the Excel export,
// rendered as a plain table document. Reuses jsPDF + jspdf-autotable (already a dependency, used
// elsewhere in the app for PDF generation) for PDF, and a lightweight HTML-as-.doc technique for
// Word — Word opens an HTML file saved with a .doc extension, so no extra dependency is needed.
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { FieldSchema, exportableFields } from "./types";

function cellValue<T>(field: FieldSchema<T>, record: T): string {
  const value = field.exportValue
    ? field.exportValue(record)
    : (record as Record<string, unknown>)[field.key];
  return value === undefined || value === null ? "" : String(value);
}

export function exportRecordsToPDF<T>(
  records: T[],
  fields: FieldSchema<T>[],
  title: string,
  fileBaseName: string,
): void {
  const cols = exportableFields(fields);
  const doc = new jsPDF({
    orientation: cols.length > 6 ? "landscape" : "portrait",
    unit: "pt",
    format: "a4",
  });
  doc.setFontSize(14);
  doc.text(title, 32, 32);
  doc.setFontSize(9);
  doc.text(
    `Generated ${new Date().toLocaleDateString("en-IN")} — ${records.length} record${records.length === 1 ? "" : "s"}`,
    32,
    48,
  );
  autoTable(doc, {
    startY: 60,
    head: [cols.map((f) => f.label)],
    body: records.map((r) => cols.map((f) => cellValue(f, r))),
    styles: { fontSize: 7, cellPadding: 4, overflow: "linebreak" },
    headStyles: { fillColor: [77, 159, 75], textColor: 255, fontStyle: "bold" },
    margin: { left: 24, right: 24 },
  });
  doc.save(`${fileBaseName}_${new Date().toISOString().split("T")[0]}.pdf`);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function exportRecordsToWord<T>(
  records: T[],
  fields: FieldSchema<T>[],
  title: string,
  fileBaseName: string,
): void {
  const cols = exportableFields(fields);
  const headCells = cols
    .map(
      (f) =>
        `<th style="border:1px solid #cbd5e1;padding:6px 8px;background:#4D9F4B;color:#fff;text-align:left;">${escapeHtml(f.label)}</th>`,
    )
    .join("");
  const bodyRows = records
    .map(
      (r) =>
        `<tr>${cols.map((f) => `<td style="border:1px solid #cbd5e1;padding:6px 8px;">${escapeHtml(cellValue(f, r))}</td>`).join("")}</tr>`,
    )
    .join("");
  const html =
    `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title></head>` +
    `<body style="font-family:Arial,Helvetica,sans-serif;">` +
    `<h2 style="margin-bottom:2px;">${escapeHtml(title)}</h2>` +
    `<p style="color:#64748b;font-size:11px;margin-top:0;">Generated ${new Date().toLocaleDateString("en-IN")} — ${records.length} record${records.length === 1 ? "" : "s"}</p>` +
    `<table style="border-collapse:collapse;width:100%;font-size:11px;"><thead><tr>${headCells}</tr></thead><tbody>${bodyRows}</tbody></table>` +
    `</body></html>`;

  const blob = new Blob(["﻿", html], { type: "application/msword" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${fileBaseName}_${new Date().toISOString().split("T")[0]}.doc`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
