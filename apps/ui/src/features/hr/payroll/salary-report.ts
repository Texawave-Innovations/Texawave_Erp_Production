import { formatCurrency } from "@texawave-erp/core";
import { days, periodLabel } from "./format";
import type { NamedRef, PayrollEntry, PayrollRun } from "./types";
import { downloadWorkbook } from "@/lib/spreadsheet";

/**
 * Salary report rows, read from a saved payroll run — never recomputed.
 * Amounts are summed in integer paise so floating-point errors cannot accumulate.
 */
export interface SalaryReportRow {
  entryId: number;
  employeeCode: string;
  fullName: string;
  team: NamedRef | null;
  department: NamedRef | null;
  days: number;
  payableDays: number;
  lopDays: number;
  absentDays: number;
  /** In integer paise */
  grossMonthly: number;
  perDayRate: number;
  earnedGross: number;
  gross: number; // backward-compatibility alias for earnedGross
  pf: number;
  esi: number;
  loan: number;
  otherDeductions: number;
  totalDeductions: number;
  net: number;
  bankName: string;
  bankAccount: string;
}

export type SalaryReportTotals = {
  grossMonthly: number;
  earnedGross: number;
  gross: number;
  pf: number;
  esi: number;
  loan: number;
  otherDeductions: number;
  totalDeductions: number;
  net: number;
};

export const paise = (value: string | number | null | undefined): number =>
  Math.round(Number(value ?? 0) * 100) || 0;

export function toReportRow(e: PayrollEntry, totalDays = 30): SalaryReportRow {
  const by = (source: string) =>
    e.deductions
      .filter(
        (d) => d.sourceType === source || d.code?.toUpperCase() === source,
      )
      .reduce((sum, d) => sum + paise(d.amount), 0);

  const pf = by("PF");
  const esi = by("ESI");
  const loan = by("LOAN");
  const totalDeductions = paise(e.totalDeductions);
  const otherDeductions = Math.max(0, totalDeductions - pf - esi - loan);

  // Monthly base gross from earnings definitions (before attendance deductions)
  const baseEarningsSum = e.earnings.reduce(
    (sum, d) => sum + paise(d.baseAmount),
    0,
  );
  const earnedGross = paise(e.totalGrossEarnings);
  const grossMonthly = baseEarningsSum > 0 ? baseEarningsSum : earnedGross;

  const payable = Number(e.payableDays ?? 0);
  const lop = Number(e.lopDays ?? 0);
  const absent = Number(e.absentDays ?? e.lopDays ?? 0);
  const safeDays = totalDays > 0 ? totalDays : 30;
  const perDayRate = Math.round(grossMonthly / safeDays);

  return {
    entryId: e.id,
    employeeCode: e.employee.employeeCode,
    fullName: e.employee.fullName,
    team: e.employee.team ?? null,
    department: e.employee.department ?? null,
    days: safeDays,
    payableDays: payable,
    lopDays: lop,
    absentDays: absent,
    grossMonthly,
    perDayRate,
    earnedGross,
    gross: earnedGross,
    pf,
    esi,
    loan,
    otherDeductions,
    totalDeductions,
    net: paise(e.netPayable),
    bankName: e.employee.bankDetails?.bankName || "—",
    bankAccount: e.employee.bankDetails?.accountNumber || "—",
  };
}

export function totalsOf(rows: readonly SalaryReportRow[]): SalaryReportTotals {
  const t: SalaryReportTotals = {
    grossMonthly: 0,
    earnedGross: 0,
    gross: 0,
    pf: 0,
    esi: 0,
    loan: 0,
    otherDeductions: 0,
    totalDeductions: 0,
    net: 0,
  };
  for (const r of rows) {
    t.grossMonthly += r.grossMonthly;
    t.earnedGross += r.earnedGross;
    t.gross += r.gross;
    t.pf += r.pf;
    t.esi += r.esi;
    t.loan += r.loan;
    t.otherDeductions += r.otherDeductions;
    t.totalDeductions += r.totalDeductions;
    t.net += r.net;
  }
  return t;
}

/** Paise → formatted currency. */
export function rupees(p: number): string {
  return formatCurrency(p / 100);
}

/** Which run a report should read: the approved one, else the latest
 * processed one (a draft report), else none. */
export function reportRun<R extends Pick<PayrollRun, "status" | "runNumber">>(
  runs: readonly R[],
): R | null {
  return (
    runs.find((r) => r.status === "APPROVED") ??
    [...runs]
      .filter((r) => r.status === "PROCESSED")
      .sort((a, b) => b.runNumber - a.runNumber)[0] ??
    null
  );
}

/** One CSV cell, quoted, with leading formula triggers neutralized. */
function cell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '""';
  let s = String(value).trim();
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

const amount = (p: number) => (p / 100).toFixed(2);

const UTF8_BOM = String.fromCharCode(0xfeff);

export interface ReportMeta {
  year: number;
  month: number;
  runNumber: number;
}

