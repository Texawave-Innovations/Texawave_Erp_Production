/**
 * HTML for the payslip PDF. A pure function of the (already masked) payslip
 * view so it is unit-testable without a browser; `PayslipPdfRenderer` turns
 * it into a PDF. Every interpolated value goes through `esc()` — employee and
 * bank names are user-entered text.
 */

type Amount = { toString(): string } | number | string | null | undefined;

export interface PayslipPdfView {
  payslipNumber: string;
  netPayable: Amount;
  generatedAt: Date | string;
  employee: {
    employeeCode: string;
    fullName: string;
    designation?: { name: string } | null;
    department?: { name: string } | null;
    pfProfile?: { uan: string | null; pfNumber: string | null } | null;
    esiProfile?: { insuranceNumber: string | null } | null;
    bankDetails: {
      bankName: string;
      accountNumber: string;
      ifscCode: string;
      panNumber?: string | null;
    } | null;
  };
  payrollPeriod: { year: number; month: number };
  payrollEntry: {
    totalCalendarDays: number;
    payableDays: Amount;
    lopDays: Amount;
    totalGrossEarnings: Amount;
    totalDeductions: Amount;
    earnings: Array<{ name: string; calculatedAmount: Amount }>;
    deductions: Array<{ name: string; amount: Amount }>;
  };
}

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Decimal/string/number → "1,23,456.00" (Indian grouping). */
export function money(value: Amount): string {
  const n = Number(value?.toString() ?? 0);
  return (Number.isFinite(n) ? n : 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function periodLabel(period: { year: number; month: number }): string {
  return `${MONTHS[period.month - 1] ?? period.month} ${period.year}`;
}

function row(label: string, value: unknown): string {
  return `<tr><th>${esc(label)}</th><td>${esc(value ?? "—")}</td></tr>`;
}

export function renderPayslipHtml(p: PayslipPdfView): string {
  const e = p.employee;
  const entry = p.payrollEntry;
  const lines = Math.max(entry.earnings.length, entry.deductions.length);
  const body = Array.from({ length: lines }, (_, i) => {
    const earn = entry.earnings[i];
    const ded = entry.deductions[i];
    return `<tr>
      <td>${earn ? esc(earn.name) : ""}</td>
      <td class="num">${earn ? money(earn.calculatedAmount) : ""}</td>
      <td>${ded ? esc(ded.name) : ""}</td>
      <td class="num">${ded ? money(ded.amount) : ""}</td>
    </tr>`;
  }).join("");

  return `<!doctype html>
<html><head><meta charset="utf-8" />
<title>${esc(p.payslipNumber)}</title>
<style>
  body { font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #111; margin: 0; }
  h1 { font-size: 18px; margin: 0 0 4px; }
  .muted { color: #555; }
  table { width: 100%; border-collapse: collapse; margin-top: 12px; }
  th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
  .info th { width: 25%; background: #f5f5f5; font-weight: 600; }
  .lines thead th { background: #f5f5f5; }
  .num { text-align: right; }
  .net { margin-top: 16px; font-size: 14px; font-weight: 700; }
</style></head>
<body>
  <h1>Payslip — ${esc(periodLabel(p.payrollPeriod))}</h1>
  <div class="muted">Payslip no. ${esc(p.payslipNumber)}</div>
  <table class="info">
    ${row("Employee", `${e.fullName} (${e.employeeCode})`)}
    ${row("Designation", e.designation?.name)}
    ${row("Department", e.department?.name)}
    ${row("Bank", e.bankDetails ? `${e.bankDetails.bankName} · ${e.bankDetails.accountNumber} · ${e.bankDetails.ifscCode}` : null)}
    ${row("PAN", e.bankDetails?.panNumber)}
    ${row("UAN", e.pfProfile?.uan)}
    ${row("ESI no.", e.esiProfile?.insuranceNumber)}
    ${row("Calendar days", entry.totalCalendarDays)}
    ${row("Payable days", entry.payableDays?.toString())}
    ${row("LOP days", entry.lopDays?.toString())}
  </table>
  <table class="lines">
    <thead><tr><th>Earnings</th><th class="num">Amount</th><th>Deductions</th><th class="num">Amount</th></tr></thead>
    <tbody>${body}</tbody>
    <tfoot><tr>
      <th>Gross earnings</th><th class="num">${money(entry.totalGrossEarnings)}</th>
      <th>Total deductions</th><th class="num">${money(entry.totalDeductions)}</th>
    </tr></tfoot>
  </table>
  <div class="net">Net payable: ₹ ${money(p.netPayable)}</div>
  <p class="muted">This is a system-generated payslip and does not require a signature.</p>
</body></html>`;
}
