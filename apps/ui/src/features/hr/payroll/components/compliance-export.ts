import type { Contribution } from "../api";
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
 * Exports monthly compliance contributions to an audit-ready CSV spreadsheet.
 */
export function exportComplianceCsv(
  contributions: Contribution<ComplianceKind>[],
  kind: ComplianceKind,
  periodLabel: string,
): void {
  const isPf = kind === "pf";
  const headers = isPf
    ? [
        "Employee Code",
        "Employee Name",
        "Period",
        "PF Covered",
        "PF Wage (₹)",
        "Employee Share (12%) (₹)",
        "Employer EPF Share (3.67%) (₹)",
        "Employer EPS Share (8.33%) (₹)",
        "Total Employer Share (₹)",
        "Net Deposit (₹)",
        "Payment Status",
        "Salary Credited",
      ]
    : [
        "Employee Code",
        "Employee Name",
        "Period",
        "ESI Covered",
        "ESI Wage (₹)",
        "Employee Share (0.75%) (₹)",
        "Employer Share (3.25%) (₹)",
        "Net Deposit (₹)",
        "Payment Status",
        "Salary Credited",
      ];

  const rows: string[] = [headers.map((h) => safeCell(h)).join(",")];

  let totalWage = 0;
  let totalEe = 0;
  let totalEr = 0;
  let totalEps = 0;
  let totalEpfEr = 0;

  for (const c of contributions) {
    const isIncluded = "pfIncluded" in c ? c.pfIncluded : c.esiIncluded;
    const wageNum = Number("pfWage" in c ? c.pfWage : c.esiWage) || 0;
    const eeNum = Number(c.employeeContribution) || 0;
    const erNum = Number(c.employerContribution) || 0;

    totalWage += wageNum;
    totalEe += eeNum;
    totalEr += erNum;

    if (isPf) {
      const pf = c as PfContribution;
      const epsNum =
        Number(pf.epsContribution) || Math.min(1250, wageNum * 0.0833);
      const epfErNum =
        Number(pf.epfEmployerContribution) || Math.max(0, erNum - epsNum);
      totalEps += epsNum;
      totalEpfEr += epfErNum;

      rows.push(
        [
          safeCell(c.employee.employeeCode),
          safeCell(c.employee.fullName),
          safeCell(periodLabel),
          safeCell(isIncluded ? "Yes" : "No"),
          safeCell(wageNum.toFixed(2)),
          safeCell(eeNum.toFixed(2)),
          safeCell(epfErNum.toFixed(2)),
          safeCell(epsNum.toFixed(2)),
          safeCell(erNum.toFixed(2)),
          safeCell((eeNum + erNum).toFixed(2)),
          safeCell(c.paymentStatus),
          safeCell(c.salaryCredited ? "Yes" : "No"),
        ].join(","),
      );
    } else {
      rows.push(
        [
          safeCell(c.employee.employeeCode),
          safeCell(c.employee.fullName),
          safeCell(periodLabel),
          safeCell(isIncluded ? "Yes" : "No"),
          safeCell(wageNum.toFixed(2)),
          safeCell(eeNum.toFixed(2)),
          safeCell(erNum.toFixed(2)),
          safeCell((eeNum + erNum).toFixed(2)),
          safeCell(c.paymentStatus),
          safeCell(c.salaryCredited ? "Yes" : "No"),
        ].join(","),
      );
    }
  }

  // Summary Row
  if (isPf) {
    rows.push(
      [
        safeCell("TOTALS"),
        safeCell(`${contributions.length} Members`),
        safeCell(""),
        safeCell(""),
        safeCell(totalWage.toFixed(2)),
        safeCell(totalEe.toFixed(2)),
        safeCell(totalEpfEr.toFixed(2)),
        safeCell(totalEps.toFixed(2)),
        safeCell(totalEr.toFixed(2)),
        safeCell((totalEe + totalEr).toFixed(2)),
        safeCell(""),
        safeCell(""),
      ].join(","),
    );
  } else {
    rows.push(
      [
        safeCell("TOTALS"),
        safeCell(`${contributions.length} Insured Persons`),
        safeCell(""),
        safeCell(""),
        safeCell(totalWage.toFixed(2)),
        safeCell(totalEe.toFixed(2)),
        safeCell(totalEr.toFixed(2)),
        safeCell((totalEe + totalEr).toFixed(2)),
        safeCell(""),
        safeCell(""),
      ].join(","),
    );
  }

  const cleanPeriod = periodLabel.replace(/\s+/g, "_");
  const fileName = `${kind.toUpperCase()}_Compliance_Report_${cleanPeriod}.csv`;
  downloadText(fileName, rows.join("\r\n"), "text/csv;charset=utf-8");
}
