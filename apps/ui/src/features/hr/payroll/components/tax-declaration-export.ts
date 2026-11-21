import { downloadWorkbook } from "@/lib/spreadsheet";
import { downloadText } from "../download";
import { isoDate } from "../format";
import type { TaxDeclaration } from "../types";

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
 * Exports tax declarations to CSV format.
 */
export function exportTaxDeclarationsCsv(
  declarations: TaxDeclaration[],
  financialYear: string,
): void {
  const headers = [
    "Employee Code",
    "Employee Name",
    "Financial Year",
    "Tax Regime",
    "Declared 80C (₹)",
    "Verified 80C (₹)",
    "Declared 80D (₹)",
    "Verified 80D (₹)",
    "Declared HRA (₹)",
    "Verified HRA (₹)",
    "Declared Home Loan Int (₹)",
    "Verified Home Loan Int (₹)",
    "Declared Other Deductions (₹)",
    "Verified Other Deductions (₹)",
    "Total Deductions (₹)",
    "Other Income (₹)",
    "Previous Employer Income (₹)",
    "Previous Employer TDS (₹)",
    "Status",
    "Verifier",
    "Verified Date",
    "Verification Note",
  ];

  let total80c = 0;
  let total80d = 0;
  let totalHra = 0;
  let totalDeductionsSum = 0;

  const rows = declarations.map((d) => {
    const dec80c = parseMoney(d.section80c);
    const ver80c = parseMoney(d.verifiedSection80c ?? d.section80c);
    const dec80d = parseMoney(d.section80d);
    const ver80d = parseMoney(d.verifiedSection80d ?? d.section80d);
    const decHra = parseMoney(d.hraExemption);
    const verHra = parseMoney(d.verifiedHraExemption ?? d.hraExemption);
    const decHome = parseMoney(d.homeLoanInterest);
    const verHome = parseMoney(
      d.verifiedHomeLoanInterest ?? d.homeLoanInterest,
    );
    const decOther = parseMoney(d.otherDeductions);
    const verOther = parseMoney(d.verifiedOtherDeductions ?? d.otherDeductions);

    const totalDec = dec80c + dec80d + decHra + decHome + decOther;
    total80c += ver80c;
    total80d += ver80d;
    totalHra += verHra;
    totalDeductionsSum += totalDec;

    return [
      safeCell(d.employee.employeeCode),
      safeCell(d.employee.fullName),
      safeCell(d.financialYear),
      safeCell(d.regime === "NEW" ? "New Regime (115BAC)" : "Old Regime"),
      dec80c.toFixed(2),
      ver80c.toFixed(2),
      dec80d.toFixed(2),
      ver80d.toFixed(2),
      decHra.toFixed(2),
      verHra.toFixed(2),
      decHome.toFixed(2),
      verHome.toFixed(2),
      decOther.toFixed(2),
      verOther.toFixed(2),
      totalDec.toFixed(2),
      parseMoney(d.otherIncome).toFixed(2),
      parseMoney(d.previousEmployerIncome).toFixed(2),
      parseMoney(d.previousEmployerTds).toFixed(2),
      safeCell(d.status),
      safeCell(d.verifier?.fullName || "—"),
      safeCell(d.verifiedAt ? isoDate(d.verifiedAt) : "—"),
      safeCell(d.verificationNote || ""),
    ].join(",");
  });

  const summaryRow = [
    safeCell("TOTALS"),
    safeCell(`${declarations.length} Declarations`),
    safeCell(financialYear),
    safeCell(""),
    safeCell(""),
    total80c.toFixed(2),
    safeCell(""),
    total80d.toFixed(2),
    safeCell(""),
    totalHra.toFixed(2),
    safeCell(""),
    safeCell(""),
    safeCell(""),
    safeCell(""),
    totalDeductionsSum.toFixed(2),
    safeCell(""),
    safeCell(""),
    safeCell(""),
    safeCell(""),
    safeCell(""),
    safeCell(""),
    safeCell(""),
  ].join(",");

  const csvContent =
    "\uFEFF" + [headers.join(","), ...rows, summaryRow].join("\r\n");
  const fileName = `Tax_Declarations_FY${financialYear}_${new Date().toISOString().slice(0, 10)}.csv`;
  downloadText(fileName, csvContent, "text/csv;charset=utf-8");
}

/**
 * Exports tax declarations to a real `.xlsx` workbook. The totals row adds up
 * the verified figures and the total deductions, not the declared ones.
 */
export async function exportTaxDeclarationsExcel(
  declarations: TaxDeclaration[],
  financialYear: string,
): Promise<void> {
  const verified = (
    verifiedValue: string | number | null | undefined,
    declared: string | number | null | undefined,
  ) => parseMoney(verifiedValue ?? declared);
  const totalDeclared = (d: TaxDeclaration) =>
    parseMoney(d.section80c) +
    parseMoney(d.section80d) +
    parseMoney(d.hraExemption) +
    parseMoney(d.homeLoanInterest) +
    parseMoney(d.otherDeductions);

  await downloadWorkbook(
    `Tax_Declarations_FY${financialYear}_${new Date().toISOString().slice(0, 10)}`,
    [
      {
        name: "Tax Declarations",
        title: `TexaOne ERP — Tax Declarations Audit FY ${financialYear}`,
        totals: `TOTALS — ${declarations.length} declarations`,
        rows: declarations,
        columns: [
          { header: "Emp Code", value: (d) => d.employee.employeeCode },
          { header: "Employee Name", value: (d) => d.employee.fullName },
          { header: "Regime", value: (d) => d.regime },
          {
            header: "Declared 80C (₹)",
            value: (d) => parseMoney(d.section80c),
            type: "amount",
            total: false,
          },
          {
            header: "Verified 80C (₹)",
            value: (d) => verified(d.verifiedSection80c, d.section80c),
            type: "amount",
          },
          {
            header: "Declared 80D (₹)",
            value: (d) => parseMoney(d.section80d),
            type: "amount",
            total: false,
          },
          {
            header: "Verified 80D (₹)",
            value: (d) => verified(d.verifiedSection80d, d.section80d),
            type: "amount",
          },
          {
            header: "Declared HRA (₹)",
            value: (d) => parseMoney(d.hraExemption),
            type: "amount",
            total: false,
          },
          {
            header: "Verified HRA (₹)",
            value: (d) => verified(d.verifiedHraExemption, d.hraExemption),
            type: "amount",
          },
          {
            header: "Total Deductions (₹)",
            value: totalDeclared,
            type: "amount",
          },
          { header: "Status", value: (d) => d.status },
          { header: "Verifier", value: (d) => d.verifier?.fullName || "—" },
          { header: "Verified Date", value: (d) => d.verifiedAt, type: "date" },
        ],
      },
    ],
  );
}
