import { days, periodLabel } from "./format";
import type { NamedRef, PayrollEntry, PayrollRun } from "./types";
import { downloadBlob, downloadText } from "./download";

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

/** One CSV cell, quoted, with leading formula triggers neutralized. */
function cell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '""';
  let s = String(value).trim();
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

function escapeXml(unsafe: string | number | null | undefined): string {
  if (unsafe === null || unsafe === undefined) return "";
  return String(unsafe)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
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
 * Generates an Excel XML Spreadsheet (.xls) matching the reference format.
 */
export function exportSalaryReportExcel(
  meta: ReportMeta,
  rows: readonly SalaryReportRow[],
): void {
  const t = totalsOf(rows);

  const rowsXml = rows
    .map(
      (r, idx) => `      <Row>
        <Cell ss:StyleID="CellCenter"><Data ss:Type="Number">${idx + 1}</Data></Cell>
        <Cell ss:StyleID="CellText"><Data ss:Type="String">${escapeXml(r.employeeCode)}</Data></Cell>
        <Cell ss:StyleID="CellText"><Data ss:Type="String">${escapeXml(r.fullName)}</Data></Cell>
        <Cell ss:StyleID="CellText"><Data ss:Type="String">${escapeXml(r.department?.name || r.team?.name || "General")}</Data></Cell>
        <Cell ss:StyleID="CellCenter"><Data ss:Type="Number">${r.days}</Data></Cell>
        <Cell ss:StyleID="CellCenter"><Data ss:Type="Number">${r.payableDays}</Data></Cell>
        <Cell ss:StyleID="CellCenter"><Data ss:Type="Number">${r.lopDays}</Data></Cell>
        <Cell ss:StyleID="CellCurrency"><Data ss:Type="Number">${amount(r.grossMonthly)}</Data></Cell>
        <Cell ss:StyleID="CellCurrency"><Data ss:Type="Number">${amount(r.perDayRate)}</Data></Cell>
        <Cell ss:StyleID="CellCurrency"><Data ss:Type="Number">${amount(r.earnedGross)}</Data></Cell>
        <Cell ss:StyleID="CellCurrency"><Data ss:Type="Number">${amount(r.pf)}</Data></Cell>
        <Cell ss:StyleID="CellCurrency"><Data ss:Type="Number">${amount(r.esi)}</Data></Cell>
        <Cell ss:StyleID="CellCurrency"><Data ss:Type="Number">${amount(r.loan)}</Data></Cell>
        <Cell ss:StyleID="CellCurrency"><Data ss:Type="Number">${amount(r.otherDeductions)}</Data></Cell>
        <Cell ss:StyleID="CellCurrency"><Data ss:Type="Number">${amount(r.totalDeductions)}</Data></Cell>
        <Cell ss:StyleID="CellCurrencyBold"><Data ss:Type="Number">${amount(r.net)}</Data></Cell>
        <Cell ss:StyleID="CellText"><Data ss:Type="String">${escapeXml(r.bankName)}</Data></Cell>
        <Cell ss:StyleID="CellText"><Data ss:Type="String">${escapeXml(r.bankAccount)}</Data></Cell>
      </Row>`,
    )
    .join("\n");

  const totalRowXml = `      <Row>
        <Cell ss:StyleID="TotalCenter"><Data ss:Type="String">TOTALS</Data></Cell>
        <Cell ss:StyleID="TotalText"><Data ss:Type="String">${rows.length} Employees</Data></Cell>
        <Cell ss:StyleID="TotalText"><Data ss:Type="String"></Data></Cell>
        <Cell ss:StyleID="TotalText"><Data ss:Type="String"></Data></Cell>
        <Cell ss:StyleID="TotalCenter"><Data ss:Type="String"></Data></Cell>
        <Cell ss:StyleID="TotalCenter"><Data ss:Type="String"></Data></Cell>
        <Cell ss:StyleID="TotalCenter"><Data ss:Type="String"></Data></Cell>
        <Cell ss:StyleID="TotalCurrency"><Data ss:Type="Number">${amount(t.grossMonthly)}</Data></Cell>
        <Cell ss:StyleID="TotalCurrency"><Data ss:Type="String"></Data></Cell>
        <Cell ss:StyleID="TotalCurrency"><Data ss:Type="Number">${amount(t.earnedGross)}</Data></Cell>
        <Cell ss:StyleID="TotalCurrency"><Data ss:Type="Number">${amount(t.pf)}</Data></Cell>
        <Cell ss:StyleID="TotalCurrency"><Data ss:Type="Number">${amount(t.esi)}</Data></Cell>
        <Cell ss:StyleID="TotalCurrency"><Data ss:Type="Number">${amount(t.loan)}</Data></Cell>
        <Cell ss:StyleID="TotalCurrency"><Data ss:Type="Number">${amount(t.otherDeductions)}</Data></Cell>
        <Cell ss:StyleID="TotalCurrency"><Data ss:Type="Number">${amount(t.totalDeductions)}</Data></Cell>
        <Cell ss:StyleID="TotalCurrencyBold"><Data ss:Type="Number">${amount(t.net)}</Data></Cell>
        <Cell ss:StyleID="TotalText"><Data ss:Type="String"></Data></Cell>
        <Cell ss:StyleID="TotalText"><Data ss:Type="String"></Data></Cell>
      </Row>`;

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Center"/>
   <Font ss:FontName="Nunito Sans" ss:Size="10" ss:Color="#1e293b"/>
  </Style>
  <Style ss:ID="ReportTitle">
   <Font ss:FontName="Nunito Sans" ss:Size="14" ss:Bold="1" ss:Color="#0a3271"/>
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
  </Style>
  <Style ss:ID="Header">
   <Font ss:FontName="Nunito Sans" ss:Size="10" ss:Bold="1" ss:Color="#ffffff"/>
   <Interior ss:Color="#1769F5" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#0284c7"/>
   </Borders>
  </Style>
  <Style ss:ID="CellText">
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
  </Style>
  <Style ss:ID="CellCenter">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
  </Style>
  <Style ss:ID="CellCurrency">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <NumberFormat ss:Format="₹#,##0.00"/>
  </Style>
  <Style ss:ID="CellCurrencyBold">
   <Font ss:FontName="Nunito Sans" ss:Size="10" ss:Bold="1" ss:Color="#059669"/>
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <NumberFormat ss:Format="₹#,##0.00"/>
  </Style>
  <Style ss:ID="TotalText">
   <Font ss:FontName="Nunito Sans" ss:Size="10" ss:Bold="1" ss:Color="#0a3271"/>
   <Interior ss:Color="#e0f2fe" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#38bdf8"/>
    <Border ss:Position="Bottom" ss:LineStyle="Double" ss:Weight="2" ss:Color="#0284c7"/>
   </Borders>
  </Style>
  <Style ss:ID="TotalCenter">
   <Font ss:FontName="Nunito Sans" ss:Size="10" ss:Bold="1" ss:Color="#0a3271"/>
   <Interior ss:Color="#e0f2fe" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#38bdf8"/>
    <Border ss:Position="Bottom" ss:LineStyle="Double" ss:Weight="2" ss:Color="#0284c7"/>
   </Borders>
  </Style>
  <Style ss:ID="TotalCurrency">
   <Font ss:FontName="Nunito Sans" ss:Size="10" ss:Bold="1" ss:Color="#0a3271"/>
   <Interior ss:Color="#e0f2fe" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <NumberFormat ss:Format="₹#,##0.00"/>
   <Borders>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#38bdf8"/>
    <Border ss:Position="Bottom" ss:LineStyle="Double" ss:Weight="2" ss:Color="#0284c7"/>
   </Borders>
  </Style>
  <Style ss:ID="TotalCurrencyBold">
   <Font ss:FontName="Nunito Sans" ss:Size="10" ss:Bold="1" ss:Color="#059669"/>
   <Interior ss:Color="#e0f2fe" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <NumberFormat ss:Format="₹#,##0.00"/>
   <Borders>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#38bdf8"/>
    <Border ss:Position="Bottom" ss:LineStyle="Double" ss:Weight="2" ss:Color="#0284c7"/>
   </Borders>
  </Style>
 </Styles>
 <Worksheet ss:Name="Salary_Report">
  <Table>
   <Column ss:Width="40"/>
   <Column ss:Width="90"/>
   <Column ss:Width="160"/>
   <Column ss:Width="120"/>
   <Column ss:Width="50"/>
   <Column ss:Width="65"/>
   <Column ss:Width="65"/>
   <Column ss:Width="110"/>
   <Column ss:Width="95"/>
   <Column ss:Width="110"/>
   <Column ss:Width="85"/>
   <Column ss:Width="85"/>
   <Column ss:Width="90"/>
   <Column ss:Width="95"/>
   <Column ss:Width="110"/>
   <Column ss:Width="120"/>
   <Column ss:Width="120"/>
   <Column ss:Width="130"/>
   <Row ss:Height="26">
    <Cell ss:MergeAcross="17" ss:StyleID="ReportTitle"><Data ss:Type="String">TexaOne ERP — Monthly Salary Report for ${escapeXml(periodLabel(meta))} (Run #${meta.runNumber})</Data></Cell>
   </Row>
   <Row ss:Height="22">
    <Cell ss:StyleID="Header"><Data ss:Type="String">#</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Emp ID</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Employee Name</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Department</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Days</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Present</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Absent/LOP</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Gross/Mo (₹)</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Per Day (₹)</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Total Earn (₹)</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">PF (₹)</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">ESI (₹)</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Loan EMI (₹)</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Other (₹)</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Deductions (₹)</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Net Pay (₹)</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Bank Name</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Bank Account</Data></Cell>
   </Row>
${rowsXml}
${totalRowXml}
  </Table>
 </Worksheet>
</Workbook>`;

  const fileName = `Monthly_Salary_Report_${meta.year}_${String(meta.month).padStart(2, "0")}_Run${meta.runNumber}.xls`;
  const blob = new Blob([xml], {
    type: "application/vnd.ms-excel;charset=utf-8",
  });
  downloadBlob(fileName, blob);
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
