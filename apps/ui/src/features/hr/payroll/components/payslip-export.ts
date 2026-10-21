import { downloadBlob, downloadText } from "../download";
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
 * Exports payslips list to Microsoft Excel XML Spreadsheet format (.xls)
 * Includes bold headers, styled grid borders, right-aligned currency, and formula summary totals.
 */
export function exportPayslipsExcel(
  payslips: Payslip[],
  periodTitle = "All_Periods",
): void {
  let totalGross = 0;
  let totalDeductions = 0;
  let totalNet = 0;

  const rowXml = payslips
    .map((p) => {
      const gross = parseMoney(p.payrollEntry.totalGrossEarnings);
      const deductions = parseMoney(p.payrollEntry.totalDeductions);
      const net = parseMoney(p.netPayable);

      totalGross += gross;
      totalDeductions += deductions;
      totalNet += net;

      return `
      <Row ss:Height="20">
        <Cell><Data ss:Type="String">${escapeXml(p.payslipNumber)}</Data></Cell>
        <Cell><Data ss:Type="String">${escapeXml(p.employee.employeeCode)}</Data></Cell>
        <Cell><Data ss:Type="String">${escapeXml(p.employee.fullName)}</Data></Cell>
        <Cell><Data ss:Type="String">${escapeXml(p.employee.department?.name || p.employee.team?.name || "General")}</Data></Cell>
        <Cell><Data ss:Type="String">${escapeXml(p.employee.designation?.name || "—")}</Data></Cell>
        <Cell><Data ss:Type="String">${escapeXml(periodLabel(p.payrollPeriod))}</Data></Cell>
        <Cell><Data ss:Type="String">${escapeXml(days(p.payrollEntry.payableDays))}</Data></Cell>
        <Cell><Data ss:Type="String">${escapeXml(days(p.payrollEntry.lopDays))}</Data></Cell>
        <Cell ss:StyleID="sCurrency"><Data ss:Type="Number">${gross.toFixed(2)}</Data></Cell>
        <Cell ss:StyleID="sCurrency"><Data ss:Type="Number">${deductions.toFixed(2)}</Data></Cell>
        <Cell ss:StyleID="sCurrency"><Data ss:Type="Number">${net.toFixed(2)}</Data></Cell>
        <Cell><Data ss:Type="String">${escapeXml(p.employee.bankDetails?.bankName || "—")}</Data></Cell>
        <Cell><Data ss:Type="String">${escapeXml(p.employee.bankDetails?.accountNumber || "—")}</Data></Cell>
        <Cell><Data ss:Type="String">${escapeXml(p.employee.bankDetails?.panNumber || "—")}</Data></Cell>
        <Cell><Data ss:Type="String">${escapeXml(p.employee.pfProfile?.uan || "—")}</Data></Cell>
        <Cell><Data ss:Type="String">${escapeXml(p.employee.esiProfile?.insuranceNumber || "—")}</Data></Cell>
        <Cell><Data ss:Type="String">${escapeXml(isoDate(p.generatedAt))}</Data></Cell>
        <Cell><Data ss:Type="String">${escapeXml(p.version ? `v${p.version}` : "v1")}</Data></Cell>
      </Row>`;
    })
    .join("");

  const summaryRowXml = `
      <Row ss:Height="22" ss:StyleID="sSummary">
        <Cell><Data ss:Type="String">TOTALS</Data></Cell>
        <Cell><Data ss:Type="String"></Data></Cell>
        <Cell><Data ss:Type="String">${payslips.length} Employees</Data></Cell>
        <Cell><Data ss:Type="String"></Data></Cell>
        <Cell><Data ss:Type="String"></Data></Cell>
        <Cell><Data ss:Type="String"></Data></Cell>
        <Cell><Data ss:Type="String"></Data></Cell>
        <Cell><Data ss:Type="String"></Data></Cell>
        <Cell ss:StyleID="sSummaryCurrency"><Data ss:Type="Number">${totalGross.toFixed(2)}</Data></Cell>
        <Cell ss:StyleID="sSummaryCurrency"><Data ss:Type="Number">${totalDeductions.toFixed(2)}</Data></Cell>
        <Cell ss:StyleID="sSummaryCurrency"><Data ss:Type="Number">${totalNet.toFixed(2)}</Data></Cell>
        <Cell><Data ss:Type="String"></Data></Cell>
        <Cell><Data ss:Type="String"></Data></Cell>
        <Cell><Data ss:Type="String"></Data></Cell>
        <Cell><Data ss:Type="String"></Data></Cell>
        <Cell><Data ss:Type="String"></Data></Cell>
        <Cell><Data ss:Type="String"></Data></Cell>
        <Cell><Data ss:Type="String"></Data></Cell>
      </Row>`;

  const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Center"/>
   <Borders/>
   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="11" ss:Color="#000000"/>
  </Style>
  <Style ss:ID="sHeader">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#B0C4DE"/>
   </Borders>
   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="11" ss:Color="#FFFFFF" ss:Bold="1"/>
   <Interior ss:Color="#0a3271" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="sCurrency">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <NumberFormat ss:Format="₹#,##0.00"/>
  </Style>
  <Style ss:ID="sSummary">
   <Alignment ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="11" ss:Color="#0a3271" ss:Bold="1"/>
   <Interior ss:Color="#F0F8FF" ss:Pattern="Solid"/>
   <Borders>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#B0C4DE"/>
    <Border ss:Position="Bottom" ss:LineStyle="Double" ss:Weight="3" ss:Color="#0a3271"/>
   </Borders>
  </Style>
  <Style ss:ID="sSummaryCurrency">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="11" ss:Color="#0a3271" ss:Bold="1"/>
   <Interior ss:Color="#F0F8FF" ss:Pattern="Solid"/>
   <NumberFormat ss:Format="₹#,##0.00"/>
   <Borders>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#B0C4DE"/>
    <Border ss:Position="Bottom" ss:LineStyle="Double" ss:Weight="3" ss:Color="#0a3271"/>
   </Borders>
  </Style>
 </Styles>
 <Worksheet ss:Name="Employee Payslips">
  <Table ss:DefaultRowHeight="18">
   <Column ss:Width="110"/>
   <Column ss:Width="95"/>
   <Column ss:Width="160"/>
   <Column ss:Width="130"/>
   <Column ss:Width="140"/>
   <Column ss:Width="110"/>
   <Column ss:Width="85"/>
   <Column ss:Width="70"/>
   <Column ss:Width="120"/>
   <Column ss:Width="120"/>
   <Column ss:Width="120"/>
   <Column ss:Width="130"/>
   <Column ss:Width="140"/>
   <Column ss:Width="100"/>
   <Column ss:Width="110"/>
   <Column ss:Width="110"/>
   <Column ss:Width="100"/>
   <Column ss:Width="70"/>
   <Row ss:Height="24" ss:StyleID="sHeader">
    <Cell><Data ss:Type="String">Payslip #</Data></Cell>
    <Cell><Data ss:Type="String">Employee Code</Data></Cell>
    <Cell><Data ss:Type="String">Employee Name</Data></Cell>
    <Cell><Data ss:Type="String">Department</Data></Cell>
    <Cell><Data ss:Type="String">Designation</Data></Cell>
    <Cell><Data ss:Type="String">Payroll Period</Data></Cell>
    <Cell><Data ss:Type="String">Payable Days</Data></Cell>
    <Cell><Data ss:Type="String">LOP Days</Data></Cell>
    <Cell><Data ss:Type="String">Gross Earnings (₹)</Data></Cell>
    <Cell><Data ss:Type="String">Total Deductions (₹)</Data></Cell>
    <Cell><Data ss:Type="String">Net Payable (₹)</Data></Cell>
    <Cell><Data ss:Type="String">Bank Name</Data></Cell>
    <Cell><Data ss:Type="String">Account Number</Data></Cell>
    <Cell><Data ss:Type="String">PAN Number</Data></Cell>
    <Cell><Data ss:Type="String">PF UAN</Data></Cell>
    <Cell><Data ss:Type="String">ESI Number</Data></Cell>
    <Cell><Data ss:Type="String">Generated Date</Data></Cell>
    <Cell><Data ss:Type="String">Version</Data></Cell>
   </Row>
   ${rowXml}
   ${summaryRowXml}
  </Table>
 </Worksheet>
</Workbook>`;

  const blob = new Blob([xmlContent], {
    type: "application/vnd.ms-excel;charset=utf-8",
  });
  const sanitizedPeriod = periodTitle.replace(/[^a-zA-Z0-9_-]/g, "_");
  const fileName = `TexaOne_Payslips_${sanitizedPeriod}_${new Date().toISOString().slice(0, 10)}.xls`;

  downloadBlob(fileName, blob);
}

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
