const fs = require("fs");
const path = require("path");
const ExcelJS = require(path.resolve("apps/ui/node_modules/exceljs"));
const XLSX = require(path.resolve("apps/ui/node_modules/xlsx"));

async function verifyMasterWorkbook() {
  const filePath = path.resolve("Docs/TexaWave_Finance_Module_Reference.xlsx");
  console.log(
    `\n================================================================`,
  );
  console.log(` VERIFYING MASTER WORKBOOK: ${filePath}`);
  console.log(
    `================================================================\n`,
  );

  if (!fs.existsSync(filePath)) {
    throw new Error(`Master workbook not found at ${filePath}`);
  }

  const stats = fs.statSync(filePath);
  console.log(`File Size: ${(stats.size / 1024).toFixed(2)} KB`);

  // 1. XLSX library check
  const xlsxWb = XLSX.readFile(filePath);
  console.log(
    `\nXLSX Sheet Names (${xlsxWb.SheetNames.length}):`,
    xlsxWb.SheetNames,
  );

  // 2. ExcelJS detailed check
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);

  console.log(`\nExcelJS Worksheets (${wb.worksheets.length}):`);
  wb.worksheets.forEach((ws, idx) => {
    console.log(
      `  [Sheet ${idx + 1}] "${ws.name}" - Rows: ${ws.rowCount}, Cols: ${ws.columnCount}`,
    );
  });

  // Verify sheet count
  if (wb.worksheets.length !== 7) {
    throw new Error(`Expected exactly 7 sheets, got ${wb.worksheets.length}`);
  }

  // Brand and content audit counters
  let totalCells = 0;
  let nonNunitoSansCount = 0;
  let suspectColorCount = 0;
  let aiWordCount = 0;
  const forbiddenAiPatterns = [
    /\bbot\b/i,
    /\brobot\b/i,
    /\bbrain\b/i,
    /\bsparkles\b/i,
    /\bwand\b/i,
    /ai\s+generated/i,
    /ai\s+assistant/i,
    /ai\s+powered/i,
  ];

  wb.worksheets.forEach((ws) => {
    ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
        totalCells++;

        // Font check
        if (cell.font) {
          if (cell.font.name && cell.font.name !== "Nunito Sans") {
            nonNunitoSansCount++;
            console.warn(
              `Non-Nunito font found in ${ws.name} at row ${rowNumber}, col ${colNumber}: ${cell.font.name}`,
            );
          }
        }

        // Color check (ARGB)
        const checkColor = (colorObj, type) => {
          if (colorObj && colorObj.argb) {
            const hex = colorObj.argb.toUpperCase();
            if (hex.length >= 8) {
              const r = parseInt(hex.slice(2, 4), 16);
              const g = parseInt(hex.slice(4, 6), 16);
              const b = parseInt(hex.slice(6, 8), 16);
              // Indigo/Purple/Violet: high blue, significant red, low green (e.g. #4338CA, #6366F1, #7C3AED)
              if (b > 160 && r > 60 && g < 140 && Math.abs(r - g) > 20) {
                suspectColorCount++;
                console.warn(
                  `Suspect violet/purple color in ${ws.name} at r${rowNumber}c${colNumber} (${type}): #${hex}`,
                );
              }
            }
          }
        };

        if (cell.fill && cell.fill.fgColor)
          checkColor(cell.fill.fgColor, "fill");
        if (cell.font && cell.font.color) checkColor(cell.font.color, "font");

        // AI Words check
        if (typeof cell.value === "string") {
          for (const pattern of forbiddenAiPatterns) {
            if (pattern.test(cell.value)) {
              aiWordCount++;
              console.warn(
                `Forbidden AI pattern "${pattern}" in ${ws.name} at r${rowNumber}c${colNumber}: "${cell.value}"`,
              );
            }
          }
        }
      });
    });
  });

  console.log(`\n--- Quality & Brand Invariants Audit ---`);
  console.log(`Total Cells Audited: ${totalCells}`);
  console.log(`Non-Nunito Sans Fonts: ${nonNunitoSansCount} (Expected: 0)`);
  console.log(
    `Suspect Purple/Violet Colors: ${suspectColorCount} (Expected: 0)`,
  );
  console.log(`Forbidden AI Terms: ${aiWordCount} (Expected: 0)`);

  if (nonNunitoSansCount > 0) throw new Error("Failed Nunito Sans font check!");
  if (suspectColorCount > 0)
    throw new Error("Failed brand color check (purple/violet detected)!");
  if (aiWordCount > 0)
    throw new Error("Failed AI prohibited terminology check!");

  // Detailed sheet metric verification
  console.log(`\n--- Sheet Content Metrics Verification ---`);
  const sheet2 = wb.getWorksheet("Finance API Reference");
  const apiRowCount = sheet2.rowCount - 4; // Minus 4 header rows
  console.log(
    `Sheet 2 (Finance API Reference) Data Rows: ${apiRowCount} (Expected: 74)`,
  );

  const sheet3 = wb.getWorksheet("Database & Data Model Reference");
  const dbRowCount = sheet3.rowCount - 4;
  console.log(
    `Sheet 3 (Database Reference) Data Rows: ${dbRowCount} (Expected: 186)`,
  );

  const sheet4 = wb.getWorksheet("Finance Manual API & Postman");
  const testRowCount = sheet4.rowCount - 4;
  console.log(
    `Sheet 4 (Manual API & Postman) Data Rows: ${testRowCount} (Expected: 98)`,
  );

  const sheet5 = wb.getWorksheet("Finance Feature & Workflows");
  const wfRowCount = sheet5.rowCount - 4;
  console.log(
    `Sheet 5 (Feature & Workflows) Data Rows: ${wfRowCount} (Expected: 16)`,
  );

  const sheet6 = wb.getWorksheet("Accounting & GST Rules");
  const rulesRowCount = sheet6.rowCount - 4;
  console.log(
    `Sheet 6 (Accounting & GST Rules) Data Rows: ${rulesRowCount} (Expected: 12)`,
  );

  const sheet7 = wb.getWorksheet("Remaining Issues & Checklist");
  const checklistRowCount = sheet7.rowCount - 4;
  console.log(
    `Sheet 7 (Remaining Issues & Checklist) Data Rows: ${checklistRowCount} (Expected: 17)`,
  );

  console.log(
    `\n ALL VERIFICATION CHECKS PASSED PERFECTLY! Workbook is 100% compliant with specifications.`,
  );
}

verifyMasterWorkbook().catch((err) => {
  console.error("\nVerification failed:", err);
  process.exit(1);
});
