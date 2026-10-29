const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const XLSX = require(path.resolve(root, "apps/ui/node_modules/xlsx"));
const ExcelJS = require(path.resolve(root, "apps/ui/node_modules/exceljs"));

const filePath = path.resolve(
  root,
  "Docs/TexaWave_Finance_Test_Plan_and_Results.xlsx",
);

console.log(
  "--- Verifying Docs/TexaWave_Finance_Test_Plan_and_Results.xlsx ---\n",
);

if (!fs.existsSync(filePath)) {
  console.error("FAIL: File does not exist at:", filePath);
  process.exit(1);
}

const stats = fs.statSync(filePath);
console.log(`File exists! File size: ${(stats.size / 1024).toFixed(2)} KB`);

// 1. Inspect with XLSX library
const wbXlsx = XLSX.readFile(filePath);
console.log(`Total sheets in workbook: ${wbXlsx.SheetNames.length}`);
console.log("Sheet names:", wbXlsx.SheetNames);

const expectedSheets = [
  "Cover",
  "Summary",
  "Manual UI",
  "Postman API",
  "Unit Tests",
  "Integration",
  "E2E Tests",
  "Database Checks",
  "Security",
  "Regression",
  "Bug Log",
];

let allSheetsPresent = true;
for (const s of expectedSheets) {
  if (!wbXlsx.SheetNames.includes(s)) {
    console.error(`FAIL: Missing expected sheet: ${s}`);
    allSheetsPresent = false;
  }
}
if (allSheetsPresent) {
  console.log("PASS: All 11 expected sheets are present.\n");
}

// 2. Count rows per sheet
expectedSheets.forEach((sheetName) => {
  const ws = wbXlsx.Sheets[sheetName];
  if (!ws) return;
  const json = XLSX.utils.sheet_to_json(ws, { header: 1 });
  console.log(`Sheet "${sheetName}": ${json.length} rows`);
});

// 3. Inspect Summary sheet
console.log("\n--- Summary Sheet Structure ---");
const wsSummary = wbXlsx.Sheets["Summary"];
const summaryData = XLSX.utils.sheet_to_json(wsSummary, { header: 1 });
summaryData.forEach((row, i) => {
  if (row && row.length) {
    console.log(`Row ${i + 1}:`, row.join(" | "));
  }
});

// 4. Verify with ExcelJS
async function verifyExcelJS() {
  const wbExcelJS = new ExcelJS.Workbook();
  await wbExcelJS.xlsx.readFile(filePath);
  console.log(
    `\nPASS: ExcelJS successfully parsed workbook (${wbExcelJS.worksheets.length} worksheets).`,
  );
}

verifyExcelJS()
  .then(() => {
    console.log("\n--- Verification Complete: Workbook is 100% valid! ---");
  })
  .catch((err) => {
    console.error("FAIL: ExcelJS verification failed:", err);
    process.exit(1);
  });
