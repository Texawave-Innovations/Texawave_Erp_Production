import { downloadWorkbook } from "@/lib/spreadsheet";
import { downloadText } from "../download";
import { days, isoDate, periodLabel } from "../format";
import type { Payslip } from "../types";

/** Neutralises dangerous spreadsheet formula injections */
function safeCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '""';
  let s = String(value).trim();
  if (/^[=+\-@\t\r]/.test(s)) {
    s = `'${s}`;
  }
  return `"${s.replace(/"/g, '""')}"`;
}

function parseMoney(val: string | number | null | undefined): number {
  return Number(val ?? 0) || 0;
}

/**
 * Exports payslips list to a clean, well-formatted CSV with UTF-8 BOM
 * for seamless opening in Microsoft Excel and Google Sheets.
 */
export function exportPayslipsCsv(
  payslips: Payslip[],
  periodTitle = "All_Periods",
): void {
  const headers = [
    "Payslip #",
    "Employee Code",
    "Employee Name",
    "Department",
    "Designation",
    "Payroll Period",
    "Payable Days",
    "LOP Days",
    "Gross Earnings (₹)",
    "Total Deductions (₹)",
    "Net Payable (₹)",
    "Bank Name",
    "Account Number",
    "PAN Number",
    "PF UAN",
    "ESI Number",
    "Generated Date",
    "Version",
  ];

  let totalGross = 0;
  let totalDeductions = 0;
  let totalNet = 0;

  const rows = payslips.map((p) => {
    const gross = parseMoney(p.payrollEntry.totalGrossEarnings);
    const deductions = parseMoney(p.payrollEntry.totalDeductions);
    const net = parseMoney(p.netPayable);

    totalGross += gross;
    totalDeductions += deductions;
    totalNet += net;

    return [
      safeCell(p.payslipNumber),
      safeCell(p.employee.employeeCode),
      safeCell(p.employee.fullName),
      safeCell(
        p.employee.department?.name || p.employee.team?.name || "General",
      ),
      safeCell(p.employee.designation?.name || "—"),
      safeCell(periodLabel(p.payrollPeriod)),
      safeCell(days(p.payrollEntry.payableDays)),
      safeCell(days(p.payrollEntry.lopDays)),
      gross.toFixed(2),
      deductions.toFixed(2),
      net.toFixed(2),
      safeCell(p.employee.bankDetails?.bankName || "—"),
      safeCell(p.employee.bankDetails?.accountNumber || "—"),
      safeCell(p.employee.bankDetails?.panNumber || "—"),
      safeCell(p.employee.pfProfile?.uan || "—"),
      safeCell(p.employee.esiProfile?.insuranceNumber || "—"),
      safeCell(isoDate(p.generatedAt)),
      safeCell(p.version ? `v${p.version}` : "v1"),
    ].join(",");
  });

  // Summary Row
  const summaryRow = [
    safeCell("TOTALS"),
    safeCell(""),
    safeCell(`${payslips.length} Employees`),
    safeCell(""),
    safeCell(""),
    safeCell(""),
    safeCell(""),
    safeCell(""),
    totalGross.toFixed(2),
    totalDeductions.toFixed(2),
    totalNet.toFixed(2),
    safeCell(""),
    safeCell(""),
    safeCell(""),
    safeCell(""),
    safeCell(""),
    safeCell(""),
    safeCell(""),
  ].join(",");

  const utf8Bom = "\uFEFF";
  const csvContent =
    utf8Bom +
    [headers.map((h) => safeCell(h)).join(","), ...rows, summaryRow].join(
      "\r\n",
    );

  const sanitizedPeriod = periodTitle.replace(/[^a-zA-Z0-9_-]/g, "_");
  const fileName = `TexaOne_Payslips_${sanitizedPeriod}_${new Date().toISOString().slice(0, 10)}.csv`;

  downloadText(fileName, csvContent, "text/csv;charset=utf-8;");
}

/**
 * Exports the payslips list to a real `.xlsx` workbook: typed amounts and
 * dates, fitted columns, brand header and a totals row.
 */
export async function exportPayslipsExcel(
  payslips: Payslip[],
  periodTitle = "All_Periods",
): Promise<void> {
  const sanitizedPeriod = periodTitle.replace(/[^a-zA-Z0-9_-]/g, "_");
  await downloadWorkbook(
    `TexaOne_Payslips_${sanitizedPeriod}_${new Date().toISOString().slice(0, 10)}`,
    [
      {
        name: "Employee Payslips",
        totals: `TOTALS — ${payslips.length} employees`,
        rows: payslips,
        columns: [
          { header: "Payslip #", value: (p) => p.payslipNumber },
          { header: "Employee Code", value: (p) => p.employee.employeeCode },
          { header: "Employee Name", value: (p) => p.employee.fullName },
          {
            header: "Department",
            value: (p) =>
              p.employee.department?.name || p.employee.team?.name || "General",
          },
          {
            header: "Designation",
            value: (p) => p.employee.designation?.name || "—",
          },
          {
            header: "Payroll Period",
            value: (p) => periodLabel(p.payrollPeriod),
          },
          {
            header: "Payable Days",
            value: (p) => p.payrollEntry.payableDays,
            type: "number",
          },
          {
            header: "LOP Days",
            value: (p) => p.payrollEntry.lopDays,
            type: "number",
          },
          {
            header: "Gross Earnings (₹)",
            value: (p) => parseMoney(p.payrollEntry.totalGrossEarnings),
            type: "amount",
          },
          {
            header: "Total Deductions (₹)",
            value: (p) => parseMoney(p.payrollEntry.totalDeductions),
            type: "amount",
          },
          {
            header: "Net Payable (₹)",
            value: (p) => parseMoney(p.netPayable),
            type: "amount",
          },
          {
            header: "Bank Name",
            value: (p) => p.employee.bankDetails?.bankName || "—",
          },
          {
            header: "Account Number",
            value: (p) => p.employee.bankDetails?.accountNumber || "—",
          },
          {
            header: "PAN Number",
            value: (p) => p.employee.bankDetails?.panNumber || "—",
          },
          { header: "PF UAN", value: (p) => p.employee.pfProfile?.uan || "—" },
          {
            header: "ESI Number",
            value: (p) => p.employee.esiProfile?.insuranceNumber || "—",
          },
          {
            header: "Generated Date",
            value: (p) => p.generatedAt,
            type: "date",
          },
          {
            header: "Version",
            value: (p) => (p.version ? `v${p.version}` : "v1"),
          },
        ],
      },
    ],
  );
}
