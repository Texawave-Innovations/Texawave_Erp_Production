import type { Contribution } from "../api";
import { downloadWorkbook } from "@/lib/spreadsheet";
import { downloadText } from "../download";
import { money } from "../format";
import type { ComplianceKind, PfContribution } from "../types";

function safeCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '""';
  let s = String(value).trim();
  if (/^[=+\-@\t\r]/.test(s)) {
    s = `'${s}`;
  }
  return `"${s.replace(/"/g, '""')}"`;
}

/**
 * Generates official EPFO ECR (Electronic Challan cum Return) text file.
 * Standard EPFO pipe-delimited (#~#) format for direct portal upload.
 * Format:
 * UAN#~#MEMBER_NAME#~#GROSS_WAGES#~#EPF_WAGES#~#EPS_WAGES#~#EDLI_WAGES#~#EE_EPF_SHARE#~#ER_EPF_SHARE#~#ER_EPS_SHARE#~#NCP_DAYS#~#REFUND_ADVANCES
 */
export function exportPfEcrText(
  contributions: Contribution<"pf">[],
  periodLabel: string,
): void {
  const lines: string[] = [];

  for (const c of contributions) {
    const pf = c as PfContribution;
    if (!pf.pfIncluded) continue;

    const uan = pf.employee.employeeCode.replace(/\D/g, "") || "100000000000";
    const name = pf.employee.fullName.toUpperCase().replace(/[^A-Z\s]/g, "");
    const wage = Math.round(Number(pf.pfWage) || 0);
    const eeShare = Math.round(Number(pf.employeeContribution) || 0);
    const epsShare = Math.round(
      Number(pf.epsContribution) || Math.min(1250, wage * 0.0833),
    );
    const erEpfShare = Math.round(
      Number(pf.epfEmployerContribution) || Math.max(0, eeShare - epsShare),
    );

    // Standard 11-column EPFO ECR record
    const row = [
      uan,
      name,
      wage, // Gross Wages
      wage, // EPF Wages
      Math.min(15000, wage), // EPS Wages (capped at 15k)
      Math.min(15000, wage), // EDLI Wages (capped at 15k)
      eeShare, // EE Share (12%)
      erEpfShare, // ER EPF Share (3.67%)
      epsShare, // ER EPS Share (8.33%)
      0, // NCP (Non-Contributory Period / LOP) Days
      0, // Refund of Advances
    ].join("#~#");

    lines.push(row);
  }

  const cleanPeriod = periodLabel.replace(/\s+/g, "_");
  const fileName = `EPFO_ECR_${cleanPeriod}.txt`;
  downloadText(fileName, lines.join("\r\n"), "text/plain;charset=utf-8");
}

/**
 * Generates official ESIC monthly return CSV format for portal upload.
 * Standard format required by the ESIC employer portal.
 */
export function exportEsicReturnCsv(
  contributions: Contribution<"esi">[],
  periodLabel: string,
): void {
  const headers = [
    "IP Number",
    "IP Name",
    "No of Days for which wages paid",
    "Total Monthly Wages",
    "Reason Code for Zero Working Days",
    "Last Working Day",
  ];

  const rows: string[] = [headers.map((h) => safeCell(h)).join(",")];

  for (const c of contributions) {
    if (!c.esiIncluded) continue;

    const ipNumber = c.employee.employeeCode.replace(/\D/g, "") || "1100000000";
    const name = c.employee.fullName.toUpperCase().replace(/[^A-Z\s]/g, "");
    const wage = Math.round(Number(c.esiWage) || 0);

    rows.push(
      [
        safeCell(ipNumber),
        safeCell(name),
        safeCell("30"),
        safeCell(wage),
        safeCell("0"),
        safeCell(""),
      ].join(","),
    );
  }

  const cleanPeriod = periodLabel.replace(/\s+/g, "_");
  const fileName = `ESIC_Monthly_Return_${cleanPeriod}.csv`;
  downloadText(fileName, rows.join("\r\n"), "text/csv;charset=utf-8");
}

