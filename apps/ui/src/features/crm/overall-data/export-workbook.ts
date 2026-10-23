import type {
  CrmOverallActivityRecord,
  CrmOverallDataMonth,
  CrmOverallRowKey,
} from "@texawave-erp/api-types";
import type { Borders, Fill, Worksheet } from "exceljs";
import { getOverallDataRecords } from "./api";

/** Legacy OverallData.tsx export: a 3-sheet workbook — Daily Activity
 * Summary (counts, each non-zero one hyperlinked to its rows), Weekly-Monthly
 * Report (the summary-card totals) and Activity Details (the real records
 * behind every count, fetched through the same drill-down endpoint). */

const SUMMARY_METRICS: { label: string; key: CrmOverallRowKey }[] = [
  { label: "Total Number of Accounts Mined", key: "accountsMined" },
  { label: "Total Number of e-mails", key: "emailsSent" },
  { label: "Total Number of Meetings Scheduled", key: "meetingsScheduled" },
  { label: "Completed Meetings", key: "meetingsCompleted" },
  { label: "Total Number of Calls made", key: "callsMade" },
];

export const DETAIL_HEADER = [
  "Date",
  "Time",
  "Disposition",
  "Owner",
  "Account",
  "Contact",
  "Activity Type",
  "Status",
  "Due Date",
  "Completed Date",
  "Deal/Stage",
  "Source",
  "Notes/Outcome",
  "Record ID",
  "Summary Reference",
  "Summary Count",
];

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/** yyyy-MM-dd -> dd-MMM-yyyy */
export function formatDayKey(day: string): string {
  const [y, m, d] = day.split("-");
  return `${d}-${MONTHS[Number(m) - 1]}-${y}`;
}

/** One Activity Details row, tied back to its Sheet 1 cell. */
export function detailRow(
  dispositionLabel: string,
  dayKey: string,
  r: CrmOverallActivityRecord,
  summaryCount: number,
): (string | number)[] {
  return [
    dayKey,
    r.time,
    dispositionLabel,
    r.owner,
    r.accountName || "-",
    r.contactName || "-",
    r.action,
    r.status ?? "",
    r.dueDate ?? "",
    r.completedDate ?? "",
    "",
    r.source ?? "",
    r.notes ?? "",
    r.recordId,
    `${dispositionLabel} - ${formatDayKey(dayKey)}`,
    summaryCount,
  ];
}

const HEADER_FILL: Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FF1769F5" },
};
const THIN: Partial<Borders> = {
  top: { style: "thin", color: { argb: "FFE2E8F0" } },
  left: { style: "thin", color: { argb: "FFE2E8F0" } },
  bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
  right: { style: "thin", color: { argb: "FFE2E8F0" } },
};

function styleSheet(sheet: Worksheet, columnCount: number, rowCount: number) {
  const header = sheet.getRow(1);
  header.height = 22;
  header.eachCell({ includeEmpty: true }, (cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
    cell.fill = HEADER_FILL;
    cell.alignment = {
      horizontal: "center",
      vertical: "middle",
      wrapText: true,
    };
    cell.border = THIN;
  });
  for (let r = 2; r <= rowCount; r++) {
    sheet.getRow(r).eachCell({ includeEmpty: true }, (cell) => {
      cell.border = THIN;
    });
  }
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.autoFilter = {
    from: "A1",
    to: `${sheet.getColumn(columnCount).letter}1`,
  };
}

/** Fetches the records behind every non-zero (disposition, day) cell. */
async function fetchAllRecords(
  grid: CrmOverallDataMonth,
): Promise<Map<string, CrmOverallActivityRecord[]>> {
  const jobs: { row: CrmOverallRowKey; day: string }[] = [];
  for (const row of grid.rows)
    for (const day of grid.days)
      if ((grid.daily[row.key][day] ?? 0) > 0) jobs.push({ row: row.key, day });
  const out = new Map<string, CrmOverallActivityRecord[]>();
  const BATCH = 6;
  for (let i = 0; i < jobs.length; i += BATCH) {
    await Promise.all(
      jobs.slice(i, i + BATCH).map(async ({ row, day }) => {
        out.set(
          `${row}|${day}`,
          await getOverallDataRecords({
            year: grid.year,
            month: grid.month,
            row,
            day,
          }),
        );
      }),
    );
  }
  return out;
}

