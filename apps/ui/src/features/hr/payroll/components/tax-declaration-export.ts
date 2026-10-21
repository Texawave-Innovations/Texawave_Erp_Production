import { downloadBlob, downloadText } from "../download";
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

function escapeXml(unsafe: string | number | null | undefined): string {
  if (unsafe === null || unsafe === undefined) return "";
  return String(unsafe)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
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
 * Exports tax declarations to formatted Excel XML Spreadsheet (.xls).
 */
export function exportTaxDeclarationsExcel(
  declarations: TaxDeclaration[],
  financialYear: string,
): void {
  let total80c = 0;
  let total80d = 0;
  let totalHra = 0;
  let totalDeductionsSum = 0;

  declarations.forEach((d) => {
    total80c += parseMoney(d.verifiedSection80c ?? d.section80c);
    total80d += parseMoney(d.verifiedSection80d ?? d.section80d);
    totalHra += parseMoney(d.verifiedHraExemption ?? d.hraExemption);
    totalDeductionsSum +=
      parseMoney(d.section80c) +
      parseMoney(d.section80d) +
      parseMoney(d.hraExemption) +
      parseMoney(d.homeLoanInterest) +
      parseMoney(d.otherDeductions);
  });

  const rowsXml = declarations
    .map((d) => {
      const dec80c = parseMoney(d.section80c);
      const ver80c = parseMoney(d.verifiedSection80c ?? d.section80c);
      const dec80d = parseMoney(d.section80d);
      const ver80d = parseMoney(d.verifiedSection80d ?? d.section80d);
      const decHra = parseMoney(d.hraExemption);
      const verHra = parseMoney(d.verifiedHraExemption ?? d.hraExemption);
      const totalDec =
        dec80c +
        dec80d +
        decHra +
        parseMoney(d.homeLoanInterest) +
        parseMoney(d.otherDeductions);

      return `      <Row>
        <Cell ss:StyleID="CellText"><Data ss:Type="String">${escapeXml(d.employee.employeeCode)}</Data></Cell>
        <Cell ss:StyleID="CellText"><Data ss:Type="String">${escapeXml(d.employee.fullName)}</Data></Cell>
        <Cell ss:StyleID="CellCenter"><Data ss:Type="String">${escapeXml(d.regime)}</Data></Cell>
        <Cell ss:StyleID="CellCurrency"><Data ss:Type="Number">${dec80c.toFixed(2)}</Data></Cell>
        <Cell ss:StyleID="CellCurrency"><Data ss:Type="Number">${ver80c.toFixed(2)}</Data></Cell>
        <Cell ss:StyleID="CellCurrency"><Data ss:Type="Number">${dec80d.toFixed(2)}</Data></Cell>
        <Cell ss:StyleID="CellCurrency"><Data ss:Type="Number">${ver80d.toFixed(2)}</Data></Cell>
        <Cell ss:StyleID="CellCurrency"><Data ss:Type="Number">${decHra.toFixed(2)}</Data></Cell>
        <Cell ss:StyleID="CellCurrency"><Data ss:Type="Number">${verHra.toFixed(2)}</Data></Cell>
        <Cell ss:StyleID="CellCurrencyBold"><Data ss:Type="Number">${totalDec.toFixed(2)}</Data></Cell>
        <Cell ss:StyleID="CellText"><Data ss:Type="String">${escapeXml(d.status)}</Data></Cell>
        <Cell ss:StyleID="CellText"><Data ss:Type="String">${escapeXml(d.verifier?.fullName || "—")}</Data></Cell>
        <Cell ss:StyleID="CellText"><Data ss:Type="String">${escapeXml(d.verifiedAt ? isoDate(d.verifiedAt) : "—")}</Data></Cell>
      </Row>`;
    })
    .join("\n");

  const totalRowXml = `      <Row>
        <Cell ss:StyleID="TotalText"><Data ss:Type="String">TOTALS</Data></Cell>
        <Cell ss:StyleID="TotalText"><Data ss:Type="String">${declarations.length} Declarations</Data></Cell>
        <Cell ss:StyleID="TotalCenter"><Data ss:Type="String"></Data></Cell>
        <Cell ss:StyleID="TotalCurrency"><Data ss:Type="String"></Data></Cell>
        <Cell ss:StyleID="TotalCurrency"><Data ss:Type="Number">${total80c.toFixed(2)}</Data></Cell>
        <Cell ss:StyleID="TotalCurrency"><Data ss:Type="String"></Data></Cell>
        <Cell ss:StyleID="TotalCurrency"><Data ss:Type="Number">${total80d.toFixed(2)}</Data></Cell>
        <Cell ss:StyleID="TotalCurrency"><Data ss:Type="String"></Data></Cell>
        <Cell ss:StyleID="TotalCurrency"><Data ss:Type="Number">${totalHra.toFixed(2)}</Data></Cell>
        <Cell ss:StyleID="TotalCurrencyBold"><Data ss:Type="Number">${totalDeductionsSum.toFixed(2)}</Data></Cell>
        <Cell ss:StyleID="TotalText"><Data ss:Type="String"></Data></Cell>
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
  <Style ss:ID="Title">
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
 <Worksheet ss:Name="Tax_Declarations">
  <Table>
   <Column ss:Width="110"/>
   <Column ss:Width="160"/>
   <Column ss:Width="90"/>
   <Column ss:Width="110"/>
   <Column ss:Width="110"/>
   <Column ss:Width="110"/>
   <Column ss:Width="110"/>
   <Column ss:Width="110"/>
   <Column ss:Width="110"/>
   <Column ss:Width="130"/>
   <Column ss:Width="100"/>
   <Column ss:Width="130"/>
   <Column ss:Width="110"/>
   <Row ss:Height="26">
    <Cell ss:MergeAcross="12" ss:StyleID="Title"><Data ss:Type="String">TexaOne ERP — Tax Declarations Audit FY ${escapeXml(financialYear)}</Data></Cell>
   </Row>
   <Row ss:Height="22">
    <Cell ss:StyleID="Header"><Data ss:Type="String">Emp Code</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Employee Name</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Regime</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Declared 80C (₹)</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Verified 80C (₹)</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Declared 80D (₹)</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Verified 80D (₹)</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Declared HRA (₹)</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Verified HRA (₹)</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Total Deductions (₹)</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Status</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Verifier</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Verified Date</Data></Cell>
   </Row>
${rowsXml}
${totalRowXml}
  </Table>
 </Worksheet>
</Workbook>`;

  const fileName = `Tax_Declarations_FY${financialYear}_${new Date().toISOString().slice(0, 10)}.xls`;
  const blob = new Blob([xml], {
    type: "application/vnd.ms-excel;charset=utf-8",
  });
  downloadBlob(fileName, blob);
}
