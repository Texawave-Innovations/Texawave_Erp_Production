import { days, periodLabel } from "./format";
import type { NamedRef, PayrollEntry, PayrollRun } from "./types";

/**
 * Salary report rows, read from a saved payroll run — never recomputed.
 * The legacy SalaryReport.tsx recalculated pay in the browser and drifted
 * from Payroll (Docs/HR_LEGACY_PARITY.md §3.14); this only regroups what the
 * API calculated.
 *
 * Amounts are summed in integer paise so a 500-row total can't pick up
 * floating-point error.
 */
export interface SalaryReportRow {
  entryId: number;
  employeeCode: string;
  fullName: string;
  team: NamedRef | null;
  department: NamedRef | null;
  payableDays: string;
  lopDays: string;
  /** Paise. */
  gross: number;
  pf: number;
  esi: number;
  loan: number;
  otherDeductions: number;
  totalDeductions: number;
  net: number;
}

export type SalaryReportTotals = Pick<
  SalaryReportRow,
  | "gross"
  | "pf"
  | "esi"
  | "loan"
  | "otherDeductions"
  | "totalDeductions"
  | "net"
>;

const paise = (value: string | number | null | undefined): number =>
  Math.round(Number(value ?? 0) * 100) || 0;

export function toReportRow(e: PayrollEntry): SalaryReportRow {
  const by = (source: string) =>
    e.deductions
      .filter((d) => d.sourceType === source)
      .reduce((sum, d) => sum + paise(d.amount), 0);
  const pf = by("PF");
  const esi = by("ESI");
  const loan = by("LOAN");
  const totalDeductions = paise(e.totalDeductions);
  return {
    entryId: e.id,
    employeeCode: e.employee.employeeCode,
    fullName: e.employee.fullName,
    team: e.employee.team ?? null,
    department: e.employee.department ?? null,
    payableDays: days(e.payableDays),
    lopDays: days(e.lopDays),
    gross: paise(e.totalGrossEarnings),
    pf,
    esi,
    loan,
    otherDeductions: totalDeductions - pf - esi - loan,
    totalDeductions,
    net: paise(e.netPayable),
  };
}

export function totalsOf(rows: readonly SalaryReportRow[]): SalaryReportTotals {
  const t: SalaryReportTotals = {
    gross: 0,
    pf: 0,
    esi: 0,
    loan: 0,
    otherDeductions: 0,
    totalDeductions: 0,
    net: 0,
  };
  for (const r of rows) {
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

/** Paise → "₹ 1,23,456.00". */
export function rupees(p: number): string {
  return `₹ ${(p / 100).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
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

/** One CSV cell, quoted, with a leading = + - @ neutralised so a
 * spreadsheet never evaluates an employee name as a formula — the same rule
 * as apps/api/.../payroll/shared/sensitive-data.ts `csvCell`. */
function cell(value: string | number): string {
  let s = String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

const amount = (p: number) => (p / 100).toFixed(2);

// Written as a char code: a literal U+FEFF in source is invisible and
// trips no-irregular-whitespace.
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
    "Employee code",
    "Employee",
    "Team",
    "Department",
    "Payable days",
    "LOP days",
    "Gross",
    "PF",
    "ESI",
    "Loan EMI",
    "Other deductions",
    "Total deductions",
    "Net payable",
  ];
  const t = totalsOf(rows);
  const lines = [
    header,
    ...rows.map((r) => [
      r.employeeCode,
      r.fullName,
      r.team?.name ?? "",
      r.department?.name ?? "",
      r.payableDays,
      r.lopDays,
      amount(r.gross),
      amount(r.pf),
      amount(r.esi),
      amount(r.loan),
      amount(r.otherDeductions),
      amount(r.totalDeductions),
      amount(r.net),
    ]),
    [
      "",
      "Total",
      "",
      "",
      "",
      "",
      amount(t.gross),
      amount(t.pf),
      amount(t.esi),
      amount(t.loan),
      amount(t.otherDeductions),
      amount(t.totalDeductions),
      amount(t.net),
    ],
  ];
  return {
    fileName: `salary-report-${meta.year}-${String(meta.month).padStart(2, "0")}-run${meta.runNumber}.csv`,
    // BOM so Excel opens UTF-8 (₹, non-ASCII names) correctly.
    content: `${UTF8_BOM}${lines.map((l) => l.map(cell).join(",")).join("\r\n")}\r\n`,
  };
}

export function reportTitle(meta: ReportMeta): string {
  return `${periodLabel(meta)} · Run #${meta.runNumber}`;
}

/** Saves text as a file through a temporary object URL. */
export function downloadText(
  fileName: string,
  content: string,
  type = "text/csv;charset=utf-8",
): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
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