export function toCsv(
  meta: ReportMeta,
  rows: readonly SalaryReportRow[],
): { fileName: string; content: string } {
  const header = [
    "#",
    "Employee Code",
    "Employee Name",
    "Department",
    "Days",
    "Payable Days",
    "LOP / Absent",
    "Gross/Mo (₹)",
    "Per Day Rate (₹)",
    "Total Earned (₹)",
    "PF (₹)",
    "ESI (₹)",
    "Loan EMI (₹)",
    "Other Deductions (₹)",
    "Total Deductions (₹)",
    "Net Payable (₹)",
    "Bank Name",
    "Bank Account",
  ];

  const t = totalsOf(rows);
  const lines = [
    header,
    ...rows.map((r, idx) => [
      idx + 1,
      r.employeeCode,
      r.fullName,
      r.department?.name ?? r.team?.name ?? "General",
      r.days,
      r.payableDays,
      r.lopDays,
      amount(r.grossMonthly),
      amount(r.perDayRate),
      amount(r.earnedGross),
      amount(r.pf),
      amount(r.esi),
      amount(r.loan),
      amount(r.otherDeductions),
      amount(r.totalDeductions),
      amount(r.net),
      r.bankName,
      r.bankAccount,
    ]),
    [
      "TOTALS",
      `${rows.length} Employees`,
      "",
      "",
      "",
      "",
      "",
      amount(t.grossMonthly),
      "",
      amount(t.earnedGross),
      amount(t.pf),
      amount(t.esi),
      amount(t.loan),
      amount(t.otherDeductions),
      amount(t.totalDeductions),
      amount(t.net),
      "",
      "",
    ],
  ];

  return {
    fileName: `Monthly_Salary_Report_${meta.year}_${String(meta.month).padStart(2, "0")}_Run${meta.runNumber}.csv`,
    content: `${UTF8_BOM}${lines.map((l) => l.map(cell).join(",")).join("\r\n")}\r\n`,
  };
}

/**
 * Real `.xlsx` workbook (via the shared spreadsheet helper): typed number
 * columns, fitted widths, brand header, and a totals row.
 */
export async function exportSalaryReportExcel(
  meta: ReportMeta,
  rows: readonly SalaryReportRow[],
): Promise<void> {
  const rupee = (p: number) => p / 100;
  await downloadWorkbook(
    `Monthly_Salary_Report_${meta.year}_${String(meta.month).padStart(2, "0")}_Run${meta.runNumber}`,
    [
      {
        name: "Salary Report",
        title: `TexaOne ERP — Monthly Salary Report for ${periodLabel(meta)} (Run #${meta.runNumber})`,
        totals: `TOTALS — ${rows.length} employees`,
        rows: rows.map((r, idx) => ({ r, idx })),
        columns: [
          { header: "#", value: (x) => x.idx + 1, type: "integer", width: 6 },
          { header: "Emp ID", value: (x) => x.r.employeeCode },
          { header: "Employee Name", value: (x) => x.r.fullName },
          {
            header: "Department",
            value: (x) => x.r.department?.name || x.r.team?.name || "General",
          },
          { header: "Days", value: (x) => x.r.days, type: "number" },
          { header: "Present", value: (x) => x.r.payableDays, type: "number" },
          { header: "Absent/LOP", value: (x) => x.r.lopDays, type: "number" },
          {
            header: "Gross/Mo (₹)",
            value: (x) => rupee(x.r.grossMonthly),
            type: "amount",
          },
          {
            header: "Per Day (₹)",
            value: (x) => rupee(x.r.perDayRate),
            type: "amount",
          },
          {
            header: "Total Earn (₹)",
            value: (x) => rupee(x.r.earnedGross),
            type: "amount",
          },
          { header: "PF (₹)", value: (x) => rupee(x.r.pf), type: "amount" },
          { header: "ESI (₹)", value: (x) => rupee(x.r.esi), type: "amount" },
          {
            header: "Loan EMI (₹)",
            value: (x) => rupee(x.r.loan),
            type: "amount",
          },
          {
            header: "Other (₹)",
            value: (x) => rupee(x.r.otherDeductions),
            type: "amount",
          },
          {
            header: "Deductions (₹)",
            value: (x) => rupee(x.r.totalDeductions),
            type: "amount",
          },
          {
            header: "Net Pay (₹)",
            value: (x) => rupee(x.r.net),
            type: "amount",
          },
          { header: "Bank Name", value: (x) => x.r.bankName },
          { header: "Bank Account", value: (x) => x.r.bankAccount },
        ],
      },
    ],
  );
}

export function reportTitle(meta: ReportMeta): string {
  return `${periodLabel(meta)} · Run #${meta.runNumber}`;
}

/** Distinct teams/departments present in a run, sorted by name, for the
 * report's filter dropdowns. */
export function optionsOf(
  rows: readonly SalaryReportRow[],
  key: "team" | "department",
): NamedRef[] {
  const seen = new Map<number, NamedRef>();
  for (const r of rows) {
    const ref = r[key];
    if (ref) seen.set(ref.id, ref);
  }
  return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
}