/**
 * Exports monthly compliance contributions to an audit-ready `.xlsx` workbook
 * (typed amounts, fitted columns, totals row). The EPFO / ESIC portal upload
 * files above stay in their prescribed text/CSV formats.
 */
export async function exportComplianceExcel(
  contributions: Contribution<ComplianceKind>[],
  kind: ComplianceKind,
  periodLabel: string,
): Promise<void> {
  const isPf = kind === "pf";

  interface Line {
    code: string;
    name: string;
    covered: string;
    wage: number;
    employee: number;
    employer: number;
    eps: number;
    epfEmployer: number;
    status: string;
    credited: string;
  }

  const lines: Line[] = contributions.map((c) => {
    const included = "pfIncluded" in c ? c.pfIncluded : c.esiIncluded;
    const wage = Number("pfWage" in c ? c.pfWage : c.esiWage) || 0;
    const employee = Number(c.employeeContribution) || 0;
    const employer = Number(c.employerContribution) || 0;
    let eps = 0;
    let epfEmployer = 0;
    if (isPf) {
      const pf = c as PfContribution;
      eps = Number(pf.epsContribution) || Math.min(1250, wage * 0.0833);
      epfEmployer =
        Number(pf.epfEmployerContribution) || Math.max(0, employer - eps);
    }
    return {
      code: c.employee.employeeCode,
      name: c.employee.fullName,
      covered: included ? "Yes" : "No",
      wage,
      employee,
      employer,
      eps,
      epfEmployer,
      status: c.paymentStatus,
      credited: c.salaryCredited ? "Yes" : "No",
    };
  });

  const common = {
    first: [
      { header: "Employee Code", value: (l: Line) => l.code },
      { header: "Employee Name", value: (l: Line) => l.name },
      { header: "Period", value: () => periodLabel },
    ],
    last: [
      { header: "Payment Status", value: (l: Line) => l.status },
      { header: "Salary Credited", value: (l: Line) => l.credited },
    ],
  };

  const columns = isPf
    ? [
        ...common.first,
        { header: "PF Covered", value: (l: Line) => l.covered },
        {
          header: "PF Wage (₹)",
          value: (l: Line) => l.wage,
          type: "amount" as const,
        },
        {
          header: "Employee Share (12%) (₹)",
          value: (l: Line) => l.employee,
          type: "amount" as const,
        },
        {
          header: "Employer EPF Share (3.67%) (₹)",
          value: (l: Line) => l.epfEmployer,
          type: "amount" as const,
        },
        {
          header: "Employer EPS Share (8.33%) (₹)",
          value: (l: Line) => l.eps,
          type: "amount" as const,
        },
        {
          header: "Total Employer Share (₹)",
          value: (l: Line) => l.employer,
          type: "amount" as const,
        },
        {
          header: "Net Deposit (₹)",
          value: (l: Line) => l.employee + l.employer,
          type: "amount" as const,
        },
        ...common.last,
      ]
    : [
        ...common.first,
        { header: "ESI Covered", value: (l: Line) => l.covered },
        {
          header: "ESI Wage (₹)",
          value: (l: Line) => l.wage,
          type: "amount" as const,
        },
        {
          header: "Employee Share (0.75%) (₹)",
          value: (l: Line) => l.employee,
          type: "amount" as const,
        },
        {
          header: "Employer Share (3.25%) (₹)",
          value: (l: Line) => l.employer,
          type: "amount" as const,
        },
        {
          header: "Net Deposit (₹)",
          value: (l: Line) => l.employee + l.employer,
          type: "amount" as const,
        },
        ...common.last,
      ];

  const cleanPeriod = periodLabel.replace(/\s+/g, "_");
  await downloadWorkbook(
    `${kind.toUpperCase()}_Compliance_Report_${cleanPeriod}`,
    [
      {
        name: `${kind.toUpperCase()} Compliance`,
        title: `TexaOne ERP — ${kind.toUpperCase()} Compliance Report — ${periodLabel}`,
        totals: `TOTALS — ${contributions.length} ${isPf ? "members" : "insured persons"}`,
        rows: lines,
        columns,
      },
    ],
  );
}