export async function downloadOverallDataWorkbook(
  grid: CrmOverallDataMonth,
): Promise<void> {
  const ExcelJS = (await import("exceljs")).default;
  const records = await fetchAllRecords(grid);

  // Row number each (disposition, day) group starts at in Activity Details.
  const startRow = new Map<string, number>();
  let running = 2;
  for (const row of grid.rows)
    for (const day of grid.days) {
      const n = records.get(`${row.key}|${day}`)?.length ?? 0;
      if (n === 0) continue;
      startRow.set(`${row.key}|${day}`, running);
      running += n;
    }

  const wb = new ExcelJS.Workbook();
  wb.creator = "TexaWave CRM";
  wb.created = new Date();

  // Sheet 1: Daily Activity Summary
  const summary = wb.addWorksheet("Daily Activity Summary");
  const dailyHeader = ["Disposition", ...grid.days.map(formatDayKey)];
  summary.addRow(dailyHeader);
  for (const row of grid.rows) {
    const excelRow = summary.addRow([
      row.label,
      ...grid.days.map((d) => grid.daily[row.key][d] ?? 0),
    ]);
    grid.days.forEach((d, i) => {
      const count = grid.daily[row.key][d] ?? 0;
      const target = startRow.get(`${row.key}|${d}`);
      if (count > 0 && target) {
        const cell = excelRow.getCell(i + 2);
        cell.value = {
          text: String(count),
          hyperlink: `#'Activity Details'!A${target}`,
        };
        cell.font = { color: { argb: "FF1D4ED8" }, underline: true };
      }
    });
  }
  summary.getColumn(1).width = 34;
  for (let i = 2; i <= dailyHeader.length; i++) summary.getColumn(i).width = 13;
  summary.eachRow((row, n) => {
    if (n === 1) return;
    row.eachCell({ includeEmpty: true }, (cell, col) => {
      cell.alignment =
        col === 1
          ? { horizontal: "left", vertical: "middle" }
          : { horizontal: "center", vertical: "middle" };
      if (col === 1) cell.font = { bold: true };
    });
  });
  styleSheet(summary, dailyHeader.length, grid.rows.length + 1);

  // Sheet 2: Weekly-Monthly Report
  const report = wb.addWorksheet("Weekly-Monthly Report");
  report.addRow(["Metric", "Value"]);
  for (const m of SUMMARY_METRICS)
    report.addRow([m.label, grid.monthTotals[m.key] ?? 0]);
  report.getColumn(1).width = 42;
  report.getColumn(2).width = 14;
  report.eachRow((row, n) => {
    if (n > 1)
      row.getCell(2).alignment = { horizontal: "center", vertical: "middle" };
  });
  styleSheet(report, 2, SUMMARY_METRICS.length + 1);

  // Sheet 3: Activity Details
  const detail = wb.addWorksheet("Activity Details");
  detail.addRow(DETAIL_HEADER);
  let detailCount = 0;
  for (const row of grid.rows)
    for (const day of grid.days) {
      const list = records.get(`${row.key}|${day}`) ?? [];
      for (const r of list) {
        detail.addRow(detailRow(row.label, day, r, list.length));
        detailCount += 1;
      }
    }
  const widthsByCol = [
    12, 10, 22, 16, 22, 18, 20, 12, 16, 16, 16, 16, 44, 12, 32, 14,
  ];
  widthsByCol.forEach((w, i) => {
    detail.getColumn(i + 1).width = w;
  });
  const notesCol = DETAIL_HEADER.indexOf("Notes/Outcome") + 1;
  const countCol = DETAIL_HEADER.indexOf("Summary Count") + 1;
  detail.eachRow((row, n) => {
    if (n === 1) return;
    row.eachCell({ includeEmpty: true }, (cell, col) => {
      cell.alignment =
        col === notesCol
          ? { horizontal: "left", vertical: "top", wrapText: true }
          : col === countCol
            ? { horizontal: "center", vertical: "middle" }
            : { horizontal: "left", vertical: "middle" };
    });
  });
  styleSheet(detail, DETAIL_HEADER.length, detailCount + 1);

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `crm-overall-data_${grid.year}-${String(grid.month).padStart(2, "0")}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
